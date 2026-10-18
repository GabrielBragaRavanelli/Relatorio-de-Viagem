-- =============================================================================
-- PASSO 10 - Esteira de Terceiros e Agregados (sem login)
-- AJBorges Transporte & Logística
--
-- Terceiros e agregados não possuem login nem acessam fichas de viagem.
-- Este passo prepara o banco de dados para a gestão:
--   1. Registrar as etapas de homologação (GR, Shopee e Base);
--   2. Adicionar documentos extras de forma segura (consultas GR, CNH atualizada);
--   3. Remover documentos extras sem afetar os documentos originais do cadastro.
--
-- Rodar no SQL Editor do Supabase. Tudo roda numa transação (begin ... commit):
-- se algo falhar, nada é alterado. Pode ser reexecutado com segurança.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. Coluna public.cadastros_agregados.etapas
--    Registra o progresso das homologações internas: GR, Shopee e Base.
--    Formato JSONB:
--    {
--      "gr":     { "feito": true, "em": "2026-10-17T12:00:00Z", "por": "admin@ajborges.com" },
--      "shopee": { "feito": true, "em": "2026-10-17T12:30:00Z", "por": "admin@ajborges.com" },
--      "base":   { "feito": true, "em": "2026-10-17T13:00:00Z", "por": "admin@ajborges.com" }
--    }
-- -----------------------------------------------------------------------------
alter table public.cadastros_agregados
  add column if not exists etapas jsonb not null default '{}'::jsonb;


-- -----------------------------------------------------------------------------
-- 2. RPC marcar_etapa_cadastro(p_id, p_etapa, p_feito)
--    Marca ou desmarca uma das 3 etapas permitidas ('gr', 'shopee', 'base').
--    Registra quem marcou (e-mail do admin logado) e quando (now()).
--    Segurança:
--      - Execução restrita a administradores (public.is_admin()).
--      - Security Definer com search_path seguro para evitar sequestro.
--      - Permissão revogada de anon e liberada apenas para authenticated.
-- -----------------------------------------------------------------------------
create or replace function public.marcar_etapa_cadastro(
  p_id uuid,
  p_etapa text,
  p_feito boolean
)
returns public.cadastros_agregados
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_etapa text;
  v_nova_etapa jsonb;
  v_linha public.cadastros_agregados;
begin
  -- 1) Validação de privilégio administrativo
  if not coalesce(public.is_admin(), false) then
    raise exception 'Acesso negado.';
  end if;

  -- 2) Validação estrita da etapa
  v_etapa := lower(trim(coalesce(p_etapa, '')));
  if v_etapa not in ('gr', 'shopee', 'base') then
    raise exception 'Etapa inválida. Permitidas: gr, shopee, base.';
  end if;

  -- 3) Monta o objeto da etapa com auditoria
  v_nova_etapa := jsonb_build_object(
    'feito', coalesce(p_feito, false),
    'em', now(),
    'por', coalesce(auth.jwt()->>'email', 'admin')
  );

  -- 4) Atualiza o campo etapas no cadastro
  update public.cadastros_agregados
     set etapas = jsonb_set(coalesce(etapas, '{}'::jsonb), array[v_etapa], v_nova_etapa, true)
   where id = p_id
  returning * into v_linha;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  return v_linha;
end;
$$;

