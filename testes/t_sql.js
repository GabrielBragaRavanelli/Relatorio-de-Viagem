// Roda supabase/sql/referencia_fichas_atual.sql + passo11 num Postgres em WASM (PGlite),
// com auth.uid()/auth.jwt()/is_admin() simulados, e confere o trigger do motorista e da gestão.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const RAIZ = process.env.RAIZ || path.resolve(__dirname, '..');
const ler = (a) => fs.readFileSync(path.join(RAIZ, a), 'utf8');

(async () => {
  const db = new PGlite();
  // Supabase simulado: usuário logado e papel vêm de configurações da sessão
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
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
  `);
  await db.exec('set check_function_bodies = off;' + ler('supabase/sql/referencia_fichas_atual.sql') + ';set check_function_bodies = on;');
  await db.exec(`create trigger proteger_colunas_admin_fichas before insert or update on public.fichas_viagem
                 for each row execute function public.proteger_colunas_admin_fichas();`);
  await db.exec(ler('supabase/sql/passo11_ficha_motorista.sql'));

  const r = {};
  r.helpers = (await db.query(`select public._km('"101.500"') a, public._km('"1234567890"') b, public._km('"abc"') c,
                                      public._placa('"xyz-9a87"') d, public._placa('"XXX12"') e, public._placa('"ABC1234"') f`)).rows[0];
  r.limparAbast = (await db.query(`select public._limpar_abastecimentos('[
      {"posto":"Posto A","valor":"500,00","litros":"100","combustivel":"diesel_s10","placa":"secundaria","extra":"x"},
      {"posto":"Posto B","valor":"50,00","litros":"10","combustivel":"gasolina","placa":"ABC1234"}]'::jsonb) v`)).rows[0].v;

  // Motorista: INSERT tentando gravar placas e totais (devem ser ignorados)
  await db.exec(`select set_config('teste.uid', '11111111-1111-1111-1111-111111111111', false), set_config('teste.admin', 'nao', false)`);
  await db.query(`insert into public.fichas_viagem (id, motorista, placas, status, km_total, abastecimentos, dados_completos) values
    ('AJB-TESTE-P11', 'teste', 'XXX1234', 'pendente', 999, $1::jsonb->'abastecimentos', $1)`, [{
      kmSaida: '100.000', kmEntrada: '101.500', placaSecundaria: 'XYZ-9A87', kmSaida2: '200000', kmEntrada2: '200.800',
      kmTotal: '999', kmTotal1: '999', kmTotal2: '999',
      abastecimentos: [
        { posto: 'Posto A', valor: '600,00', litros: '100', combustivel: 'diesel_s10', placa: 'principal' },
        { posto: 'Posto A', valor: '900,00', litros: '150', combustivel: 'diesel_s10', placa: 'principal' },
        { posto: 'Posto B', valor: '100,00', litros: '20', combustivel: 'arla', placa: 'secundaria' }],
      fretes: [{ data: '01/10/2026', cliente: 'mercado_livre', origem: 'A', destino: 'B', valor: '9.999,00', comissao: '1,00' }]
    }]);
  const linha = async () => (await db.query(`select placas, km_saida::text, km_chegada::text, km_total::text, motorista,
      dados_completos->>'kmTotal1' t1, dados_completos->>'kmTotal2' t2, dados_completos->>'kmTotal' t,
      dados_completos->>'placaSecundaria' ps, dados_completos->>'kmSaida2' s2,
      (select string_agg(a->>'combustivel' || '/' || coalesce(a->>'placa','-'), ', ') from jsonb_array_elements(abastecimentos) a) abast,
      dados_completos->'fretes'->0->>'valor' frete_valor, dados_completos->'fretes'->0->>'comissao' frete_comissao
      from public.fichas_viagem where id = 'AJB-TESTE-P11'`)).rows[0];
  r.motoristaInsert = await linha();

  // Motorista: UPDATE (rascunho) mudando KM e tentando a placa principal de novo; sem placa secundária = sem 2º trecho
  await db.query(`update public.fichas_viagem set status = 'pendente', placas = 'YYY9999', dados_completos = $1 where id = 'AJB-TESTE-P11'`, [{
    kmSaida: '100000', kmEntrada: '99000', placaSecundaria: '', kmSaida2: '200000', kmEntrada2: '200800', abastecimentos: [] }]);
  r.motoristaUpdateEntradaMenor = await linha();

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
