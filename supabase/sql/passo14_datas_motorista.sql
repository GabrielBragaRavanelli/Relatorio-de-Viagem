-- =============================================================================
-- PASSO 14 - Ficha de viagem: datas de saída e chegada pelo motorista
-- AJBorges Transporte & Logística
--
-- Parte da proteger_colunas_admin_fichas do passo 13 (já com a correção do
-- adiantamento do passo 13b) e muda só a parte do motorista:
--   1. data_saida e data_chegada passam a ser gravadas no INSERT e no UPDATE
--      (coluna; se vier null, dados_completos.dataSaida / dataChegada), e
--      também em dados_completos (DD/MM/AAAA, como a ficha usa);
--   2. Ao enviar (status 'pendente') o banco recusa a ficha sem as duas datas
--      ou com a chegada antes da saída. Em 'rascunho' nada é bloqueado.
-- Destino final continua opcional (nenhuma regra do banco exige).
--
-- Não muda: admin continua livre; placas, KMs, fretes e comissão, adiantamento,
-- abastecimentos, despesas, comprovantes e status.
--
-- Rodar no SQL Editor do Supabase até o "commit;". Tudo roda numa transação
-- (begin ... commit): se algo falhar, nada é alterado. Pode ser reexecutado.
-- As conferências ficam depois do commit: rode cada uma separadamente.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. _data(p): data em DD/MM/AAAA ou AAAA-MM-DD (texto JSON), ano de 2020 a 2100.
--    Dia/mês impossível (ex.: 31/02) ou qualquer outra coisa vira null.
-- -----------------------------------------------------------------------------
create or replace function public._data(p jsonb)
returns date
language plpgsql
immutable
set search_path to ''
as $$
declare
  t text;
  d date;
