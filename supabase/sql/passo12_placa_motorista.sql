-- =============================================================================
-- PASSO 12 - Ficha de viagem: placa principal pelo motorista e KMs obrigatórios
-- AJBorges Transporte & Logística
--
-- Parte da versão do passo 11 de proteger_colunas_admin_fichas e muda só a
-- parte do motorista:
--   1. A placa principal (coluna placas) passa a ser gravada, já limpa
--      (ABC1D23), no INSERT e no UPDATE, e também em dados_completos.placas;
--   2. Ao enviar (status 'pendente') o banco recusa a ficha sem placa principal,
--      com placa secundária inválida ou igual à principal, sem os KMs do trecho
--      principal, sem os KMs do 2º trecho quando há placa secundária, ou com
--      KM de chegada menor que o de saída. Em 'rascunho' nada é bloqueado.
--
-- Não muda: admin continua livre; cálculo dos totais (kmTotal1, kmTotal2,
-- kmTotal); colunas km_saida, km_chegada e km_total; limpeza de abastecimentos,
-- fretes (comissão do ML), despesas e comprovantes; dados do perfil no INSERT;
-- status permitidos. As chaves internas continuam kmEntrada / kmEntrada2 e a
-- coluna continua km_chegada (só os textos da tela viraram "KM Chegada").
--
-- Rodar no SQL Editor do Supabase até o "commit;". Tudo roda numa transação
-- (begin ... commit): se algo falhar, nada é alterado. Pode ser reexecutado.
-- As conferências ficam depois do commit: rode cada uma separadamente.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. proteger_colunas_admin_fichas: parte do motorista grava a placa principal
--    e valida placas e KMs no envio.
--    Mudanças em relação ao passo 11 estão marcadas com "passo 12".
-- -----------------------------------------------------------------------------
create or replace function public.proteger_colunas_admin_fichas()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_novo_dc    jsonb := case when jsonb_typeof(to_jsonb(new) -> 'dados_completos') = 'object'
                             then to_jsonb(new) -> 'dados_completos' else '{}'::jsonb end;
  v_antigo_dc  jsonb := '{}'::jsonb;
  v_antigo_row jsonb := '{}'::jsonb;
  v_abast      jsonb;
  v_fretes     jsonb;
  v_despesas   jsonb;
  v_anexos     jsonb;
  v_dc         jsonb;
  v_nulos      jsonb;
  v_perfil     record;
  -- passo 11: KMs e placa secundária
  v_km_saida    bigint;
  v_km_entrada  bigint;
  v_km_saida2   bigint;
  v_km_entrada2 bigint;
  v_km_total1   bigint;
  v_km_total2   bigint;
  v_km_total    bigint;
  v_placa_sec   text;
  v_km          jsonb;
  -- passo 12: placa principal e o texto que veio na secundária
  v_placa       text;
  v_placa_sec_enviada text;
