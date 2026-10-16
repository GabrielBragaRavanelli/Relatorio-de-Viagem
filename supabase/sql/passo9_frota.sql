-- =============================================================================
-- PASSO 9 - Motoristas de FROTA (ficha de viagem)
-- AJBorges Transporte & Logística
--
-- A ficha de viagem passa a ser só para motoristas de frota (contratados).
-- Este passo prepara a tabela perfis para a gestão cadastrar a frota pelo
-- dashboard (edge function gerenciar-frota), com senha provisória que o
-- motorista troca no primeiro acesso.
--
-- Rodar no SQL Editor do Supabase. Tudo roda numa transação: se uma parte
-- falhar, nada é aplicado. Pode ser rodado de novo sem duplicar nada.
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1. perfis.vinculo
--    'frota' = motorista contratado, cadastrado pela gestão.
--    null    = qualquer outro (terceiros/agregados, admin, diretoria).
--    Só motorista com vinculo = 'frota' entra na ficha de viagem (edge function login).
-- -----------------------------------------------------------------------------
alter table public.perfis add column if not exists vinculo text;

alter table public.perfis drop constraint if exists perfis_vinculo_check;
alter table public.perfis add constraint perfis_vinculo_check check (vinculo in ('frota'));


-- -----------------------------------------------------------------------------
-- 2. perfis.senha_provisoria
--    true = a senha atual é conhecida pela gestão (senha padrão ou definida no
--    cadastro). Enquanto for true, a ficha mostra o aviso para o motorista
--    cadastrar o e-mail e criar uma senha só dele.
-- -----------------------------------------------------------------------------
alter table public.perfis add column if not exists senha_provisoria boolean not null default false;


-- -----------------------------------------------------------------------------
-- 3. Status 'inativo' (motorista que saiu da empresa)
--    O nome da constraint de status não é conhecido de antemão. Para conferir:
--      select conname, pg_get_constraintdef(oid)
--        from pg_constraint
--       where conrelid = 'public.perfis'::regclass and contype = 'c';
--    O bloco abaixo apaga as constraints de CHECK que citam "status" (mostra
--    cada uma em NOTICE) e cria perfis_status_check com os 4 valores.
-- -----------------------------------------------------------------------------
do $$
declare
  tipo text;
  r record;
begin
  select data_type into tipo
    from information_schema.columns
   where table_schema = 'public' and table_name = 'perfis' and column_name = 'status';
  if tipo = 'USER-DEFINED' then
    raise exception 'perfis.status é um ENUM: inclua o valor com "alter type <tipo> add value ''inativo'';" fora de transação e rode este arquivo de novo.';
  end if;

  for r in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.perfis'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    raise notice 'Removendo constraint % : %', r.conname, r.def;
    execute format('alter table public.perfis drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.perfis add constraint perfis_status_check
  check (status in ('pendente', 'aprovado', 'recusado', 'inativo'));


-- -----------------------------------------------------------------------------
-- 4. Troca de senha -> senha_provisoria = false
--    O trigger existente trg_registrar_troca_senha continua gravando
--    senha_alterada_em (o corpo dele não é alterado aqui). Este trigger novo,
--    no mesmo evento, só desliga a senha provisória.
--    A edge function gerenciar-frota (redefinir_senha) põe true de novo logo
--    depois de trocar a senha, porque aí a senha volta a ser a padrão.
-- -----------------------------------------------------------------------------
create or replace function public.desligar_senha_provisoria()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.perfis
     set senha_provisoria = false
   where id = new.id
     and senha_provisoria;
  return new;
end;
$$;

revoke all on function public.desligar_senha_provisoria() from public, anon, authenticated;

drop trigger if exists trg_desligar_senha_provisoria on auth.users;
create trigger trg_desligar_senha_provisoria
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.desligar_senha_provisoria();


-- -----------------------------------------------------------------------------
-- 5. E-mail do login -> perfis.email
--    O login por CPF usa perfis.email para entrar. Quando o motorista confirma
--    um e-mail novo (código "Change Email Address"), auth.users.email muda e
--    este trigger copia o valor para o perfil.
-- -----------------------------------------------------------------------------
create or replace function public.sincronizar_email_perfil()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.perfis
     set email = lower(new.email)
   where id = new.id;
  return new;
end;
$$;

revoke all on function public.sincronizar_email_perfil() from public, anon, authenticated;

drop trigger if exists trg_sincronizar_email_perfil on auth.users;
create trigger trg_sincronizar_email_perfil
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email and new.email is not null)
  execute function public.sincronizar_email_perfil();


