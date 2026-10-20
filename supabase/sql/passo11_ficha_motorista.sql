-- =============================================================================
-- PASSO 11 - Ficha de viagem: KMs, placa secundária e combustível pelo motorista
-- AJBorges Transporte & Logística
--
-- Hoje o trigger proteger_colunas_admin_fichas descarta qualquer campo novo
-- que o motorista preencher. Este passo libera, já limpos pelo banco:
--   1. Em cada abastecimento: combustivel ('diesel_s10' | 'diesel_s500' | 'arla')
--      e placa ('principal' | 'secundaria');
--   2. Em dados_completos: kmSaida, kmEntrada, placaSecundaria, kmSaida2, kmEntrada2;
--   3. Os totais (kmTotal1, kmTotal2, kmTotal) são calculados pelo banco,
--      e as colunas km_saida, km_chegada e km_total passam a ser preenchidas.
--
-- Não muda: admin continua livre; placas (principal) continua só do admin;
-- status permitidos, dados do perfil no INSERT, fretes, comissão do ML,
-- comprovantes e despesas ficam como estão.
--
-- Partiu das definições de supabase/sql/referencia_fichas_atual.sql.
-- Rodar no SQL Editor do Supabase. Tudo roda numa transação (begin ... commit):
-- se algo falhar, nada é alterado. Pode ser reexecutado com segurança.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. _km(p): KM só com dígitos (aceita ponto de milhar e remove), até 9 dígitos.
--    Qualquer outra coisa vira null.
-- -----------------------------------------------------------------------------
create or replace function public._km(p jsonb)
returns text
language sql
immutable
set search_path to ''
as $$
  select case when t ~ '^[0-9]{1,9}$' then (t::bigint)::text end
  from (select replace(replace(public._txt(p, 20) #>> '{}', '.', ''), ' ', '') as t) s;
$$;


-- -----------------------------------------------------------------------------
-- 2. _placa(p): 7 letras/números em maiúsculas, formato antigo (ABC1234)
--    ou Mercosul (ABC1D23). Hífen e espaços são removidos. Senão, null.
-- -----------------------------------------------------------------------------
create or replace function public._placa(p jsonb)
returns text
language sql
immutable
set search_path to ''
as $$
  select case when t ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then t end
  from (select upper(regexp_replace(public._txt(p, 20) #>> '{}', '[^A-Za-z0-9]', '', 'g')) as t) s;
$$;


-- -----------------------------------------------------------------------------
-- 3. _limpar_abastecimentos: + combustivel e placa (o resto igual ao atual)
-- -----------------------------------------------------------------------------
create or replace function public._limpar_abastecimentos(p jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'posto',  public._txt(e -> 'posto'),
           'nf',     public._txt(e -> 'nf', 40),
           'km',     public._txt(e -> 'km', 20),
           'valor',  public._txt(e -> 'valor', 20),
           'litros', public._txt(e -> 'litros', 20),
           -- novos: só os valores da lista; qualquer outro vira null
           'combustivel', case when (e ->> 'combustivel') in ('diesel_s10', 'diesel_s500', 'arla')
                               then e ->> 'combustivel' end,
           'placa',       case when (e ->> 'placa') in ('principal', 'secundaria')
                               then e ->> 'placa' end
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
       with ordinality as t(e, i)
  where i <= 10 and jsonb_typeof(e) = 'object';
$$;


-- -----------------------------------------------------------------------------
-- 4. proteger_colunas_admin_fichas: parte do motorista aceita os KMs e a
--    placa secundária; os totais são calculados aqui.
--    Mudanças em relação à versão atual estão marcadas com "passo 11".
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

  -- passo 11: KMs e placa secundária vindos do motorista (dados_completos)
  v_km_saida   := public._km(v_novo_dc -> 'kmSaida')::bigint;
  v_km_entrada := public._km(v_novo_dc -> 'kmEntrada')::bigint;
  v_placa_sec  := public._placa(v_novo_dc -> 'placaSecundaria');
  -- O segundo trecho só existe quando há placa secundária
  if v_placa_sec is not null then
    v_km_saida2   := public._km(v_novo_dc -> 'kmSaida2')::bigint;
    v_km_entrada2 := public._km(v_novo_dc -> 'kmEntrada2')::bigint;
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
  v_dc := v_antigo_dc || jsonb_build_object(
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
    new := jsonb_populate_record(new, v_nulos || jsonb_build_object(
             'motorista_id',    auth.uid(),
             'iniciada_em',     now(),
             'data_envio',      now(),
             'motorista',       v_perfil.nome,
             'motorista_cpf',   v_perfil.cpf,
             'origem_envio',    'motorista_com_login',
             'km_saida',        v_km_saida,
             'km_chegada',      v_km_entrada,
             'km_total',        v_km_total,
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc));
  else
    -- UPDATE: parte da linha antiga e troca só o que o motorista pode mexer
    -- (placas, a principal, continua a da linha antiga)
    new := jsonb_populate_record(old, jsonb_build_object(
             'status',          new.status,
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


-- -----------------------------------------------------------------------------
-- 5. Conferência (rode separadamente depois do commit)
-- -----------------------------------------------------------------------------
-- 1. Funções novas/alteradas (devem aparecer as 4):
--   select p.proname, p.prosecdef as security_definer
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('_km', '_placa', '_limpar_abastecimentos', 'proteger_colunas_admin_fichas');
--
-- 2. Trigger continua ligado na tabela:
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.fichas_viagem'::regclass and not tgisinternal;
--
-- 3. Limpeza dos helpers (esperado: 101500 | null | XYZ9A87 | null):
--   select public._km('"101.500"'), public._km('"1234567890"'),
--          public._placa('"xyz-9a87"'), public._placa('"XXX12"');
--
-- 4. Limpeza do abastecimento (esperado: combustivel diesel_s10 / null, placa secundaria / null):
--   select public._limpar_abastecimentos('[
--     {"posto":"Posto A","valor":"500,00","litros":"100","combustivel":"diesel_s10","placa":"secundaria"},
--     {"posto":"Posto B","valor":"50,00","litros":"10","combustivel":"gasolina","placa":"ABC1234"}
--   ]'::jsonb);
--
-- 5. TESTE do motorista (roda como um motorista real e desfaz tudo no final).
--    Rode o bloco inteiro de uma vez. Esperado na linha devolvida:
--      placas = null            (o motorista mandou 'XXX1234' e o banco descartou)
--      km_saida = 100000, km_chegada = 101500, km_total = 2300
--      dc_km_total1 = 1500, dc_km_total2 = 800, dc_km_total = 2300 (o '999' mandado foi ignorado)
--      dc_placa_sec = XYZ9A87
--    Se a RLS recusar o id de teste, troque 'AJB-TESTE-P11' por um número reservado.
--
--   begin;
--   select set_config('request.jwt.claims',
--            (select json_build_object('sub', id, 'role', 'authenticated')::text
--               from public.perfis where role = 'motorista' limit 1), true);
--   set local role authenticated;
--   insert into public.fichas_viagem (id, motorista, placas, status, km_total, dados_completos)
--   values ('AJB-TESTE-P11', 'teste', 'XXX1234', 'pendente', 999, '{
--            "kmSaida": "100.000", "kmEntrada": "101.500",
--            "placaSecundaria": "XYZ-9A87", "kmSaida2": "200000", "kmEntrada2": "200.800",
--            "kmTotal": "999", "kmTotal1": "999", "kmTotal2": "999",
--            "abastecimentos": [{"posto":"Posto A","valor":"800,00","litros":"150","combustivel":"diesel_s10","placa":"principal"}]
--          }'::jsonb)
--   returning placas, km_saida, km_chegada, km_total,
--             dados_completos ->> 'kmTotal1' as dc_km_total1,
--             dados_completos ->> 'kmTotal2' as dc_km_total2,
--             dados_completos ->> 'kmTotal'  as dc_km_total,
--             dados_completos ->> 'placaSecundaria' as dc_placa_sec,
--             abastecimentos;
--   rollback;
--
-- 6. Fichas antigas continuam iguais (nada é reescrito por este passo):
--   select id, placas, km_saida, km_chegada, km_total,
--          dados_completos ->> 'placaSecundaria' as placa_sec
--     from public.fichas_viagem order by data_envio desc limit 5;