begin
  -- ---------------- Admin / diretoria: livre ----------------
  if public.is_admin() then
    if new.status = 'aprovado'
       and (tg_op = 'INSERT' or old.status is distinct from 'aprovado') then
      new.aprovado_por := coalesce(auth.jwt() ->> 'email', 'admin');
      new.aprovado_em  := now();
    end if;
    return new;
  end if;

  -- ---------------- Motorista (qualquer não-admin) ----------------
  if new.status is null or new.status not in ('rascunho', 'pendente') then
    raise exception 'Acesso negado: status inválido para motorista.';
  end if;

  if tg_op = 'UPDATE' then
    v_antigo_row := to_jsonb(old);
    if jsonb_typeof(v_antigo_row -> 'dados_completos') = 'object' then
      v_antigo_dc := v_antigo_row -> 'dados_completos';
    end if;
  end if;

  -- Só os campos que o motorista pode preencher, já limpos
  v_abast    := public._limpar_abastecimentos(coalesce(to_jsonb(new) -> 'abastecimentos', v_novo_dc -> 'abastecimentos'));
  v_fretes   := public._limpar_fretes(v_novo_dc -> 'fretes', v_antigo_dc -> 'fretes');
  v_despesas := public._limpar_outras_despesas(
                  coalesce(to_jsonb(new) -> 'despesas_extras', v_novo_dc -> 'outrasDespesas'),
                  coalesce(v_antigo_row -> 'despesas_extras', v_antigo_dc -> 'outrasDespesas'));
  v_anexos   := public._limpar_comprovantes(coalesce(to_jsonb(new) -> 'comprovantes', v_novo_dc -> 'anexos'));

  -- passo 12: placa principal da coluna placas; dados_completos.placas é a reserva
  v_placa := coalesce(public._placa(to_jsonb(new) -> 'placas'),
                      public._placa(v_novo_dc -> 'placas'));

  -- passo 11: KMs e placa secundária vindos do motorista (dados_completos)
  v_km_saida   := public._km(v_novo_dc -> 'kmSaida')::bigint;
  v_km_entrada := public._km(v_novo_dc -> 'kmEntrada')::bigint;
  v_placa_sec  := public._placa(v_novo_dc -> 'placaSecundaria');
  v_placa_sec_enviada := nullif(btrim(public._txt(v_novo_dc -> 'placaSecundaria', 20) #>> '{}'), '');
  -- O segundo trecho só existe quando há placa secundária
  if v_placa_sec is not null then
    v_km_saida2   := public._km(v_novo_dc -> 'kmSaida2')::bigint;
    v_km_entrada2 := public._km(v_novo_dc -> 'kmEntrada2')::bigint;
  end if;

  -- passo 12: regras do envio (só em 'pendente'; rascunho pode ficar incompleto)
  if new.status = 'pendente' then
    if v_placa is null then
      raise exception 'Informe a placa principal (ex.: ABC-1D23).';
    end if;
    if v_placa_sec_enviada is not null and v_placa_sec is null then
      raise exception 'Placa secundária inválida.';
    end if;
    if v_placa_sec = v_placa then
      raise exception 'A placa secundária não pode ser igual à principal.';
    end if;
    if v_km_saida is null or v_km_entrada is null then
      raise exception 'Informe o KM de saída e o KM de chegada.';
    end if;
    if v_placa_sec is not null and (v_km_saida2 is null or v_km_entrada2 is null) then
      raise exception 'Informe o KM de saída e o KM de chegada da placa secundária.';
    end if;
    if v_km_entrada < v_km_saida or v_km_entrada2 < v_km_saida2 then
      raise exception 'O KM de chegada não pode ser menor que o de saída.';
    end if;
  end if;

  -- Totais calculados aqui (o motorista não envia): entrada - saída,
  -- só quando os dois existem e entrada >= saída
  if v_km_entrada >= v_km_saida then
    v_km_total1 := v_km_entrada - v_km_saida;
  end if;
  if v_km_entrada2 >= v_km_saida2 then
    v_km_total2 := v_km_entrada2 - v_km_saida2;
  end if;
  -- Viagem toda: soma só os trechos que existem
  if v_km_total1 is not null or v_km_total2 is not null then
    v_km_total := coalesce(v_km_total1, 0) + coalesce(v_km_total2, 0);
  end if;

  v_km := jsonb_build_object(
            'kmSaida',         v_km_saida::text,
            'kmEntrada',       v_km_entrada::text,
            'kmTotal1',        v_km_total1::text,
            'placaSecundaria', v_placa_sec,
            'kmSaida2',        v_km_saida2::text,
            'kmEntrada2',      v_km_entrada2::text,
            'kmTotal2',        v_km_total2::text,
            'kmTotal',         v_km_total::text);

  -- dados_completos = o que já estava no banco + só as partes do motorista
  -- passo 12: + placas (a principal, limpa)
  v_dc := v_antigo_dc || jsonb_build_object(
            'placas',         v_placa,
            'abastecimentos', v_abast,
            'fretes',         v_fretes,
            'outrasDespesas', v_despesas,
            'despesas_extras',v_despesas,
            'anexos',         v_anexos,
            'comprovantes',   v_anexos) || v_km;

  if tg_op = 'INSERT' then
    -- Dados do motorista vêm do perfil de quem está logado, não do navegador
    select nome, cpf into v_perfil from public.perfis where id = auth.uid();

    v_dc := v_dc || jsonb_build_object(
              'id',           new.id,
              'protocolo',    new.id,
              'motorista',    coalesce(v_perfil.nome, ''),
              'motoristaCpf', coalesce(v_perfil.cpf, ''),
              'motorista_cpf',coalesce(v_perfil.cpf, ''),
              'motoristaId',  auth.uid(),
              'dataEnvio',    to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS'),
              'origemEnvio',  'motorista_com_login',
              'status',       new.status);

    -- Zera todas as colunas que aceitam nulo (exceto as do motorista)...
    select coalesce(jsonb_object_agg(a.attname, null), '{}'::jsonb) into v_nulos
    from pg_attribute a
    where a.attrelid = 'public.fichas_viagem'::regclass
      and a.attnum > 0 and not a.attisdropped and not a.attnotnull
      and a.attname not in ('id','status','abastecimentos','comprovantes','despesas_extras','dados_completos');

    -- ...e aplica só o que é permitido/forçado.
    -- (chaves de colunas que não existirem na tabela são ignoradas)
    -- passo 11: km_saida, km_chegada e km_total vêm dos valores já limpos
    -- passo 12: placas vem da placa principal já limpa
    new := jsonb_populate_record(new, v_nulos || jsonb_build_object(
             'motorista_id',    auth.uid(),
             'iniciada_em',     now(),
             'data_envio',      now(),
             'motorista',       v_perfil.nome,
             'motorista_cpf',   v_perfil.cpf,
             'origem_envio',    'motorista_com_login',
             'placas',          v_placa,
             'km_saida',        v_km_saida,
             'km_chegada',      v_km_entrada,
             'km_total',        v_km_total,
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc));
  else
    -- UPDATE: parte da linha antiga e troca só o que o motorista pode mexer
    -- passo 12: placas passa a ser a que o motorista mandou (limpa)
    new := jsonb_populate_record(old, jsonb_build_object(
             'status',          new.status,
             'placas',          v_placa,
             'km_saida',        v_km_saida,
             'km_chegada',      v_km_entrada,
             'km_total',        v_km_total,
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc || jsonb_build_object('status', new.status)));
  end if;

  return new;
end;
$function$;


commit;


-- =============================================================================
-- 2. Conferência (depois do commit; rode cada bloco separadamente)
--    Os testes A, B e C rodam como um motorista real e desfazem tudo no final
--    (rollback). Se a RLS recusar o id de teste, troque 'AJB-TESTE-P12' por um
--    número reservado.
-- =============================================================================

-- 2.1 Função atualizada e trigger ligado (esperado: security_definer = true, tgenabled = O)
select p.proname, p.prosecdef as security_definer, t.tgname, t.tgenabled
  from pg_proc p
  left join pg_trigger t on t.tgfoid = p.oid and t.tgrelid = 'public.fichas_viagem'::regclass
 where p.pronamespace = 'public'::regnamespace
   and p.proname = 'proteger_colunas_admin_fichas';

-- 2.2 Teste A (esperado: placas=ABC1D23 | km_saida=100000 | km_chegada=101500 | km_total=2300 | dc_placas=ABC1D23 | dc_placa_sec=XYZ9A87 | dc_km_total1=1500 | dc_km_total2=800)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, km_total, dados_completos)
  values ('AJB-TESTE-P12', 'teste', 'abc-1d23', 'pendente', 999, '{
           "placas": "abc-1d23",
           "kmSaida": "100.000", "kmEntrada": "101.500",
           "placaSecundaria": "XYZ-9A87", "kmSaida2": "200000", "kmEntrada2": "200.800",
           "kmTotal": "999", "kmTotal1": "999", "kmTotal2": "999",
           "abastecimentos": [{"posto":"Posto A","valor":"800,00","litros":"150","combustivel":"diesel_s10","placa":"principal"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): placas=% | km_saida=% | km_chegada=% | km_total=% | dc_placas=% | dc_placa_sec=% | dc_km_total1=% | dc_km_total2=%',
    r.placas, r.km_saida, r.km_chegada, r.km_total,
    r.dados_completos ->> 'placas', r.dados_completos ->> 'placaSecundaria',
    r.dados_completos ->> 'kmTotal1', r.dados_completos ->> 'kmTotal2';
end $$;
rollback;

-- 2.3 Teste B (esperado: erro "Informe a placa principal (ex.: ABC-1D23)."; se aparecer RESULTADO, a regra falhou)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, dados_completos)
  values ('AJB-TESTE-P12', 'teste', null, 'pendente', '{
           "kmSaida": "100000", "kmEntrada": "101500"
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): placas=% | km_total=%', r.placas, r.km_total;
end $$;
rollback;

-- 2.4 Teste C (esperado: erro "Informe o KM de saída e o KM de chegada da placa secundária."; se aparecer RESULTADO, a regra falhou)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, dados_completos)
  values ('AJB-TESTE-P12', 'teste', 'ABC-1D23', 'pendente', '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "placaSecundaria": "XYZ-9A87"
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): placas=% | dc_placa_sec=% | km_total=%',
    r.placas, r.dados_completos ->> 'placaSecundaria', r.km_total;
end $$;
rollback;

-- 2.5 Fichas antigas continuam iguais (nada é reescrito por este passo)
select id, placas, km_saida, km_chegada, km_total,
       dados_completos ->> 'placaSecundaria' as placa_sec
  from public.fichas_viagem order by data_envio desc limit 5;
