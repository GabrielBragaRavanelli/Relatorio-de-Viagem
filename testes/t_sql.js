// Roda supabase/sql/referencia_fichas_atual.sql + passo11 + passo12 num Postgres em WASM (PGlite),
// com auth.uid()/auth.jwt()/is_admin() simulados, e confere o trigger do motorista e da gestão.
// As conferências do passo 12 (depois do commit) também rodam, bloco a bloco, como estão no arquivo.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const RAIZ = process.env.RAIZ || path.resolve(__dirname, '..');
const ler = (a) => fs.readFileSync(path.join(RAIZ, a), 'utf8');

(async () => {
  const db = new PGlite();
  // Supabase simulado: usuário logado vem de teste.uid ou de request.jwt.claims (como no Supabase)
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('teste.uid', true), ''),
                      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('teste.email', true)) $$;
    create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('teste.admin', true), '') = 'sim' $$;
    create table public.perfis (id uuid primary key, nome text, cpf text, role text);
    insert into public.perfis values ('11111111-1111-1111-1111-111111111111', 'Motorista Teste', '12345678900', 'motorista');
    create table public.fichas_viagem (
      id text not null primary key, motorista text not null, motorista_cpf text, placas text,
      destino_inicial text, destino_final text, frete_origem text, status text, origem_envio text, aprovado_por text,
      data_envio timestamptz, aprovado_em timestamptz, iniciada_em timestamptz,
      data_saida date, data_chegada date,
      km_saida numeric, km_chegada numeric, km_total numeric, retorno_1 numeric, retorno_2 numeric, retorno_3 numeric,
      total_frete numeric, vr_comissao numeric, valor_adiantamento numeric, recibo_tm_1 numeric, saldo_comissao numeric, total_despesas numeric,
      abastecimentos jsonb, comprovantes jsonb, despesas_extras jsonb, dados_completos jsonb, motorista_id uuid
    );
    create role authenticated;
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
  `);
  await db.exec('set check_function_bodies = off;' + ler('supabase/sql/referencia_fichas_atual.sql') + ';set check_function_bodies = on;');
  await db.exec(`create trigger proteger_colunas_admin_fichas before insert or update on public.fichas_viagem
                 for each row execute function public.proteger_colunas_admin_fichas();`);
  await db.exec(ler('supabase/sql/passo11_ficha_motorista.sql'));
  // Passo 12: até o commit; roda duas vezes (tem que poder ser reexecutado)
  const p12 = ler('supabase/sql/passo12_placa_motorista.sql');
  const fimP12 = p12.indexOf('\ncommit;\n') + '\ncommit;\n'.length;
  await db.exec(p12.slice(0, fimP12));
  await db.exec(p12.slice(0, fimP12));

  const r = {};
  // Conferências do arquivo, como o usuário vai rodar no SQL Editor
  r.conferencias = {};
  const blocos = p12.slice(fimP12).split(/^(?=-- 2\.\d )/m).filter(b => /^-- 2\.\d /.test(b));
  for (const b of blocos) {
    const titulo = b.split('\n')[0].replace(/^-- /, '');
    try {
      const res = await db.exec(b);
      r.conferencias[titulo] = res.filter(x => x.rows.length).map(x => x.rows);
    } catch (e) {
      r.conferencias[titulo] = 'ERRO: ' + e.message;
      await db.exec('rollback').catch(() => {});
    }
  }

  // Motorista: INSERT com placa minúscula e totais falsos (totais devem ser ignorados)
  await db.exec(`select set_config('teste.uid', '11111111-1111-1111-1111-111111111111', false), set_config('teste.admin', 'nao', false)`);
  await db.query(`insert into public.fichas_viagem (id, motorista, placas, status, km_total, abastecimentos, dados_completos) values
    ('AJB-TESTE-P11', 'teste', 'abc-1d23', 'pendente', 999, $1::jsonb->'abastecimentos', $1)`, [{
      placas: 'abc-1d23', kmSaida: '100.000', kmEntrada: '101.500', placaSecundaria: 'XYZ-9A87', kmSaida2: '200000', kmEntrada2: '200.800',
      kmTotal: '999', kmTotal1: '999', kmTotal2: '999',
      abastecimentos: [
        { posto: 'Posto A', valor: '600,00', litros: '100', combustivel: 'diesel_s10', placa: 'principal' },
        { posto: 'Posto A', valor: '900,00', litros: '150', combustivel: 'diesel_s10', placa: 'principal' },
        { posto: 'Posto B', valor: '100,00', litros: '20', combustivel: 'arla', placa: 'secundaria' }],
      fretes: [{ data: '01/10/2026', cliente: 'mercado_livre', origem: 'A', destino: 'B', valor: '9.999,00', comissao: '1,00' }]
    }]);
  const linha = async () => (await db.query(`select placas, dados_completos->>'placas' dc_placas, km_saida::text, km_chegada::text, km_total::text, motorista,
      dados_completos->>'kmTotal1' t1, dados_completos->>'kmTotal2' t2, dados_completos->>'kmTotal' t,
      dados_completos->>'placaSecundaria' ps, dados_completos->>'kmSaida2' s2, status,
      (select string_agg(a->>'combustivel' || '/' || coalesce(a->>'placa','-'), ', ') from jsonb_array_elements(abastecimentos) a) abast,
      dados_completos->'fretes'->0->>'valor' frete_valor, dados_completos->'fretes'->0->>'comissao' frete_comissao
      from public.fichas_viagem where id = 'AJB-TESTE-P11'`)).rows[0];
  r.motoristaInsert = await linha();

  // Motorista: envios recusados (status 'pendente') — cada um devolve a mensagem do banco
  const tentar = async (placas, dc, status = 'pendente') => {
    try {
      await db.query(`update public.fichas_viagem set status = $3, placas = $1, dados_completos = $2 where id = 'AJB-TESTE-P11'`, [placas, dc, status]);
      return 'PASSOU';
    } catch (e) { return 'bloqueado: ' + e.message; }
  };
  const km1 = { kmSaida: '100000', kmEntrada: '101500' };
  r.recusas = {
    semPlaca: await tentar('', km1),
    placaInvalida: await tentar('AB-12', km1),
    secundariaInvalida: await tentar('ABC1D23', { ...km1, placaSecundaria: 'XX9' }),
    secundariaIgual: await tentar('ABC1D23', { ...km1, placaSecundaria: 'abc-1d23', kmSaida2: '1', kmEntrada2: '2' }),
    semKmPrincipal: await tentar('ABC1D23', { kmSaida: '100000' }),
    semKmSecundaria: await tentar('ABC1D23', { ...km1, placaSecundaria: 'XYZ9A87', kmSaida2: '200000' }),
    chegadaMenor: await tentar('ABC1D23', { kmSaida: '100000', kmEntrada: '99000' }),
    chegadaMenorSecundaria: await tentar('ABC1D23', { ...km1, placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '199000' })
  };
  r.depoisDasRecusas = await linha();

  // Rascunho: nada é bloqueado (sem placa, sem KM, chegada menor)
  r.rascunhoIncompleto = await tentar('', { kmSaida: '100000', kmEntrada: '99000', placaSecundaria: 'XYZ9A87' }, 'rascunho');
  r.rascunho = await linha();

  // Motorista: UPDATE (pendente) com outra placa e sem secundária = sem 2º trecho
  r.motoristaUpdate = await tentar('def-5g67', { kmSaida: '100000', kmEntrada: '101000', placaSecundaria: '', kmSaida2: '200000', kmEntrada2: '200800', abastecimentos: [] });
  r.motoristaUpdateLinha = await linha();

  // Gestão: grava tudo, inclusive a principal e os totais que mandar
  await db.exec(`select set_config('teste.admin', 'sim', false)`);
  await db.query(`update public.fichas_viagem set placas = 'ABC-1D23', km_total = 2400, dados_completos = dados_completos || '{"kmTotal":"2400"}'::jsonb where id = 'AJB-TESTE-P11'`);
  r.gestaoUpdate = await linha();

  // Motorista não pode aprovar
  await db.exec(`select set_config('teste.admin', 'nao', false)`);
  try { await db.query(`update public.fichas_viagem set status = 'aprovado' where id = 'AJB-TESTE-P11'`); r.motoristaAprovar = 'PASSOU (errado)'; }
  catch (e) { r.motoristaAprovar = 'bloqueado: ' + e.message; }

  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
