-- =============================================================================
-- REFERÊNCIA (somente leitura): definições atuais das funções que protegem a
-- tabela fichas_viagem. Montado a partir dos scripts já aplicados no Supabase
-- (passo2_seguranca, passo3_banco, passo4_comissao_ml). NÃO rodar este arquivo:
-- ele serve só para consulta ao escrever o passo11.
-- Se houver dúvida se o banco está igual, confira com:
--   select pg_get_functiondef('public.<nome>'::regproc);
-- =============================================================================

-- ---------- proteger_colunas_admin_fichas  (origem: passo2_seguranca.sql) ----------
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

  -- dados_completos = o que já estava no banco + só as partes do motorista
  v_dc := v_antigo_dc || jsonb_build_object(
            'abastecimentos', v_abast,
            'fretes',         v_fretes,
            'outrasDespesas', v_despesas,
            'despesas_extras',v_despesas,
            'anexos',         v_anexos,
            'comprovantes',   v_anexos);

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
    new := jsonb_populate_record(new, v_nulos || jsonb_build_object(
             'motorista_id',    auth.uid(),
             'iniciada_em',     now(),
             'data_envio',      now(),
             'motorista',       v_perfil.nome,
             'motorista_cpf',   v_perfil.cpf,
             'origem_envio',    'motorista_com_login',
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc));
  else
    -- UPDATE: parte da linha antiga e troca só o que o motorista pode mexer
    new := jsonb_populate_record(old, jsonb_build_object(
             'status',          new.status,
             'abastecimentos',  v_abast,
             'comprovantes',    v_anexos,
             'despesas_extras', v_despesas,
             'dados_completos', v_dc || jsonb_build_object('status', new.status)));
  end if;

  return new;
end;
$function$;

-- ---------- _limpar_abastecimentos  (origem: passo2_seguranca.sql) ----------
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
           'litros', public._txt(e -> 'litros', 20)
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
       with ordinality as t(e, i)
  where i <= 10 and jsonb_typeof(e) = 'object';
$$;

-- ---------- _limpar_fretes  (origem: passo4_comissao_ml.sql) ----------
create or replace function public._limpar_fretes(p_novo jsonb, p_antigo jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'data',     public._txt(n -> 'data', 20),
           'cliente',  public._txt(n -> 'cliente', 60),
           'origem',   public._txt(n -> 'origem'),
           'destino',  public._txt(n -> 'destino'),
           'valor',    coalesce(o -> 'valor', '""'::jsonb),
           'comissao', case
                         when coalesce(o ->> 'comissao', '') <> '' then o -> 'comissao'
                         when (n ->> 'cliente') = 'mercado_livre'  then '"400,00"'::jsonb
                         else '""'::jsonb
                       end,
           'descarga', coalesce(o -> 'descarga', '""'::jsonb)
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_novo) = 'array' then p_novo else '[]'::jsonb end)
       with ordinality as t(n, i)
  left join jsonb_array_elements(case when jsonb_typeof(p_antigo) = 'array' then p_antigo else '[]'::jsonb end)
       with ordinality as u(o, j) on j = i
  where i <= 8 and jsonb_typeof(n) = 'object';
$$;

-- ---------- _limpar_outras_despesas  (origem: passo2_seguranca.sql) ----------
create or replace function public._limpar_outras_despesas(p_novo jsonb, p_antigo jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select jsonb_build_array(
    jsonb_build_object('desc', 'Imposto Federal',
                       'valor', coalesce(p_antigo -> 0 -> 'valor', '""'::jsonb)),
    jsonb_build_object('desc',  public._txt(p_novo -> 1 -> 'desc', 200),
                       'valor', public._txt(p_novo -> 1 -> 'valor', 20)),
    jsonb_build_object('desc',  public._txt(p_novo -> 2 -> 'desc', 200),
                       'valor', public._txt(p_novo -> 2 -> 'valor', 20))
  );
$$;

-- ---------- _limpar_comprovantes  (origem: passo3_banco.sql) ----------
create or replace function public._limpar_comprovantes(p jsonb)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', public._txt(e -> 'name', 120),
           'size', case when jsonb_typeof(e -> 'size') = 'number' then e -> 'size' else '0'::jsonb end,
           'type', public._txt(e -> 'type', 60),
           'path', to_jsonb(e ->> 'path')
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
       with ordinality as t(e, i)
  where i <= 30
    and jsonb_typeof(e) = 'object'
    and (e ->> 'path') like (auth.uid()::text || '/%')
    and (e ->> 'path') !~ '\.\.';
$$;

-- ---------- _txt  (origem: passo3_banco.sql) ----------
create or replace function public._txt(p jsonb, p_max int default 120)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select to_jsonb(left(
           translate(coalesce(case when jsonb_typeof(p) in ('string','number') then p #>> '{}' end, ''),
                     '<>"''`', ''),
           p_max));
$$;