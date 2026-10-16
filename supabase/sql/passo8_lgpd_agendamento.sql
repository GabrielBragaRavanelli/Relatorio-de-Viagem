-- =============================================================================
-- PASSO 8 - LGPD: limpeza automática dos cadastros recusados
-- AJBorges Transporte & Logística
--
-- Agenda a edge function "limpar-recusados" para rodar todo dia às 6h de
-- Brasília (09:00 UTC). Ela apaga os cadastros do "Seja um Agregado" recusados
-- há mais de 90 dias: ficha, documentos no Storage e conta de login.
--
-- Rodar no SQL Editor do Supabase. Pode ser rodado de novo sem duplicar o job.
--
-- ANTES DE RODAR:
--   1. Publique a função limpar-recusados com Verify JWT DESLIGADO.
--   2. Crie o secret CRON_SECRET nas Edge Functions (Edge Functions → Secrets).
--   3. Crie no Vault (Project Settings → Vault, ou Database → Vault) um segredo
--      chamado cron_secret, com o MESMO valor do CRON_SECRET.
--   Nunca cole o valor do segredo neste arquivo nem em nenhum chat.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensões
--    pg_cron: agendador de tarefas dentro do banco.
--    pg_net:  permite ao banco fazer requisições HTTP (chamar a edge function).
--    Se der erro de permissão, ligue as duas no painel em
--    Database → Extensions (procure "pg_cron" e "pg_net") e rode o arquivo de novo.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- -----------------------------------------------------------------------------
-- 2. Segredo no Vault
--    O job lê o segredo de vault.decrypted_secrets na hora de cada execução,
--    então o valor nunca fica gravado no texto do job (cron.job).
--    Este bloco só confere se o segredo cron_secret já foi criado no Vault;
--    se não foi, para aqui com uma mensagem, sem agendar nada.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'cron_secret') then
    raise exception 'Crie antes o segredo "cron_secret" no Vault (Project Settings → Vault), com o mesmo valor do CRON_SECRET das Edge Functions.';
  end if;
end
$$;


-- -----------------------------------------------------------------------------
-- 3. Remove o agendamento anterior, se já existir
--    Assim o arquivo pode ser rodado de novo sem criar um job duplicado.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpar-recusados-lgpd') then
    perform cron.unschedule('limpar-recusados-lgpd');
  end if;
end
$$;


-- -----------------------------------------------------------------------------
-- 4. Agendamento: todo dia às 09:00 UTC (6h de Brasília)
--    Formato do cron: minuto hora dia-do-mês mês dia-da-semana.
--    O header x-cron-secret é o que autoriza a chamada na edge function.
--    timeout_milliseconds: o padrão do pg_net é 5 s; um lote de 50 cadastros
--    pode levar mais que isso, então o limite sobe para 60 s.
-- -----------------------------------------------------------------------------
select cron.schedule(
  'limpar-recusados-lgpd',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://pnvjeismjgseooiyjjjb.supabase.co/functions/v1/limpar-recusados',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);


-- -----------------------------------------------------------------------------
-- 5. Conferência (rode estas consultas separadamente quando quiser)
-- -----------------------------------------------------------------------------
-- Jobs agendados (deve aparecer limpar-recusados-lgpd, schedule "0 9 * * *"):
--   select * from cron.job;
--
-- Últimas execuções do agendador (status "succeeded" = o banco disparou a chamada):
--   select * from cron.job_run_details order by start_time desc limit 5;
--
-- Respostas HTTP da função (status_code 200 e content {"apagados":N,"falhas":N}):
--   select * from net._http_response order by created desc limit 5;