begin
  if jsonb_typeof(p) is distinct from 'string' then
    return null;
  end if;
  t := btrim(p #>> '{}');
  if t ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' then
    d := make_date(substr(t, 7, 4)::int, substr(t, 4, 2)::int, substr(t, 1, 2)::int);
  elsif t ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    d := make_date(substr(t, 1, 4)::int, substr(t, 6, 2)::int, substr(t, 9, 2)::int);
  else
    return null;
  end if;
  if extract(year from d) between 2020 and 2100 then
    return d;
  end if;
  return null;
exception when others then
  return null;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. proteger_colunas_admin_fichas: cópia do passo 13 (com o 13b), mudando só a
--    parte do motorista. Mudanças em relação ao passo 13 marcadas com "passo 14".
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
  -- passo 13: veículo e comissões do perfil, destinos, adiantamento e totais
  v_tipo          text;
  v_com_carreta   numeric;
  v_com_rodotrem  numeric;
  v_destino_ini   text;
  v_destino_fim   text;
  v_adiantamento  numeric;
  v_total_frete   numeric;
  v_vr_comissao   numeric;
  v_saldo         numeric;
  v_fin           jsonb;
  -- passo 14: datas da viagem
  v_data_saida    date;
  v_data_chegada  date;
  v_datas         jsonb;
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

  -- passo 13: perfil de quem está logado (INSERT e UPDATE): nome, CPF, tipo de
  -- veículo e comissões especiais do Alimentício
  select nome, cpf, tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem
    into v_perfil from public.perfis where id = auth.uid();
  v_tipo         := coalesce(v_perfil.tipo_veiculo, 'carreta');
  v_com_carreta  := v_perfil.comissao_alim_carreta;
  v_com_rodotrem := v_perfil.comissao_alim_rodotrem;

  if tg_op = 'UPDATE' then
    v_antigo_row := to_jsonb(old);
    if jsonb_typeof(v_antigo_row -> 'dados_completos') = 'object' then
      v_antigo_dc := v_antigo_row -> 'dados_completos';
    end if;
  end if;

  -- Só os campos que o motorista pode preencher, já limpos
  v_abast    := public._limpar_abastecimentos(coalesce(to_jsonb(new) -> 'abastecimentos', v_novo_dc -> 'abastecimentos'));
  -- passo 13: comissão calculada pela regra, com o veículo de cada linha
  v_fretes   := public._limpar_fretes(v_novo_dc -> 'fretes', v_antigo_dc -> 'fretes', v_tipo, v_com_carreta, v_com_rodotrem);
  v_despesas := public._limpar_outras_despesas(
                  coalesce(to_jsonb(new) -> 'despesas_extras', v_novo_dc -> 'outrasDespesas'),
                  coalesce(v_antigo_row -> 'despesas_extras', v_antigo_dc -> 'outrasDespesas'));
  v_anexos   := public._limpar_comprovantes(coalesce(to_jsonb(new) -> 'comprovantes', v_novo_dc -> 'anexos'));

  -- passo 13: destinos e adiantamento (coluna; dados_completos é a reserva)
  v_destino_ini  := nullif(btrim(public._txt(coalesce(nullif(to_jsonb(new) -> 'destino_inicial', 'null'::jsonb),
                                                      v_novo_dc -> 'destinoInicial'), 120) #>> '{}'), '');
  v_destino_fim  := nullif(btrim(public._txt(coalesce(nullif(to_jsonb(new) -> 'destino_final', 'null'::jsonb),
                                                      v_novo_dc -> 'destinoFinal'), 120) #>> '{}'), '');
  -- (a coluna tem default 0: o 0 dela não pode esconder o valor de dados_completos)
  v_adiantamento := coalesce(nullif(public._moeda(to_jsonb(new) -> 'valor_adiantamento'), 0),
                             public._moeda(v_novo_dc -> 'valorAdiantamento'),
                             public._moeda(to_jsonb(new) -> 'valor_adiantamento'));
  -- total_frete, vr_comissao e saldo_comissao não são lidos da coluna: são calculados abaixo

  -- passo 13: totais calculados a partir das linhas limpas
  select coalesce(sum(public._moeda(f -> 'valor')), 0),
         coalesce(sum(public._moeda(f -> 'comissao')), 0)
    into v_total_frete, v_vr_comissao
    from jsonb_array_elements(v_fretes) f;
  v_saldo := v_vr_comissao - coalesce(v_adiantamento, 0);

  v_fin := jsonb_build_object(
             'destinoInicial',    coalesce(v_destino_ini, ''),
             'destinoFinal',      coalesce(v_destino_fim, ''),
             'valorAdiantamento', coalesce(public._moeda_txt(v_adiantamento), ''),
             'totalFrete',        public._moeda_txt(v_total_frete),
             'vrComissao',        public._moeda_txt(v_vr_comissao),
             'saldoComissao',     public._moeda_txt(v_saldo));

  -- passo 14: datas de saída e chegada (coluna; dados_completos é a reserva).
  -- Gravadas em dados_completos como a ficha usa (DD/MM/AAAA).
  v_data_saida   := coalesce(public._data(to_jsonb(new) -> 'data_saida'),
                             public._data(v_novo_dc -> 'dataSaida'));
  v_data_chegada := coalesce(public._data(to_jsonb(new) -> 'data_chegada'),
                             public._data(v_novo_dc -> 'dataChegada'));
  v_datas := jsonb_build_object(
               'dataSaida',   coalesce(to_char(v_data_saida, 'DD/MM/YYYY'), ''),
               'dataChegada', coalesce(to_char(v_data_chegada, 'DD/MM/YYYY'), ''));

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
    -- passo 14: datas obrigatórias e chegada não antes da saída
    if v_data_saida is null or v_data_chegada is null then
      raise exception 'Informe a data de saída e a data de chegada.';
    end if;
    if v_data_chegada < v_data_saida then
      raise exception 'A data de chegada não pode ser antes da data de saída.';
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
    -- passo 13: rodotrem escolhe o veículo em cada frete do Alimentício com valor
    if v_tipo in ('rodotrem', 'carreta_rodotrem') and exists (
         select 1 from jsonb_array_elements(v_fretes) f
          where f ->> 'cliente' = 'alimenticio'
            and coalesce(public._moeda(f -> 'valor'), 0) > 0
            and f ->> 'veiculo' is null) then
      raise exception 'Escolha o veículo (carreta ou rodotrem) em cada frete do Alimentício.';
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
  -- passo 13: + destinos, adiantamento e totais de frete/comissão
  -- passo 14: + datas de saída e chegada
  v_dc := v_antigo_dc || jsonb_build_object(
            'placas',         v_placa,
            'abastecimentos', v_abast,
            'fretes',         v_fretes,
            'outrasDespesas', v_despesas,
            'despesas_extras',v_despesas,
            'anexos',         v_anexos,
            'comprovantes',   v_anexos) || v_km || v_fin || v_datas;

  if tg_op = 'INSERT' then
    -- Dados do motorista vêm do perfil de quem está logado, não do navegador
    -- (passo 13: o perfil já foi lido no começo da parte do motorista)
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
    -- passo 13: destinos, adiantamento e totais de frete/comissão
    -- passo 14: data_saida e data_chegada
    new := jsonb_populate_record(new, v_nulos || jsonb_build_object(
             'motorista_id',    auth.uid(),
             'iniciada_em',     now(),
             'data_envio',      now(),
             'motorista',       v_perfil.nome,
             'motorista_cpf',   v_perfil.cpf,
             'origem_envio',    'motorista_com_login',
             'data_saida',      v_data_saida,
             'data_chegada',    v_data_chegada,
             'placas',          v_placa,
             'km_saida',        v_km_saida,
             'km_chegada',      v_km_entrada,
             'km_total',        v_km_total,
             'destino_inicial',    v_destino_ini,
             'destino_final',      v_destino_fim,
             'valor_adiantamento', v_adiantamento,
             'total_frete',        v_total_frete,
             'vr_comissao',        v_vr_comissao,
             'saldo_comissao',     v_saldo,
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc));
  else
    -- UPDATE: parte da linha antiga e troca só o que o motorista pode mexer
    -- passo 12: placas passa a ser a que o motorista mandou (limpa)
    -- passo 13: + destinos, adiantamento e totais de frete/comissão
    -- passo 14: + data_saida e data_chegada
    new := jsonb_populate_record(old, jsonb_build_object(
             'status',          new.status,
             'data_saida',      v_data_saida,
             'data_chegada',    v_data_chegada,
             'placas',          v_placa,
             'km_saida',        v_km_saida,
             'km_chegada',      v_km_entrada,
             'km_total',        v_km_total,
             'destino_inicial',    v_destino_ini,
             'destino_final',      v_destino_fim,
             'valor_adiantamento', v_adiantamento,
             'total_frete',        v_total_frete,
             'vr_comissao',        v_vr_comissao,
             'saldo_comissao',     v_saldo,
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
-- 3. Conferência (depois do commit; rode cada bloco separadamente)
--    Os testes rodam como o primeiro perfil com role = 'motorista' (deixado como
--    carreta dentro da mesma transação) e desfazem tudo no final (rollback).
--    Se a RLS recusar o id de teste, troque 'AJB-TESTE-P14' por um número reservado.
-- =============================================================================

-- 3.1 Helper _data (esperado: 2026-10-01 | 2026-10-05 | null | null | null | null)
select public._data('"01/10/2026"') as d1, public._data('"2026-10-05"') as d2, public._data('"31/02/2026"') as d3,
       public._data('"01/10/1999"') as d4, public._data('"1/10/2026"') as d5, public._data('20261001') as d6;

-- 3.2 Teste A: datas 01/10/2026 e 05/10/2026 (esperado: data_saida=2026-10-01 | data_chegada=2026-10-05 | dc_saida=01/10/2026 | dc_chegada=05/10/2026 | destino_final=Santos - SP)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P14', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "05/10/2026", "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"1.000,00"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): data_saida=% | data_chegada=% | dc_saida=% | dc_chegada=% | destino_final=%',
    r.data_saida, r.data_chegada, r.dados_completos ->> 'dataSaida', r.dados_completos ->> 'dataChegada',
    coalesce(r.destino_final, '(vazio)');
end $$;
rollback;

-- 3.3 Teste B: sem data de chegada (esperado: erro "Informe a data de saída e a data de chegada."; se aparecer RESULTADO, a regra falhou)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, dados_completos)
  values ('AJB-TESTE-P14', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '2026-10-01', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "", "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"1.000,00"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): data_saida=% | data_chegada=% | dc_saida=% | dc_chegada=% | destino_final=%',
    r.data_saida, r.data_chegada, r.dados_completos ->> 'dataSaida', r.dados_completos ->> 'dataChegada',
    coalesce(r.destino_final, '(vazio)');
end $$;
rollback;

-- 3.4 Teste C: chegada 30/09/2026 com saída 01/10/2026 (esperado: erro "A data de chegada não pode ser antes da data de saída."; se aparecer RESULTADO, a regra falhou)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P14', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '2026-10-01', '2026-09-30', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "30/09/2026", "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"1.000,00"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): data_saida=% | data_chegada=% | dc_saida=% | dc_chegada=% | destino_final=%',
    r.data_saida, r.data_chegada, r.dados_completos ->> 'dataSaida', r.dados_completos ->> 'dataChegada',
    coalesce(r.destino_final, '(vazio)');
end $$;
rollback;

-- 3.5 Teste D: sem destino final (esperado: data_saida=2026-10-01 | data_chegada=2026-10-05 | dc_saida=01/10/2026 | dc_chegada=05/10/2026 | destino_final=(vazio))
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P14', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "destinoFinal": "", "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"1.000,00"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): data_saida=% | data_chegada=% | dc_saida=% | dc_chegada=% | destino_final=%',
    r.data_saida, r.data_chegada, r.dados_completos ->> 'dataSaida', r.dados_completos ->> 'dataChegada',
    coalesce(r.destino_final, '(vazio)');
end $$;
rollback;

-- 3.6 Teste E: datas só em dados_completos, colunas null (esperado: data_saida=2026-10-01 | data_chegada=2026-10-05 | dc_saida=01/10/2026 | dc_chegada=05/10/2026 | destino_final=Santos - SP)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P14', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "2026-10-05", "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"1.000,00"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): data_saida=% | data_chegada=% | dc_saida=% | dc_chegada=% | destino_final=%',
    r.data_saida, r.data_chegada, r.dados_completos ->> 'dataSaida', r.dados_completos ->> 'dataChegada',
    coalesce(r.destino_final, '(vazio)');
end $$;
rollback;
