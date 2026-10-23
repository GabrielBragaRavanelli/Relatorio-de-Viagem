-- =============================================================================
-- PASSO 15 - Comissão do Alimentício rodotrem: Viana (ES) pelo DESTINO da linha
-- AJBorges Transporte & Logística
--
-- Recria só a public._limpar_fretes de 5 parâmetros (passo 13). Muda uma regra:
--   Alimentício, linha "rodotrem" sem comissão especial de rodotrem:
--     8% quando o DESTINO da linha é Viana (ES); qualquer outro destino = 9%.
--     A origem não importa mais.
-- Continua igual: especial de rodotrem e de carreta do motorista, carreta 11%,
-- Shopee 11%, Mercado Livre R$ 400,00, sem valor = comissão vazia, limpeza do
-- valor, da descarga e do veículo.
--
-- Não muda: trigger proteger_colunas_admin_fichas, _eh_viana_es, a versão de
-- 2 parâmetros da _limpar_fretes e as outras funções.
--
-- Rodar no SQL Editor do Supabase até o "commit;". Tudo roda numa transação
-- (begin ... commit): se algo falhar, nada é alterado. Pode ser reexecutado.
-- As conferências ficam depois do commit: rode cada uma separadamente.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. _limpar_fretes(p_novo, p_antigo, p_tipo, p_com_carreta, p_com_rodotrem)
--    Igual à do passo 13, trocando _eh_viana_es(origem) por _eh_viana_es(destino).
-- -----------------------------------------------------------------------------
create or replace function public._limpar_fretes(p_novo jsonb, p_antigo jsonb, p_tipo text,
                                                 p_com_carreta numeric, p_com_rodotrem numeric)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'data',     public._txt(n -> 'data', 20),
           'cliente',  to_jsonb(coalesce(c.cliente, '')),
           'origem',   public._txt(n -> 'origem'),
           'destino',  public._txt(n -> 'destino'),
           'veiculo',  to_jsonb(c.veiculo),
           'valor',    to_jsonb(coalesce(public._moeda_txt(c.valor), '')),
           'comissao', to_jsonb(coalesce(public._moeda_txt(
                         case
                           when c.valor is null or c.valor = 0 then null
                           when c.cliente = 'mercado_livre' then 400.00
                           when c.cliente = 'shopee'        then round(c.valor * 11 / 100, 2)
                           when c.cliente = 'alimenticio' and c.veiculo = 'rodotrem' then
                             round(c.valor * coalesce(p_com_rodotrem,
                                     case when public._eh_viana_es(public._txt(n -> 'destino') #>> '{}')
                                          then 8 else 9 end) / 100, 2)
                           when c.cliente = 'alimenticio' and c.veiculo = 'carreta' then
                             round(c.valor * coalesce(p_com_carreta, 11) / 100, 2)
                         end), '')),
           'descarga', to_jsonb(coalesce(public._moeda_txt(public._moeda(n -> 'descarga')), ''))
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_novo) = 'array' then p_novo else '[]'::jsonb end)
       with ordinality as t(n, i)
  cross join lateral (
    select case when (n ->> 'cliente') in ('alimenticio', 'shopee', 'mercado_livre')
                then n ->> 'cliente' end as cliente,
           case when coalesce(p_tipo, 'carreta') not in ('rodotrem', 'carreta_rodotrem') then 'carreta'
                when (n ->> 'veiculo') in ('carreta', 'rodotrem') then n ->> 'veiculo' end as veiculo,
           public._moeda(n -> 'valor') as valor
  ) c
  where i <= 8 and jsonb_typeof(n) = 'object';
$$;


commit;


-- =============================================================================
-- 2. Conferência (depois do commit; rode cada bloco separadamente)
--    Os testes rodam como o primeiro perfil com role = 'motorista' (deixado como
--    rodotrem dentro da mesma transação) e desfazem tudo no final (rollback).
--    Em cada teste: Alimentício de R$ 10.000,00, com datas, placa e KMs (passo 14).
--    Se a RLS recusar o id de teste, troque 'AJB-TESTE-P15' por um número reservado.
-- =============================================================================

-- 2.1 Teste A: rodotrem, origem Marília - SP, destino Viana - ES (esperado: comissoes=800,00 | veiculos=rodotrem | vr_comissao=800.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P15', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Viana - ES', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "05/10/2026", "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Viana - ES","valor":"10.000,00","veiculo":"rodotrem"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2);
end $$;
rollback;

-- 2.2 Teste B: rodotrem, origem Viana - ES, destino Cravinhos - SP (esperado: comissoes=900,00 | veiculos=rodotrem | vr_comissao=900.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P15', 'teste', 'ABC-1D23', 'pendente', 'Viana - ES', 'Cravinhos - SP', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "05/10/2026", "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Viana - ES","destino":"Cravinhos - SP","valor":"10.000,00","veiculo":"rodotrem"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2);
end $$;
rollback;

-- 2.3 Teste C: rodotrem com especial de rodotrem 10,5, destino Viana - ES (esperado: comissoes=1.050,00 | veiculos=rodotrem | vr_comissao=1050.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_carreta = null, comissao_alim_rodotrem = 10.5
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P15', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Viana - ES', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "05/10/2026", "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Viana - ES","valor":"10.000,00","veiculo":"rodotrem"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2);
end $$;
rollback;

-- 2.4 Teste D: rodotrem, linha marcada carreta, destino Viana - ES (esperado: comissoes=1.100,00 | veiculos=carreta | vr_comissao=1100.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, data_saida, data_chegada, dados_completos)
  values ('AJB-TESTE-P15', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Viana - ES', 500, '2026-10-01', '2026-10-05', '{"kmSaida": "100000", "kmEntrada": "101500", "dataSaida": "01/10/2026", "dataChegada": "05/10/2026", "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Viana - ES","valor":"10.000,00","veiculo":"carreta"}]}'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2);
end $$;
rollback;