-- -----------------------------------------------------------------------------
-- 6. Proteção das colunas novas
--    vinculo e senha_provisoria só mudam pelo servidor (edge functions com a
--    service role, triggers acima) ou por admin. Assim um usuário logado não
--    consegue se marcar como frota nem esconder o aviso de senha provisória,
--    mesmo que alguma política de RLS permita editar o próprio perfil.
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
  return new;
end;
$$;

revoke all on function public.proteger_colunas_frota() from public, anon, authenticated;

drop trigger if exists trg_proteger_colunas_frota on public.perfis;
create trigger trg_proteger_colunas_frota
  before update on public.perfis
  for each row
  execute function public.proteger_colunas_frota();


-- -----------------------------------------------------------------------------
-- 7. RPC listar_motoristas_frota() - lista da aba "Motoristas" do dashboard
--    Só admin (public.is_admin()). Nunca devolve senha.
--    tem_email = false quando o e-mail é o provisório @sem-email.ajborges.com.br.
--    ultimo_acesso e criado_em vêm de auth.users (perfis não tem criado_em).
-- -----------------------------------------------------------------------------
create or replace function public.listar_motoristas_frota()
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
  criado_em timestamptz
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
           u.created_at::timestamptz
      from public.perfis p
      left join auth.users u on u.id = p.id
     where p.role = 'motorista'
       and p.vinculo = 'frota'
     order by p.nome;
end;
$$;

revoke all on function public.listar_motoristas_frota() from public, anon;
grant execute on function public.listar_motoristas_frota() to authenticated;


-- -----------------------------------------------------------------------------
-- 8. RPC encerrar_sessoes_usuario(p_id) - derruba as sessões abertas
--    Usada pela edge function gerenciar-frota ao redefinir a senha e ao
--    desativar um motorista (auth.admin.signOut precisa do token do próprio
--    usuário, que a gestão não tem). Apagar de auth.sessions apaga também os
--    refresh tokens: o motorista não renova mais o acesso e cai no login
--    quando o token atual vencer (até 1 hora, o padrão do Supabase).
--    Só a service role executa (nem admin logado chama direto).
-- -----------------------------------------------------------------------------
create or replace function public.encerrar_sessoes_usuario(p_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  qtd integer;
begin
  delete from auth.sessions where user_id = p_id;
  get diagnostics qtd = row_count;
  return qtd;
end;
$$;

revoke all on function public.encerrar_sessoes_usuario(uuid) from public, anon, authenticated;
grant execute on function public.encerrar_sessoes_usuario(uuid) to service_role;


commit;


-- -----------------------------------------------------------------------------
-- 9. Conferência (rode separadamente depois do commit)
-- -----------------------------------------------------------------------------
-- Colunas novas em perfis (vinculo text null; senha_provisoria boolean default false):
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'perfis'
--      and column_name in ('vinculo', 'senha_provisoria');
--
-- Constraints de perfis (deve aparecer perfis_status_check com 'inativo' e perfis_vinculo_check):
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.perfis'::regclass and contype = 'c';
--
-- Triggers em auth.users (trg_registrar_troca_senha, trg_desligar_senha_provisoria,
-- trg_sincronizar_email_perfil, criar_perfil_novo_usuario...):
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- Trigger de proteção em perfis:
--   select tgname from pg_trigger
--    where tgrelid = 'public.perfis'::regclass and not tgisinternal;
--
-- RPC (no SQL Editor você é postgres, não admin logado: o esperado aqui é
-- "Acesso negado."; pelo dashboard, logado como admin, ela devolve a lista):
--   select * from public.listar_motoristas_frota();
--
-- Funções novas e quem pode executar (encerrar_sessoes_usuario: só service_role):
--   select p.proname, array_agg(distinct r.rolname) as pode_executar
--     from pg_proc p
--     join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute')
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('listar_motoristas_frota', 'encerrar_sessoes_usuario')
--      and r.rolname in ('anon', 'authenticated', 'service_role')
--    group by p.proname;
--
-- Para ver a lista no SQL Editor sem a RPC:
--   select id, nome, status, senha_provisoria, email from public.perfis
--    where role = 'motorista' and vinculo = 'frota' order by nome;