revoke all on function public.marcar_etapa_cadastro(uuid, text, boolean) from public, anon;
grant execute on function public.marcar_etapa_cadastro(uuid, text, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. RPC adicionar_documento_extra(p_id, p_path, p_nome, p_tipo, p_tamanho, p_descricao)
--    Insere um documento extra (consulta GR, certidão, anexo posterior) na
--    lista documentos do cadastro.
--    Segurança e Validações:
--      - Apenas administradores (public.is_admin()).
--      - O caminho (path) precisa obrigatoriamente iniciar com terceiros/{p_id}/extra_
--      - Tipos restritos a PDF, PNG ou JPEG.
--      - Tamanho máximo limitado a 10 MB.
--      - Sanitização contra XSS no nome e descrição (remove < > " ' ` \).
--      - Descrição limitada a no máximo 200 caracteres.
-- -----------------------------------------------------------------------------
create or replace function public.adicionar_documento_extra(
  p_id uuid,
  p_path text,
  p_nome text,
  p_tipo text,
  p_tamanho bigint,
  p_descricao text
)
returns public.cadastros_agregados
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tipo text;
  v_nome text;
  v_desc text;
  v_doc jsonb;
  v_linha public.cadastros_agregados;
begin
  -- 1) Validação de privilégio administrativo
  if not coalesce(public.is_admin(), false) then
    raise exception 'Acesso negado.';
  end if;

  -- 2) Validação estrita do caminho de armazenamento
  if p_path is null or not (p_path like ('terceiros/' || p_id::text || '/extra_%')) then
    raise exception 'Caminho de arquivo inválido. Deve iniciar com terceiros/%/extra_', p_id;
  end if;

  -- 3) Validação e normalização de tipo MIME / extensão
  v_tipo := lower(trim(coalesce(p_tipo, '')));
  if v_tipo = 'application/pdf' then v_tipo := 'pdf'; end if;
  if v_tipo in ('image/png', 'image/x-png') then v_tipo := 'png'; end if;
  if v_tipo in ('image/jpeg', 'image/jpg', 'jpg') then v_tipo := 'jpeg'; end if;

  if v_tipo not in ('pdf', 'png', 'jpeg') then
    raise exception 'Tipo de arquivo inválido. Permitidos: PDF, PNG ou JPEG.';
  end if;

  -- 4) Validação de tamanho (máximo 10 MB)
  if coalesce(p_tamanho, 0) <= 0 or p_tamanho > 10 * 1024 * 1024 then
    raise exception 'Tamanho de arquivo inválido (máximo 10 MB).';
  end if;

  -- 5) Sanitização do nome e descrição
  v_nome := trim(regexp_replace(coalesce(p_nome, 'documento'), '[<>"''`\\]', '', 'g'));
  if v_nome = '' then v_nome := 'documento_extra'; end if;

  v_desc := trim(regexp_replace(coalesce(p_descricao, ''), '[<>"''`\\]', '', 'g'));
  if length(v_desc) > 200 then
    v_desc := substr(v_desc, 1, 200);
  end if;

  -- 6) Monta o objeto do documento extra
  v_doc := jsonb_build_object(
    'campo', 'extra',
    'nome', v_nome,
    'tipo', v_tipo,
    'tamanho', p_tamanho,
    'path', p_path,
    'descricao', v_desc,
    'enviado_por', coalesce(auth.jwt()->>'email', 'admin'),
    'enviado_em', now()
  );

  -- 7) Adiciona ao array JSONB existente
  update public.cadastros_agregados
     set documentos = coalesce(documentos, '[]'::jsonb) || jsonb_build_array(v_doc)
   where id = p_id
  returning * into v_linha;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  return v_linha;
end;
$$;

revoke all on function public.adicionar_documento_extra(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.adicionar_documento_extra(uuid, text, text, text, bigint, text) to authenticated;


-- -----------------------------------------------------------------------------
-- 4. RPC remover_documento_extra(p_id, p_path)
--    Remove da lista documentos apenas o item com campo = 'extra' e caminho igual.
--    Nunca afeta documentos originais do motorista (CNH, CRLVs, RNTRC).
--    Segurança:
--      - Apenas administradores (public.is_admin()).
--      - O arquivo físico no bucket Storage é apagado separadamente pelo dashboard
--        através da política de storage para admins.
-- -----------------------------------------------------------------------------
create or replace function public.remover_documento_extra(
  p_id uuid,
  p_path text
)
returns public.cadastros_agregados
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_linha public.cadastros_agregados;
begin
  -- 1) Validação de privilégio administrativo
  if not coalesce(public.is_admin(), false) then
    raise exception 'Acesso negado.';
  end if;

  if p_path is null or trim(p_path) = '' then
    raise exception 'Caminho do documento não informado.';
  end if;

  -- 2) Filtra o array JSONB removendo somente o item 'extra' com este path
  update public.cadastros_agregados
     set documentos = coalesce((
       select jsonb_agg(elem)
         from jsonb_array_elements(coalesce(documentos, '[]'::jsonb)) as elem
        where not (elem->>'campo' = 'extra' and elem->>'path' = trim(p_path))
     ), '[]'::jsonb)
   where id = p_id
  returning * into v_linha;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  return v_linha;
end;
$$;

revoke all on function public.remover_documento_extra(uuid, text) from public, anon;
grant execute on function public.remover_documento_extra(uuid, text) to authenticated;


commit;


-- -----------------------------------------------------------------------------
-- 5. Conferência (rode separadamente depois do commit)
-- -----------------------------------------------------------------------------
-- 1. Conferir coluna etapas em cadastros_agregados:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'cadastros_agregados'
--      and column_name = 'etapas';
--
-- 2. Conferir permissões das RPCs novas (authenticated tem execute, anon não tem):
--   select p.proname, array_agg(distinct r.rolname) as pode_executar
--     from pg_proc p
--     join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute')
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('marcar_etapa_cadastro', 'adicionar_documento_extra', 'remover_documento_extra')
--      and r.rolname in ('anon', 'authenticated', 'service_role')
--    group by p.proname;
--
-- 3. Conferir se cadastros existentes carregam com o default '{}'::jsonb:
--   select id, nome, status, etapas from public.cadastros_agregados limit 5;
