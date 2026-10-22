-- =============================================================================
-- PASSO 13 - Comissão do motorista calculada pelo banco e veículo de cada frete
-- AJBorges Transporte & Logística
--
-- 1. perfis ganha tipo_veiculo ('carreta' | 'rodotrem' | 'carreta_rodotrem') e
--    as comissões especiais do Alimentício por veículo (carreta e rodotrem).
--    Só o servidor (edge function gerenciar-frota) e o admin mudam essas colunas.
-- 2. RPC veiculo_do_motorista(p_id) para a ficha saber o tipo e as comissões.
-- 3. Helpers _moeda, _eh_viana_es e _moeda_txt.
-- 4. _limpar_fretes com 5 parâmetros: valor, descarga e veículo limpos e a
--    comissão SEMPRE calculada pela regra (o que o motorista mandar é ignorado):
--      Mercado Livre  R$ 400,00
--      Shopee         11% do valor
--      Alimentício    linha "rodotrem": especial de rodotrem do motorista; senão
--                     8% com origem Viana (ES) e 9% nas outras origens
--                     linha "carreta": especial de carreta do motorista; senão 11%
--    Sem valor (vazio ou zero), a comissão fica vazia.
--    A versão de 2 parâmetros continua existindo (não é mais usada pelo trigger).
-- 5. proteger_colunas_admin_fichas (parte do motorista): lê o perfil também no
--    UPDATE, grava destinos e adiantamento, calcula total_frete, vr_comissao e
--    saldo_comissao e recusa o envio de Alimentício sem veículo (rodotrem).
-- 6. listar_motoristas_frota passa a devolver o tipo e as comissões especiais.
--
-- Não muda: admin continua livre; placas, KMs, abastecimentos, despesas,
-- comprovantes, status e as outras regras do passo 12.
--
-- Rodar no SQL Editor do Supabase até o "commit;". Tudo roda numa transação
-- (begin ... commit): se algo falhar, nada é alterado. Pode ser reexecutado.
-- As conferências ficam depois do commit: rode cada uma separadamente.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. perfis: tipo de veículo e comissões especiais do Alimentício
--    Vazio = segue a regra normal daquele veículo.
-- -----------------------------------------------------------------------------
alter table public.perfis add column if not exists tipo_veiculo text not null default 'carreta';
alter table public.perfis add column if not exists comissao_alim_carreta numeric(5,2);
alter table public.perfis add column if not exists comissao_alim_rodotrem numeric(5,2);

alter table public.perfis drop constraint if exists perfis_tipo_veiculo_check;
alter table public.perfis add constraint perfis_tipo_veiculo_check
  check (tipo_veiculo in ('carreta', 'rodotrem', 'carreta_rodotrem'));

alter table public.perfis drop constraint if exists perfis_comissao_alim_carreta_check;
alter table public.perfis add constraint perfis_comissao_alim_carreta_check
  check (comissao_alim_carreta between 0 and 100);

alter table public.perfis drop constraint if exists perfis_comissao_alim_rodotrem_check;
alter table public.perfis add constraint perfis_comissao_alim_rodotrem_check
  check (comissao_alim_rodotrem between 0 and 100);


-- -----------------------------------------------------------------------------
-- 1.1 proteger_colunas_frota (passo 9) + as três colunas novas
--     Quem não é admin nem o servidor não muda tipo_veiculo nem as comissões
--     do próprio perfil: os valores antigos são mantidos.
--     Mudança em relação ao passo 9 marcada com "passo 13".
-- -----------------------------------------------------------------------------
create or replace function public.proteger_colunas_frota()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if (new.vinculo is distinct from old.vinculo
      or new.senha_provisoria is distinct from old.senha_provisoria)
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not coalesce(public.is_admin(), false) then
    raise exception 'Acesso negado.';
  end if;
  -- passo 13: tipo de veículo e comissões especiais continuam como estavam
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not coalesce(public.is_admin(), false) then
    new.tipo_veiculo           := old.tipo_veiculo;
    new.comissao_alim_carreta  := old.comissao_alim_carreta;
    new.comissao_alim_rodotrem := old.comissao_alim_rodotrem;
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_colunas_frota() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. RPC veiculo_do_motorista(p_id) - só leitura
--    Motorista: sempre o próprio perfil (p_id é ignorado).
--    Admin/diretoria: o perfil de p_id (null = o próprio).
-- -----------------------------------------------------------------------------
create or replace function public.veiculo_do_motorista(p_id uuid default null)
returns table (
  tipo_veiculo text,
  comissao_alim_carreta numeric,
  comissao_alim_rodotrem numeric
)
language sql
stable
security definer
set search_path to ''
as $$
  select p.tipo_veiculo::text, p.comissao_alim_carreta::numeric, p.comissao_alim_rodotrem::numeric
    from public.perfis p
   where p.id = case when p_id is not null and coalesce(public.is_admin(), false)
                     then p_id else auth.uid() end;
