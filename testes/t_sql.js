// Roda supabase/sql/referencia_fichas_atual.sql + passo9 + passo11 + passo12 + passo13 + passo13b num Postgres em WASM
// (PGlite), com auth.uid()/auth.jwt()/is_admin() simulados, e confere o trigger do motorista e da gestão.
// As conferências do passo 12 e do passo 13 (depois do commit) também rodam, bloco a bloco, como estão no arquivo.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const RAIZ = process.env.RAIZ || path.resolve(__dirname, '..');
const ler = (a) => fs.readFileSync(path.join(RAIZ, a), 'utf8');
const ateCommit = (sql) => sql.slice(0, sql.indexOf('\ncommit;\n') + '\ncommit;\n'.length);

// Roda os blocos de conferência ("-- 2.1 ...", "-- 7.3 ...") um a um, como no SQL Editor
async function conferencias(db, sql, prefixo) {
  const saida = {};
  const resto = sql.slice(ateCommit(sql).length);
  const re = new RegExp(`^(?=-- ${prefixo}\\.\\d+ )`, 'm');
  const blocos = resto.split(re).filter(b => new RegExp(`^-- ${prefixo}\\.\\d+ `).test(b));
  for (const b of blocos) {
    const titulo = b.split('\n')[0].replace(/^-- /, '');
    try {
      const res = await db.exec(b);
      saida[titulo] = res.filter(x => x.rows.length).map(x => x.rows);
    } catch (e) {
      saida[titulo] = 'ERRO: ' + e.message;
      await db.exec('rollback').catch(() => {});
    }
  }
  return saida;
}

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
    create table auth.users (id uuid primary key, email text, encrypted_password text, last_sign_in_at timestamptz, created_at timestamptz default now());
    create table auth.sessions (id uuid primary key, user_id uuid);
    create table public.perfis (id uuid primary key, nome text, cpf text, role text, status text, email text, telefone text, senha_alterada_em timestamptz);
    insert into public.perfis values ('11111111-1111-1111-1111-111111111111', 'Motorista Teste', '12345678900', 'motorista', 'aprovado', 'frota.12345678900@sem-email.ajborges.com.br', '11999998888', null);
    insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'frota.12345678900@sem-email.ajborges.com.br');
    create table public.fichas_viagem (
      id text not null primary key, motorista text not null, motorista_cpf text, placas text,
      destino_inicial text, destino_final text, frete_origem text, status text, origem_envio text, aprovado_por text,
      data_envio timestamptz, aprovado_em timestamptz, iniciada_em timestamptz,
      data_saida date, data_chegada date,
      km_saida numeric, km_chegada numeric, km_total numeric, retorno_1 numeric, retorno_2 numeric, retorno_3 numeric,
      total_frete numeric, vr_comissao numeric, valor_adiantamento numeric default 0, recibo_tm_1 numeric, saldo_comissao numeric, total_despesas numeric,
      abastecimentos jsonb, comprovantes jsonb, despesas_extras jsonb, dados_completos jsonb, motorista_id uuid
    );
    create role authenticated;
    create role anon;
    create role service_role;
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
  `);
  await db.exec('set check_function_bodies = off;' + ler('supabase/sql/referencia_fichas_atual.sql') + ';set check_function_bodies = on;');
  await db.exec(`create trigger proteger_colunas_admin_fichas before insert or update on public.fichas_viagem
                 for each row execute function public.proteger_colunas_admin_fichas();`);
  await db.exec(ler('supabase/sql/passo9_frota.sql'));
  await db.exec(`update public.perfis set vinculo = 'frota'`);
  await db.exec(ler('supabase/sql/passo11_ficha_motorista.sql'));
  const p12 = ler('supabase/sql/passo12_placa_motorista.sql');
  await db.exec(ateCommit(p12));
  // Passo 13: até o commit; roda duas vezes (tem que poder ser reexecutado)
  const p13 = ler('supabase/sql/passo13_comissao_motorista.sql');
  await db.exec(ateCommit(p13));
  await db.exec(ateCommit(p13));
  // Passo 13b (só a função corrigida do adiantamento); também tem que poder ser reexecutado
  const p13b = ler('supabase/sql/passo13b_adiantamento.sql');
  if (process.env.SEM_13B !== '1') {
    await db.exec(ateCommit(p13b));
    await db.exec(ateCommit(p13b));
  }

  const r = {};
  // Conferências dos arquivos, como o usuário vai rodar no SQL Editor (passo 12 continua igual com o trigger novo)
  r.conferenciasPasso12 = await conferencias(db, p12, '2');
  r.conferenciasPasso13 = await conferencias(db, p13, '7');
  r.conferenciasPasso13b = await conferencias(db, p13b, '2');
  r.perfilDepoisDasConferencias = (await db.query(`select tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem from public.perfis`)).rows[0];
  r.limparFretesDuasVersoes = (await db.query(`select pg_get_function_identity_arguments(oid) args from pg_proc where proname = '_limpar_fretes' order by 1`)).rows.map(x => x.args);

  // Viana (ES): mesma regra do JS
  r.viana = (await db.query(`select v, public._eh_viana_es(v) ok from unnest(array['Viana','Viana/ES','Viana - ES','Viana ES','Viana, ES','  víana  -  es ','Viana-ES','Viana/MA','Viana - MA','Vianaes','Nova Viana','Marília/SP','']) v`)).rows
    .map(x => `${JSON.stringify(x.v)}=${x.ok}`);
  r.moeda = (await db.query(`select v::text, public._moeda(v)::text n from unnest(array['"1.234,56"','"1234,56"','"R$ 1.234,56"','"R$1234"','1234.56','10000','"10.000"','"123.456.789,99"','"1234.5"','"1,234.56"','"12,345"','"abc"','"-5,00"','"1.000.000.000,00"','null']::jsonb[]) v`)).rows
    .map(x => `${x.v} -> ${x.n}`);

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
      (select string_agg(concat_ws('/', f->>'cliente', coalesce(f->>'veiculo','(sem)'), f->>'valor', f->>'comissao', f->>'descarga'), ' ; ') from jsonb_array_elements(dados_completos->'fretes') f) fretes,
      total_frete::text, vr_comissao::text, valor_adiantamento::text, saldo_comissao::text, destino_inicial, destino_final,
      dados_completos->>'totalFrete' dc_total_frete, dados_completos->>'vrComissao' dc_vr, dados_completos->>'saldoComissao' dc_saldo,
      dados_completos->>'valorAdiantamento' dc_adiant, dados_completos->>'destinoInicial' dc_dest_ini
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

  // Passo 13 no UPDATE: o perfil é lido também aqui (rodotrem com especial 10,5 vale só na linha rodotrem)
  await db.exec(`reset teste.uid`);
  await db.exec(`update public.perfis set tipo_veiculo = 'rodotrem', comissao_alim_rodotrem = 10.5`);
  await db.exec(`select set_config('teste.uid', '11111111-1111-1111-1111-111111111111', false)`);
  const fretesRodo = [
    { data: '01/10/2026', cliente: 'alimenticio', origem: 'Viana/ES', destino: 'B', valor: '10.000,00', veiculo: 'rodotrem', descarga: 'R$ 150,5' },
    { data: '02/10/2026', cliente: 'alimenticio', origem: 'Viana/ES', destino: 'B', valor: 10000, veiculo: 'carreta', comissao: '1,00' },
    { data: '03/10/2026', cliente: 'shopee', origem: 'A', destino: 'B', valor: '1.234,56' },
    { data: '04/10/2026', cliente: 'mercado_livre', origem: 'A', destino: 'B', valor: '' },
    { data: '05/10/2026', cliente: 'outro', origem: 'A', destino: 'B', valor: '500,00' },
    { data: '06/10/2026', cliente: 'shopee', origem: 'A', destino: 'B', valor: 'abc' }
  ];
  r.updateRodotrem = await tentar('ABC1D23', { ...km1, destinoInicial: 'Viana - ES', destinoFinal: 'Marília - SP', valorAdiantamento: '500,00', fretes: fretesRodo });
  r.updateRodotremLinha = await linha();
  // Alimentício sem veículo: rascunho passa, envio é recusado
  const semVeiculo = [{ data: '01/10/2026', cliente: 'alimenticio', origem: 'A', destino: 'B', valor: '1.000,00', veiculo: 'x' }];
  r.semVeiculoRascunho = await tentar('ABC1D23', { ...km1, fretes: semVeiculo }, 'rascunho');
  r.semVeiculoEnvio = await tentar('ABC1D23', { ...km1, fretes: semVeiculo });
  // Alimentício sem valor não exige veículo
  r.semVeiculoSemValor = await tentar('ABC1D23', { ...km1, fretes: [{ cliente: 'alimenticio', origem: 'A', valor: '' }] });
  // Motorista não muda o próprio tipo de veículo
  await db.exec(`set role authenticated`);
  await db.query(`update public.perfis set tipo_veiculo = 'carreta', comissao_alim_rodotrem = 99 where id = auth.uid()`);
  r.motoristaMudaTipo = (await db.query(`select * from public.veiculo_do_motorista('00000000-0000-0000-0000-000000000000')`)).rows;
  await db.exec(`reset role`);
  await db.exec(`reset teste.uid`);
  await db.exec(`update public.perfis set tipo_veiculo = 'carreta', comissao_alim_rodotrem = null`);
  await db.exec(`select set_config('teste.uid', '11111111-1111-1111-1111-111111111111', false)`);

  // Gestão: grava tudo, inclusive a principal, os totais e a comissão que mandar
  await db.exec(`select set_config('teste.admin', 'sim', false)`);
  await db.query(`update public.fichas_viagem set placas = 'ABC-1D23', km_total = 2400, vr_comissao = 1, dados_completos = dados_completos || '{"kmTotal":"2400","fretes":[{"cliente":"alimenticio","valor":"1.000,00","comissao":"77,00"}]}'::jsonb where id = 'AJB-TESTE-P11'`);
  r.gestaoUpdate = await linha();
  r.gestaoListaMotoristas = (await db.query(`select nome, tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem, tem_email, status from public.listar_motoristas_frota()`)).rows;
  r.gestaoVeiculoDeOutro = (await db.query(`select * from public.veiculo_do_motorista('11111111-1111-1111-1111-111111111111')`)).rows;

  // Motorista não pode aprovar
  await db.exec(`select set_config('teste.admin', 'nao', false)`);
  try { await db.query(`update public.fichas_viagem set status = 'aprovado' where id = 'AJB-TESTE-P11'`); r.motoristaAprovar = 'PASSOU (errado)'; }
  catch (e) { r.motoristaAprovar = 'bloqueado: ' + e.message; }

  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