$$;

revoke all on function public.veiculo_do_motorista(uuid) from public, anon;
grant execute on function public.veiculo_do_motorista(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------

-- _moeda(p): "1.234,56", "1234,56", "R$ 1.234,56", "1234" ou número (1234.56).
-- Até 9 dígitos inteiros e 2 decimais; qualquer outra coisa vira null.
create or replace function public._moeda(p jsonb)
returns numeric
language sql
immutable
set search_path to ''
as $$
  select case
           when jsonb_typeof(p) = 'number' then
             case when t ~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then t::numeric end
           when jsonb_typeof(p) = 'string' then
             case when t ~ '^[0-9]{1,3}(\.[0-9]{3}){0,2}(,[0-9]{1,2})?$'
                    or t ~ '^[0-9]{1,9}(,[0-9]{1,2})?$'
                  then replace(replace(t, '.', ''), ',', '.')::numeric end
         end
  from (select regexp_replace(
                 regexp_replace(coalesce(p #>> '{}', ''), '^[[:space:]' || chr(160) || ']*R\$', '', 'i'),
                 '[[:space:]' || chr(160) || ']', '', 'g') as t) s;
$$;

-- _eh_viana_es(p): origem é Viana (ES)? Sem acento, sem diferenciar maiúsculas
-- e sem espaços sobrando. Vale "Viana", "Viana/ES", "Viana - ES", "Viana ES" e
-- "Viana, ES". Outro estado (ex.: "Viana/MA") não vale.
-- Mesma regra de ehVianaES() em JavaScript/relatorio.js.
create or replace function public._eh_viana_es(p text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select coalesce(t ~ '^viana([[:space:]]*[/,-][[:space:]]*es|[[:space:]]+es)?$', false)
  from (select btrim(regexp_replace(lower(translate(coalesce(p, ''),
                 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
                 '[[:space:]]+', ' ', 'g')) as t) s;
$$;

-- _moeda_txt(n): número no formato da ficha ("1.234,56"); null continua null.
create or replace function public._moeda_txt(n numeric)
returns text
language sql
immutable
set search_path to ''
as $$
  select translate(to_char(round(n, 2), 'FM999,999,999,990.00'), ',.', '.,');
$$;


-- -----------------------------------------------------------------------------
-- 4. _limpar_fretes(p_novo, p_antigo, p_tipo, p_com_carreta, p_com_rodotrem)
--    Até 8 linhas, só objetos. p_antigo fica na assinatura (igual à de 2
--    parâmetros), mas o valor e a descarga agora vêm do motorista.
--    veiculo: só 'carreta' | 'rodotrem'. Motorista 'carreta' = sempre 'carreta';
--    'rodotrem' ou 'carreta_rodotrem' sem escolha válida = null (a linha de
--    Alimentício fica sem comissão e o envio é recusado no trigger).
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
                                     case when public._eh_viana_es(public._txt(n -> 'origem') #>> '{}')
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


-- -----------------------------------------------------------------------------
-- 5. proteger_colunas_admin_fichas: cópia do passo 12, mudando só a parte do
--    motorista. Mudanças em relação ao passo 12 estão marcadas com "passo 13".
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
  v_dc := v_antigo_dc || jsonb_build_object(
            'placas',         v_placa,
            'abastecimentos', v_abast,
            'fretes',         v_fretes,
            'outrasDespesas', v_despesas,
            'despesas_extras',v_despesas,
            'anexos',         v_anexos,
            'comprovantes',   v_anexos) || v_km || v_fin;

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
    new := jsonb_populate_record(old, jsonb_build_object(
             'status',          new.status,
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


-- -----------------------------------------------------------------------------
-- 6. listar_motoristas_frota(): + tipo_veiculo e comissões especiais
--    Versão atual (passo 9) devolve: id, nome, cpf, telefone, email, tem_email,
--    status, senha_provisoria, senha_alterada_em, ultimo_acesso, criado_em.
--    A nova devolve tudo isso e, no fim, tipo_veiculo, comissao_alim_carreta e
--    comissao_alim_rodotrem. Mudar as colunas de saída exige drop + create.
-- -----------------------------------------------------------------------------
drop function if exists public.listar_motoristas_frota();

create function public.listar_motoristas_frota()
returns table (
  id uuid,
  nome text,
  cpf text,
  telefone text,
  email text,
  tem_email boolean,
  status text,
  senha_provisoria boolean,
  senha_alterada_em timestamptz,
  ultimo_acesso timestamptz,
  criado_em timestamptz,
  tipo_veiculo text,
  comissao_alim_carreta numeric,
  comissao_alim_rodotrem numeric
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Acesso negado.';
  end if;

  return query
    select p.id::uuid,
           p.nome::text,
           p.cpf::text,
           p.telefone::text,
           p.email::text,
           (p.email is not null and lower(p.email::text) not like '%@sem-email.ajborges.com.br'),
           p.status::text,
           p.senha_provisoria,
           p.senha_alterada_em::timestamptz,
           u.last_sign_in_at::timestamptz,
           u.created_at::timestamptz,
           p.tipo_veiculo::text,
           p.comissao_alim_carreta::numeric,
           p.comissao_alim_rodotrem::numeric
      from public.perfis p
      left join auth.users u on u.id = p.id
     where p.role = 'motorista'
       and p.vinculo = 'frota'
     order by p.nome;
end;
$$;

revoke all on function public.listar_motoristas_frota() from public, anon;
grant execute on function public.listar_motoristas_frota() to authenticated;


commit;


-- =============================================================================
-- 7. Conferência (depois do commit; rode cada bloco separadamente)
--    Os testes rodam como o primeiro perfil com role = 'motorista': o perfil é
--    ajustado dentro da mesma transação e tudo é desfeito no final (rollback).
--    Em cada teste: fretes de R$ 10.000,00, adiantamento de R$ 500,00 e destinos
--    preenchidos (saldo_comissao = vr_comissao - 500).
--    Se a RLS recusar o id de teste, troque 'AJB-TESTE-P13' por um número reservado.
-- =============================================================================

-- 7.1 Colunas novas em perfis (esperado: tipo_veiculo text not null default 'carreta'; as duas comissões numeric null)
select column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'perfis'
   and column_name in ('tipo_veiculo', 'comissao_alim_carreta', 'comissao_alim_rodotrem')
 order by column_name;

-- 7.2 Helpers (esperado: 1234.56 | 1234.56 | 1234.56 | 1234.56 | null | t | t | t | t | t | f | 1.234,56)
select public._moeda('"1.234,56"') as m1, public._moeda('"1234,56"') as m2, public._moeda('"R$ 1.234,56"') as m3,
       public._moeda('1234.56') as m4, public._moeda('"12,345"') as m5,
       public._eh_viana_es('Viana') as v1, public._eh_viana_es('viana/es') as v2, public._eh_viana_es(' Viana - ES ') as v3,
       public._eh_viana_es('VIANA ES') as v4, public._eh_viana_es('Viana, ES') as v5, public._eh_viana_es('Viana/MA') as v6,
       public._moeda_txt(1234.56) as t1;

-- 7.3 Teste A: carreta, Alimentício (esperado: comissoes=1.100,00 | veiculos=carreta | vr_comissao=1100.00 | saldo_comissao=600.00 | total_frete=10000.00 | destinos=Marília - SP > Santos - SP | adiantamento=500.00)
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
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.4 Teste B: rodotrem, Alimentício "Viana - ES" + "Marília/SP", as duas linhas rodotrem (esperado: comissoes=800,00 + 900,00 | veiculos=rodotrem + rodotrem | vr_comissao=1700.00 | saldo_comissao=1200.00 | total_frete=20000.00 | destinos=Viana - ES > Marília - SP | adiantamento=500.00)
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
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Viana - ES', 'Marília - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Viana - ES","destino":"Marília - SP","valor":"10.000,00","veiculo":"rodotrem"},
                      {"data":"02/10/2026","cliente":"alimenticio","origem":"Marília/SP","destino":"Viana - ES","valor":"10.000,00","veiculo":"rodotrem"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.5 Teste C: rodotrem, Alimentício "Viana - ES" com a linha marcada carreta (esperado: comissoes=1.100,00 | veiculos=carreta | vr_comissao=1100.00 | saldo_comissao=600.00 | total_frete=10000.00 | destinos=Viana - ES > Santos - SP | adiantamento=500.00)
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
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Viana - ES', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Viana - ES","destino":"Santos - SP","valor":"10.000,00","veiculo":"carreta"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.6 Teste D: rodotrem + especial de rodotrem 10,5; "Viana - ES" rodotrem + linha carreta (esperado: comissoes=1.050,00 + 1.100,00 | veiculos=rodotrem + carreta | vr_comissao=2150.00 | saldo_comissao=1650.00 | total_frete=20000.00 | destinos=Viana - ES > Santos - SP | adiantamento=500.00)
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
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Viana - ES', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Viana - ES","destino":"Marília - SP","valor":"10.000,00","veiculo":"rodotrem"},
                      {"data":"02/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00","veiculo":"carreta"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.7 Teste E: carreta + especial de carreta 6, Alimentício (esperado: comissoes=600,00 | veiculos=carreta | vr_comissao=600.00 | saldo_comissao=100.00 | total_frete=10000.00 | destinos=Marília - SP > Santos - SP | adiantamento=500.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = 6, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.8 Teste F: Shopee + Mercado Livre (esperado: comissoes=1.100,00 + 400,00 | veiculos=carreta + carreta | vr_comissao=1500.00 | saldo_comissao=1000.00 | total_frete=20000.00 | destinos=Marília - SP > Santos - SP | adiantamento=500.00)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta', comissao_alim_carreta = 6, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"shopee","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00"},
                      {"data":"02/10/2026","cliente":"mercado_livre","origem":"Santos - SP","destino":"Marília - SP","valor":"10.000,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.9 Teste G: carreta_rodotrem, Alimentício sem veículo (esperado: erro "Escolha o veículo (carreta ou rodotrem) em cada frete do Alimentício."; se aparecer RESULTADO, a regra falhou)
begin;
select set_config('request.jwt.claims',
         (select json_build_object('sub', id, 'role', 'authenticated')::text
            from public.perfis where role = 'motorista' limit 1), true);
update public.perfis set tipo_veiculo = 'carreta_rodotrem', comissao_alim_carreta = null, comissao_alim_rodotrem = null
 where id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
set local role authenticated;
do $$
declare r record;
begin
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f), r.vr_comissao;
end $$;
rollback;

-- 7.10 Teste G2: rodotrem, Alimentício sem veículo (esperado: erro "Escolha o veículo (carreta ou rodotrem) em cada frete do Alimentício."; se aparecer RESULTADO, a regra falhou)
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
  insert into public.fichas_viagem (id, motorista, placas, status, destino_inicial, destino_final, valor_adiantamento, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', 'Marília - SP', 'Santos - SP', 500, '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | vr_comissao=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f), r.vr_comissao;
end $$;
rollback;

-- 7.11 Teste H: carreta, motorista manda "comissao": "9999,00" e os campos só em dados_completos (esperado: comissoes=1.100,00 | veiculos=carreta | vr_comissao=1100.00 | saldo_comissao=600.00 | total_frete=10000.00 | destinos=Marília - SP > Santos - SP | adiantamento=500.00)
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
  insert into public.fichas_viagem (id, motorista, placas, status, dados_completos)
  values ('AJB-TESTE-P13', 'teste', 'ABC-1D23', 'pendente', '{
           "kmSaida": "100000", "kmEntrada": "101500",
           "destinoInicial": "Marília - SP", "destinoFinal": "Santos - SP", "valorAdiantamento": "500,00",
           "vrComissao": "99.999,00", "totalFrete": "1,00",
           "fretes": [{"data":"01/10/2026","cliente":"alimenticio","origem":"Marília - SP","destino":"Santos - SP","valor":"10.000,00","comissao":"9999,00"}]
         }'::jsonb)
  returning * into r;
  raise exception 'RESULTADO (nada foi salvo): comissoes=% | veiculos=% | vr_comissao=% | saldo_comissao=% | total_frete=% | destinos=% > % | adiantamento=%',
    (select string_agg(f ->> 'comissao', ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    (select string_agg(coalesce(f ->> 'veiculo', '(vazio)'), ' + ') from jsonb_array_elements(r.dados_completos -> 'fretes') f),
    r.vr_comissao::numeric(14,2), r.saldo_comissao::numeric(14,2), r.total_frete::numeric(14,2),
    r.destino_inicial, r.destino_final, r.valor_adiantamento::numeric(14,2);
end $$;
rollback;

-- 7.12 Motorista não muda o próprio tipo de veículo (esperado: tipo=carreta | rodotrem=<null>; se aparecer tipo=rodotrem, a proteção falhou)
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
  update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_rodotrem = 50
   where id = auth.uid();
  select * into r from public.veiculo_do_motorista();
  raise exception 'RESULTADO (nada foi salvo): tipo=% | rodotrem=%', r.tipo_veiculo, r.comissao_alim_rodotrem;
end $$;
rollback;

-- 7.13 Motoristas de rodotrem para conferir (só leitura). Defina o tipo de cada um pelo dashboard.
select id, nome, cpf, tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem
from public.perfis
where vinculo = 'frota' and (
  nome ilike '%elder%' or nome ilike '%adriano%' or nome ilike '%junior%' or nome ilike '%júnior%'
  or nome ilike '%milton%' or nome ilike '%fabio%' or nome ilike '%fábio%' or nome ilike '%jorge rodrigo%'
  or nome ilike '%luiz aguiar%' or nome ilike '%clovis%' or nome ilike '%clóvis%')
order by nome;
