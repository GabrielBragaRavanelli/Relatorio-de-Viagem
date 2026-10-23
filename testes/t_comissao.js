// REGRA DA COMISSÃO na ficha (passo 13), coluna "Veículo", campos do motorista, totais
// diesel/ARLA, celular e, no dashboard, a aba Motoristas (Adicionar com veículo e Editar).
// Uso: node testes/t_comissao.js [ficha|admin|celular|dashboard]   (sem argumento: tudo)
// Nada vai para o Supabase: a RPC veiculo_do_motorista e a gerenciar-frota são simuladas.
const { abrir } = require('./harness');
const PARTE = process.argv[2] || 'tudo';

// CPF inventado com dígitos verificadores válidos
function cpfFicticio(base9) {
  const d = String(base9).split('').map(Number);
  const dig = (arr, peso) => { const s = arr.reduce((a, n, i) => a + n * (peso - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dig(d, 10)); d.push(dig(d, 11));
  return d.join('');
}

// Tipo de veículo devolvido pela RPC simulada (localStorage 'teste_veiculo'; {falhar:true} = erro)
async function prepararSupabase(page) {
  await page.evaluateOnNewDocument(() => {
    let cfg = null;
    try { cfg = JSON.parse(localStorage.getItem('teste_veiculo') || 'null'); } catch (e) { /* about:blank */ }
    window.__rpcs = [];
    const vazio = { data: null, error: null };
    const consulta = { eq: () => ({ maybeSingle: async () => vazio }), order: async () => ({ data: [], error: null }) };
    window.supabaseClient = {
      rpc: async (nome, params) => {
        window.__rpcs.push({ nome, params });
        if (nome !== 'veiculo_do_motorista' || !cfg || cfg.falhar) return { data: null, error: { message: 'falhou' } };
        return { data: [cfg], error: null };
      },
      from: () => ({ select: () => consulta }),
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: null } }), signOut: async () => ({ error: null }) }
    };
  });
}

const CARRETA = { tipo_veiculo: 'carreta', comissao_alim_carreta: null, comissao_alim_rodotrem: null };
const RODOTREM = { tipo_veiculo: 'rodotrem', comissao_alim_carreta: null, comissao_alim_rodotrem: null };
const CARRETA_RODOTREM = { tipo_veiculo: 'carreta_rodotrem', comissao_alim_carreta: null, comissao_alim_rodotrem: null };
const JOSE = { tipo_veiculo: 'carreta_rodotrem', comissao_alim_carreta: null, comissao_alim_rodotrem: 10.5 };   // especial rodotrem 10,5
const CLOVIS = { tipo_veiculo: 'carreta', comissao_alim_carreta: 6, comissao_alim_rodotrem: null };            // especial carreta 6

async function abrirFicha(page, base, cfg, url = '/HTML/relatorio-viagem.html?novo=true') {
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((c) => { localStorage.clear(); localStorage.setItem('teste_veiculo', JSON.stringify(c)); }, cfg);
  await page.goto(`${base}${url}`, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    window.reservarNumeroFichaSupabase = async () => 'AJB-2026-999';
    window.salvarFichaSupabase = async (f) => { window.__enviado = f; window.__payload = window.mapearFichaParaSupabase(f); return { success: true }; };
  });
}

// Preenche a linha i da Relação de fretes (valor em centavos, digitado como o motorista faz)
async function linhaFrete(page, i, { cliente, origem = 'Marília - SP', destino = 'Santos - SP', veiculo, valor = '1000000', data = '01/10/2026' }) {
  await page.evaluate((i) => {
    const tr = document.querySelector(`[name="data_frete_ml_${i}"]`).closest('tr');
    const tabela = tr.closest('table');
    const n = Array.from(tabela.tBodies[0].rows).indexOf(tr) + 1;
    if (Number(tabela.dataset.mostrar || 1) < n) tabela.dataset.mostrar = String(n);
    tr.classList.remove('linha-oculta-celular');
  }, i);
  await page.$eval(`[name="data_frete_ml_${i}"]`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, data);
  await page.select(`[name="cliente_frete_ml_${i}"]`, cliente);
  if (veiculo !== undefined) await page.select(`[name="veiculo_frete_ml_${i}"]`, veiculo);
  for (const [campo, v] of [['origem', origem], ['destino', destino]]) {
    await page.$eval(`[name="${campo}_frete_ml_${i}"]`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  }
  await page.$eval(`[name="valor_frete_ml_${i}"]`, el => { el.value = ''; });
  await page.focus(`[name="valor_frete_ml_${i}"]`);
  await page.keyboard.type(valor);
  await page.$eval(`[name="valor_frete_ml_${i}"]`, el => el.blur());
}

const comissaoDaLinha = (page, i) => page.$eval(`[name="comissao_frete_ml_${i}"]`, el => el.value);

async function cabecalhoValido(page) {
  const digitar = async (sel, txt) => { await page.focus(sel); await page.keyboard.type(txt); };
  await digitar('#placas', 'ABC1D23');
  await digitar('#data-saida', '01102026');
  await digitar('#data-chegada', '05102026');
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '101500');
  await page.$eval('#destino-inicial', el => { el.value = 'Marília - SP'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#destino-final', el => { el.value = 'Santos - SP'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await digitar('#valor-adiantamento', '50000');
}

async function tentarEnviar(page) {
  await page.$eval('#btn-finalizar-relatorio-ml', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#btn-finalizar-relatorio-ml');
  await new Promise(res => setTimeout(res, 250));
  return page.evaluate(() => ({
    revisaoAberta: document.querySelector('#modal-revisar-envio').classList.contains('ativo'),
    erros: Array.from(document.querySelectorAll('.erro-campo-celular')).map(e => e.textContent)
  }));
}

const colunaVeiculo = (page) => page.evaluate(() => {
  const th = document.querySelector('table.tabela-fretes-ml th.col-veiculo-frete');
  const sel = document.querySelector('[name="veiculo_frete_ml_1"]');
  return {
    visivel: getComputedStyle(th).display !== 'none',
    opcoes: Array.from(sel.options).map(o => `${o.value || '(vazio)'}=${o.textContent}`),
    inicial: sel.value || '(vazio)',
    aviso: !document.getElementById('aviso-veiculo-frete').hidden
  };
});

// ---------------------------------------------------------------------------
async function testarFicha({ base, page }) {
  const r = {};

  // 1 e 2. Exemplos da REGRA DA COMISSÃO (fretes de R$ 10.000,00). Desde o passo 15 o Viana (ES)
  // é o DESTINO da linha (A a D são as conferências do passo15_viana_destino.sql)
  const exemplos = [
    ['A: Rodotrem, origem Marília, destino Viana (linha rodotrem) = 8%', RODOTREM, { cliente: 'alimenticio', origem: 'Marília - SP', destino: 'Viana - ES', veiculo: 'rodotrem' }, '800,00'],
    ['B: Rodotrem, origem Viana, destino Cravinhos (linha rodotrem) = 9%', RODOTREM, { cliente: 'alimenticio', origem: 'Viana - ES', destino: 'Cravinhos - SP', veiculo: 'rodotrem' }, '900,00'],
    ['C: José Luiz Aguiar (especial rodotrem 10,5), destino Viana = 10,5%', JOSE, { cliente: 'alimenticio', destino: 'Viana/ES', veiculo: 'rodotrem' }, '1.050,00'],
    ['D: Rodotrem, linha marcada Carreta, destino Viana = 11%', RODOTREM, { cliente: 'alimenticio', destino: 'Viana - ES', veiculo: 'carreta' }, '1.100,00'],
    ['José Luiz Aguiar, linha Rodotrem, destino Santos = 10,5%', JOSE, { cliente: 'alimenticio', destino: 'Santos - SP', veiculo: 'rodotrem' }, '1.050,00'],
    ['José Luiz Aguiar, linha Carreta = 11%', JOSE, { cliente: 'alimenticio', destino: 'Viana - ES', veiculo: 'carreta' }, '1.100,00'],
    ['Clóvis (carreta, especial 6), Alimentício = 6%', CLOVIS, { cliente: 'alimenticio' }, '600,00'],
    ['Qualquer motorista, Shopee = 11%', RODOTREM, { cliente: 'shopee', veiculo: 'rodotrem' }, '1.100,00'],
    ['Qualquer motorista, Mercado Livre = R$ 400', CLOVIS, { cliente: 'mercado_livre' }, '400,00'],
    ['Rodotrem, destino "Viana/MA" = 9%', RODOTREM, { cliente: 'alimenticio', destino: 'Viana/MA', veiculo: 'rodotrem' }, '900,00'],
    ['Carreta sem especial, Alimentício = 11%', CARRETA, { cliente: 'alimenticio', destino: 'Viana - ES' }, '1.100,00']
  ];
  r.exemplos = [];
  for (const [nome, cfg, linha, esperado] of exemplos) {
    await abrirFicha(page, base, cfg);
    await linhaFrete(page, 1, linha);
    const obtido = await comissaoDaLinha(page, 1);
    r.exemplos.push(`${obtido === esperado ? 'OK ' : 'ERRO'} ${nome}: ${obtido} (esperado ${esperado})`);
  }

  // Comissão recalcula ao trocar o destino e o veículo (rodotrem); trocar a origem não muda nada
  await abrirFicha(page, base, RODOTREM);
  await linhaFrete(page, 1, { cliente: 'alimenticio', origem: 'Marília - SP', destino: 'Santos - SP', veiculo: 'rodotrem' });
  const antes = await comissaoDaLinha(page, 1);
  await page.$eval('[name="origem_frete_ml_1"]', el => { el.value = 'Viana - ES'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const depoisOrigem = await comissaoDaLinha(page, 1);
  await page.$eval('[name="destino_frete_ml_1"]', el => { el.value = 'Viana - ES'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const depoisDestino = await comissaoDaLinha(page, 1);
  await page.select('[name="veiculo_frete_ml_1"]', 'carreta');
  const depoisVeiculo = await comissaoDaLinha(page, 1);
  await page.select('[name="veiculo_frete_ml_1"]', '');
  const semVeiculo = await comissaoDaLinha(page, 1);
  r.recalculo = `destino Santos ${antes} → origem Viana ${depoisOrigem} → destino Viana ${depoisDestino} → carreta ${depoisVeiculo} → sem veículo "${semVeiculo}"`;

  // 3. Carreta: a coluna não aparece
  await abrirFicha(page, base, CARRETA);
  r.colunaCarreta = await colunaVeiculo(page);

  // 4 e 5. Rodotrem e carreta_rodotrem: coluna aparece, começa em "Selecione..." e bloqueia o envio
  for (const [nome, cfg] of [['rodotrem', RODOTREM], ['carreta_rodotrem', CARRETA_RODOTREM]]) {
    await abrirFicha(page, base, cfg);
    const coluna = await colunaVeiculo(page);
    await cabecalhoValido(page);
    await linhaFrete(page, 1, { cliente: 'alimenticio' });
    const semEscolha = await tentarEnviar(page);
    await page.select('[name="veiculo_frete_ml_1"]', 'rodotrem');
    const comEscolha = await tentarEnviar(page);
    r[`coluna_${nome}`] = { ...coluna, semEscolha, comEscolha, comissao: await comissaoDaLinha(page, 1) };
  }

  // RPC falhou: segue como carreta, aviso pequeno e o envio não trava
  await abrirFicha(page, base, { falhar: true });
  const colunaFalha = await colunaVeiculo(page);
  await cabecalhoValido(page);
  await linhaFrete(page, 1, { cliente: 'alimenticio' });
  r.rpcFalhou = { ...colunaFalha, avisoTexto: await page.$eval('#aviso-veiculo-frete', el => el.textContent.trim()), comissao: await comissaoDaLinha(page, 1), envio: await tentarEnviar(page) };

  // 6 e 7. Totais diesel/ARLA, sem o bloco "Resumo Financeiro de Fretes" e indicadores
  await abrirFicha(page, base, CARRETA);
  await cabecalhoValido(page);
  const abast = async (i, comb, valor, litros) => {
    await page.evaluate((i) => {
      const tr = document.querySelector(`[name="posto_ml_${i}"]`).closest('tr');
      const tabela = tr.closest('table');
      if (Number(tabela.dataset.mostrar || 1) < i) tabela.dataset.mostrar = String(i);
      tr.classList.remove('linha-oculta-celular');
    }, i);
    await page.select(`[name="posto_ml_${i}"]`, 'Marília - Posto Esmeralda');
    if (comb) await page.select(`[name="combustivel_ml_${i}"]`, comb);
    await page.focus(`[name="valor_ml_${i}"]`); await page.keyboard.type(valor);
    await page.focus(`[name="litros_ml_${i}"]`); await page.keyboard.type(litros);
    await page.$eval(`[name="litros_ml_${i}"]`, el => el.blur());
  };
  await abast(1, 'diesel_s10', '60000', '100');
  await abast(2, 'diesel_s500', '90000', '150');
  await abast(3, 'arla', '10000', '20');
  const indicadores = () => page.evaluate(() => ({
    totalDiesel: `R$ ${document.getElementById('ml-total-valor-diesel').value} / ${document.getElementById('ml-total-litros-diesel').value} L`,
    totalArla: `R$ ${document.getElementById('ml-total-valor-arla').value} / ${document.getElementById('ml-total-litros-arla').value} L`,
    rotulos: Array.from(document.querySelectorAll('table.tabela-abastecimento:not(.tabela-fretes-ml) tfoot .td-totais-label strong')).map(s => s.textContent),
    despesaTotal: document.getElementById('ml-indicador-despesa-total').textContent,
    resultado: document.getElementById('ml-indicador-resultado-viagem').textContent,
    saldoComissao: document.getElementById('ml-indicador-saldo-comissao').textContent,
    media: document.getElementById('ml-indicador-media-combustivel').textContent.trim().replace(/\s+/g, ' ')
  }));
  r.soAbastecimento = await indicadores();
  // + Shopee de R$ 10.000,00 (comissão 1.100,00), adiantamento 500,00:
  // despesa = 1.600 + 1.100 = 2.700; resultado = 10.000 - 2.700 = 7.300; saldo = 1.100 - 500 = 600
  await linhaFrete(page, 1, { cliente: 'shopee' });
  r.comShopee = await indicadores();
  r.semResumoFretes = await page.evaluate(() => ({
    subbloco: !!document.querySelector('.subbloco-fretes'),
    campos: ['frete-origem', 'retorno-1', 'retorno-2', 'retorno-3', 'total-frete', 'vr-comissao'].filter(id => document.getElementById(id)),
    texto: /Resumo Financeiro de Fretes|FRETE ORIGEM|RETORNO \(I\)/i.test(document.body.innerText)
  }));

  // 8. Campos do motorista editáveis; comissão só leitura
  r.camposMotorista = await page.evaluate(() => {
    const info = (el) => ({
      editavel: !el.readOnly && !el.disabled && !el.closest('.campo-bloqueado-gestao') && !el.classList.contains('campo-bloqueado-gestao'),
      tag: (el.closest('.campo-grupo')?.querySelector('.tag-motorista')?.textContent || '').trim() || '(sem tag)',
      obrigatorio: el.required,
      gestao: /Definido pela/.test(el.closest('.campo-grupo')?.textContent || '')
    });
    const th = (i) => document.querySelectorAll('table.tabela-fretes-ml thead th')[i].textContent.replace(/\s+/g, ' ').trim();
    return {
      destinoInicial: info(document.getElementById('destino-inicial')),
      destinoFinal: info(document.getElementById('destino-final')),
      adiantamento: info(document.getElementById('valor-adiantamento')),
      valorFrete: !document.querySelector('[name="valor_frete_ml_1"]').readOnly,
      descarga: !document.querySelector('[name="descarga_frete_ml_1"]').readOnly,
      comissaoReadonly: document.querySelector('[name="comissao_frete_ml_1"]').readOnly,
      cabecalhos: [th(6), th(7), th(8)]
    };
  });
  // Obrigatórios do motorista: destino inicial/final, adiantamento e valor de cada frete
  const mudar = (sel, v) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  // Destino final é opcional (passo 14): sem ele a revisão abre
  await mudar('#destino-final', '');
  r.semDestinoFinalEnvia = await tentarEnviar(page);
  if (r.semDestinoFinalEnvia.revisaoAberta) { await page.click('#btn-revisar-voltar'); await new Promise(res => setTimeout(res, 200)); }
  await mudar('#destino-final', 'Santos - SP');
  await mudar('#valor-adiantamento', '');
  r.semAdiantamento = (await tentarEnviar(page)).erros;
  await page.focus('#valor-adiantamento'); await page.keyboard.type('50000');
  await page.$eval('[name="valor_frete_ml_1"]', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  r.semValorFrete = (await tentarEnviar(page)).erros;
  await linhaFrete(page, 1, { cliente: 'shopee' });

  // Revisão e envio com os campos novos
  r.envio = await tentarEnviar(page);
  r.revisao = await page.$eval('#revisar-detalhes-viagem', el => el.innerText.replace(/\n+/g, ' | '));
  await page.click('#btn-revisar-confirmar');
  await new Promise(res => setTimeout(res, 600));
  r.payload = await page.evaluate(() => {
    const p = window.__payload;
    if (!p) return null;
    return {
      colunas: { destino_inicial: p.destino_inicial, destino_final: p.destino_final, valor_adiantamento: p.valor_adiantamento, total_frete: p.total_frete, vr_comissao: p.vr_comissao, saldo_comissao: p.saldo_comissao },
      semFreteOrigemERetornos: !['frete_origem', 'retorno_1', 'retorno_2', 'retorno_3'].some(k => k in p),
      dc: { totalAbastecimento: p.dados_completos.totalAbastecimento, totalDiesel: p.dados_completos.totalDiesel, totalArla: p.dados_completos.totalArla, totalFrete: p.dados_completos.totalFrete, vrComissao: p.dados_completos.vrComissao },
      fretes: p.dados_completos.fretes.map(f => `${f.cliente}/${f.veiculo}/${f.valor}/${f.comissao}`)
    };
  });

  // Envio de um motorista de rodotrem: o veículo de cada frete vai no payload
  await abrirFicha(page, base, JOSE);
  await cabecalhoValido(page);
  await linhaFrete(page, 1, { cliente: 'alimenticio', destino: 'Viana - ES', veiculo: 'rodotrem' });
  await page.evaluate(() => document.querySelector('table.tabela-fretes-ml .btn-adicionar-linha-celular').click());
  await linhaFrete(page, 2, { cliente: 'alimenticio', origem: 'Marília - SP', veiculo: 'carreta' });
  await page.evaluate(() => document.querySelector('table.tabela-fretes-ml .btn-adicionar-linha-celular').click());
  await linhaFrete(page, 3, { cliente: 'mercado_livre' });
  r.envioRodotrem = await tentarEnviar(page);
  r.revisaoRodotrem = await page.$eval('#revisar-detalhes-viagem', el => el.innerText.replace(/\n+/g, ' | ').match(/FRETES.*?(?=\| ABASTECIMENTOS|$)/i)?.[0] || '');
  await page.click('#btn-revisar-confirmar');
  await new Promise(res => setTimeout(res, 600));
  r.payloadRodotrem = await page.evaluate(() => window.__payload && window.__payload.dados_completos.fretes.map(f => `${f.cliente}/${f.veiculo || '(vazio)'}/${f.valor}/${f.comissao}`));
  r.rpcsMotorista = await page.evaluate(() => window.__rpcs);
  return r;
}

// ---------------------------------------------------------------------------
// Gestão abre a ficha de um motorista de rodotrem: o tipo vem do motorista da ficha,
// a comissão é editável e o valor digitado à mão não é sobrescrito
async function testarAdmin({ base, page }) {
  const FICHA = {
    id: 'AJB-2026-950', motorista: 'Motorista Ficticio', motoristaId: 'mot-rodotrem-1', placas: 'ABC1D23', status: 'pendente',
    kmSaida: '100000', kmEntrada: '101500', destinoInicial: 'Marília - SP', destinoFinal: 'Viana - ES', valorAdiantamento: '500,00',
    fretes: [
      { data: '01/10/2026', cliente: 'alimenticio', veiculo: 'rodotrem', origem: 'Marília - SP', destino: 'Viana - ES', valor: '10.000,00', comissao: '800,00', descarga: '' },
      { data: '02/10/2026', cliente: 'shopee', origem: 'Marília - SP', destino: 'Santos - SP', valor: '2.000,00', comissao: '220,00', descarga: '' }
    ],
    abastecimentos: [], outrasDespesas: []
  };
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((f, c) => {
    localStorage.clear();
    localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'admin-1', email: 'gestao@exemplo.com' }));
    localStorage.setItem('ajborges_fichas_viagem', JSON.stringify([f]));
    localStorage.setItem('teste_veiculo', JSON.stringify(c));
  }, FICHA, RODOTREM);
  await page.goto(`${base}/HTML/relatorio-viagem.html?ficha=${FICHA.id}&mode=admin`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 600));
  const r = {};
  r.rpc = await page.evaluate(() => window.__rpcs);
  r.aoAbrir = await page.evaluate(() => ({
    coluna: getComputedStyle(document.querySelector('th.col-veiculo-frete')).display !== 'none',
    veiculos: [1, 2].map(i => document.querySelector(`[name="veiculo_frete_ml_${i}"]`).value || '(vazio)'),
    comissoes: [1, 2].map(i => document.querySelector(`[name="comissao_frete_ml_${i}"]`).value),
    comissaoEditavel: !document.querySelector('[name="comissao_frete_ml_1"]').readOnly,
    destinos: [document.getElementById('destino-inicial').value, document.getElementById('destino-final').value, document.getElementById('valor-adiantamento').value],
    indicadores: [document.getElementById('ml-indicador-despesa-total').textContent, document.getElementById('ml-indicador-saldo-comissao').textContent]
  }));
  // Gestão digita a comissão (R$ 500,00) e depois muda o valor: a comissão digitada fica
  await page.$eval('[name="comissao_frete_ml_1"]', el => { el.value = ''; });
  await page.focus('[name="comissao_frete_ml_1"]'); await page.keyboard.type('50000');
  await page.$eval('[name="valor_frete_ml_1"]', el => { el.value = ''; });
  await page.focus('[name="valor_frete_ml_1"]'); await page.keyboard.type('2000000');
  r.manualDepoisDoValor = await comissaoDaLinha(page, 1);
  // Trocar o veículo refaz pela regra (rodotrem → carreta = 11% de 20.000)
  await page.select('[name="veiculo_frete_ml_1"]', 'carreta');
  r.depoisDeTrocarVeiculo = await comissaoDaLinha(page, 1);
  // Gestão salva: vai a comissão da tela
  await page.evaluate(() => { window.salvarFichaSupabase = async (f) => { sessionStorage.setItem('payload', JSON.stringify(window.mapearFichaParaSupabase(f))); return { success: true }; }; });
  await page.click('#btn-admin-salvar-alteracoes');
  await new Promise(res => setTimeout(res, 800));
  r.salvo = await page.evaluate(() => { const p = JSON.parse(sessionStorage.getItem('payload') || 'null'); return p && {
    fretes: p.dados_completos.fretes.map(f => `${f.cliente}/${f.veiculo || '(vazio)'}/${f.valor}/${f.comissao}`),
    total_frete: p.total_frete, vr_comissao: p.vr_comissao, status: p.status }; });
  return r;
}

// ---------------------------------------------------------------------------
// 10. Celular 360/390/430 com a coluna Veículo (motorista de rodotrem)
async function testarCelular({ base, page }) {
  const linhas = [];
  for (const w of [360, 390, 430]) {
    await page.setViewport({ width: w, height: 780 });
    await abrirFicha(page, base, RODOTREM);
    await linhaFrete(page, 1, { cliente: 'alimenticio', destino: 'Viana - ES', veiculo: 'rodotrem' });
    await page.evaluate(() => document.querySelector('table.tabela-fretes-ml .btn-adicionar-linha-celular').click());
    await linhaFrete(page, 2, { cliente: 'shopee', veiculo: 'carreta' });
    const m = await page.evaluate(() => {
      const t = document.querySelector('table.tabela-fretes-ml');
      const cartao = t.tBodies[0].rows[0];
      const tdVeiculo = cartao.querySelector('td.col-veiculo-frete');
      const foraDaTela = Array.from(document.querySelectorAll('#form-relatorio input, #form-relatorio select, #form-relatorio button'))
        .filter(el => el.offsetParent !== null).filter(el => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).length;
      const totaisAbast = Array.from(document.querySelectorAll('table.tabela-abastecimento:not(.tabela-fretes-ml) tfoot tr')).map(tr => getComputedStyle(tr).display);
      return {
        rolagemH: document.documentElement.scrollWidth > window.innerWidth,
        cartao: getComputedStyle(cartao).display === 'grid' ? 'cartão' : 'tabela',
        veiculo: `${getComputedStyle(tdVeiculo).display !== 'none' ? 'visível' : 'OCULTO'} (rótulo "${tdVeiculo.dataset.rotulo}", ${Math.round(tdVeiculo.getBoundingClientRect().width)}px)`,
        foraDaTela, comissao: cartao.querySelector('[name="comissao_frete_ml_1"]').value,
        totaisAbastecimento: totaisAbast.join('/')
      };
    });
    linhas.push(`${w}px | rolagem horizontal: ${m.rolagemH ? 'SIM' : 'não'} | campos fora da tela: ${m.foraDaTela} | fretes: ${m.cartao} | Veículo ${m.veiculo} | comissão ${m.comissao} | totais diesel/ARLA: ${m.totaisAbastecimento}`);
  }
  await page.setViewport({ width: 1280, height: 900 });
  return linhas;
}

// ---------------------------------------------------------------------------
// 9 e 11. Dashboard → Motoristas
async function testarDashboard({ base, page }) {
  await page.evaluateOnNewDocument(() => {
    window.Chart = class { constructor() { this.data = { datasets: [] }; this.options = {}; } update() {} destroy() {} };
    window.Chart.register = () => {};
    let aoAutenticar;
    Object.defineProperty(window, 'ajbAoAutenticar', {
      configurable: true, get: () => aoAutenticar,
      set: (fn) => { aoAutenticar = (...a) => setTimeout(() => fn(...a), 0); }
    });
  });
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1' })); });
  await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 500));
  const cpfs = [cpfFicticio('123456780'), cpfFicticio('987654320'), cpfFicticio('111444777'), cpfFicticio('222555888')];
  const r = { cpfsFicticios: cpfs };
  await page.evaluate((cpfs) => {
    window.__chamadas = [];
    window.__resposta = { ok: true, status: 200, dados: { sucesso: true } };
    window.__toasts = [];
    chamarGerenciarFrota = async (corpo) => { window.__chamadas.push(corpo); return window.__resposta; };
    carregarAbaMotoristas = async () => {};
    exibirToast = (msg) => window.__toasts.push(msg);
    estadoMotoristas.frota = [
      { id: 'm1', nome: 'Ana Ficticia Rocha', cpf: cpfs[0], telefone: '14999990000', status: 'aprovado', tipo_veiculo: 'carreta_rodotrem', comissao_alim_carreta: null, comissao_alim_rodotrem: 10.5 },
      { id: 'm2', nome: 'Bruno Ficticio Lima', cpf: cpfs[1], telefone: '14988880000', status: 'aprovado', tipo_veiculo: 'carreta', comissao_alim_carreta: 6, comissao_alim_rodotrem: null },
      { id: 'm3', nome: 'Caio Ficticio Souza', cpf: cpfs[2], telefone: '1433334444', status: 'aprovado', tipo_veiculo: 'rodotrem', comissao_alim_carreta: null, comissao_alim_rodotrem: null }
    ];
    renderizarFrota();
  }, cpfs);
  r.tabela = await page.evaluate(() => ({
    cabecalho: Array.from(document.querySelectorAll('#mot-painel-frota thead th')).map(th => th.textContent.trim()),
    linhas: Array.from(document.querySelectorAll('#mot-tbody tr')).map(tr => `${tr.cells[0].querySelector('strong').textContent} | ${tr.cells[3].textContent.trim()} | ${Array.from(tr.querySelectorAll('button')).map(b => b.textContent.trim()).join(', ')}`)
  }));

  // 9. "Adicionar motorista": campos novos e corpo do criar
  await page.evaluate(() => document.getElementById('mot-btn-adicionar').click());
  await new Promise(res => setTimeout(res, 200));
  const formAdd = () => page.evaluate(() => ({
    tipo: Array.from(document.querySelectorAll('#mot-add-tipo option')).map(o => `${o.value}=${o.textContent}`),
    tipoInicial: document.getElementById('mot-add-tipo').value,
    carreta: document.getElementById('mot-add-com-carreta').closest('label').innerText.replace(/\s+/g, ' ').trim(),
    rodotremVisivel: getComputedStyle(document.getElementById('mot-add-com-rodotrem-campo')).display !== 'none',
    rodotrem: document.getElementById('mot-add-com-rodotrem-campo').innerText.replace(/\s+/g, ' ').trim()
  }));
  r.adicionar = { carreta: await formAdd() };
  await page.select('#mot-add-tipo', 'rodotrem');
  r.adicionar.rodotrem = (await formAdd()).rodotremVisivel;
  await page.select('#mot-add-tipo', 'carreta_rodotrem');
  r.adicionar.carretaOuRodotrem = (await formAdd()).rodotremVisivel;
  await page.type('#mot-add-nome', 'Davi Ficticio Alves');
  await page.type('#mot-add-cpf', cpfs[3]);
  await page.type('#mot-add-celular', '14966665555');
  await page.type('#mot-add-com-rodotrem', '10,5');
  await page.type('#mot-add-com-carreta', '200');
  await page.click('#mot-add-salvar');
  await new Promise(res => setTimeout(res, 200));
  r.adicionar.percentualInvalido = await page.$eval('#mot-add-alerta', el => el.hidden ? '(sem alerta)' : el.textContent);
  await page.$eval('#mot-add-com-carreta', el => { el.value = ''; });
  await page.click('#mot-add-salvar');
  await new Promise(res => setTimeout(res, 200));
  r.adicionar.corpo = await page.evaluate(() => { const c = window.__chamadas.pop(); return c && { ...c, cpf: c.cpf ? `***${c.cpf.slice(-4)}` : c.cpf }; });
  await page.keyboard.press('Escape');

  // 11. Modal "Editar"
  const abrirEditar = async (id) => {
    await page.evaluate((id) => document.querySelector(`[data-mot-acao="editar"][data-id="${id}"]`).click(), id);
    await new Promise(res => setTimeout(res, 200));
  };
  const valoresEditar = () => page.evaluate(() => ({
    aberto: document.getElementById('modal-mot-editar').classList.contains('active'),
    nome: document.getElementById('mot-edit-nome').value, cpf: document.getElementById('mot-edit-cpf').value,
    celular: document.getElementById('mot-edit-celular').value, tipo: document.getElementById('mot-edit-tipo').value,
    carreta: document.getElementById('mot-edit-com-carreta').value, rodotrem: document.getElementById('mot-edit-com-rodotrem').value,
    rodotremVisivel: getComputedStyle(document.getElementById('mot-edit-com-rodotrem-campo')).display !== 'none'
  }));
  const salvarEditar = async () => {
    page._dialogos = [];
    await page.click('#mot-edit-salvar');
    await new Promise(res => setTimeout(res, 250));
    return page.evaluate((dialogos) => ({
      confirmacao: dialogos[0] || '(sem confirmação)',
      chamada: (() => { const c = window.__chamadas.pop(); return c ? { ...c, cpf: `***${String(c.cpf).slice(-4)}` } : '(não chamou)'; })(),
      alerta: document.getElementById('mot-edit-alerta').hidden ? '(sem alerta)' : document.getElementById('mot-edit-alerta').textContent,
      toast: window.__toasts.pop() || '(sem toast)',
      aberto: document.getElementById('modal-mot-editar').classList.contains('active')
    }), page._dialogos);
  };
  await abrirEditar('m1');
  r.editar = { preenchido: await valoresEditar() };
  r.editar.semMudarCpf = await salvarEditar();

  await abrirEditar('m2');
  r.editar.preenchidoCarreta = await valoresEditar();
  await page.$eval('#mot-edit-cpf', el => { el.value = ''; });
  await page.type('#mot-edit-cpf', cpfs[3]);
  await page.evaluate(() => { window.__resposta = { ok: true, status: 200, dados: { sucesso: true, cpf_alterado: true } }; });
  r.editar.mudandoCpf = await salvarEditar();

  await abrirEditar('m3');
  await page.$eval('#mot-edit-cpf', el => { el.value = ''; });
  await page.type('#mot-edit-cpf', '12345678900');
  r.editar.cpfInvalido = await salvarEditar();
  await page.$eval('#mot-edit-cpf', el => { el.value = ''; });
  await page.type('#mot-edit-cpf', cpfs[2]);
  await page.$eval('#mot-edit-celular', el => { el.value = ''; });
  await page.type('#mot-edit-celular', '1499');
  r.editar.celularInvalido = await salvarEditar();
  await page.$eval('#mot-edit-celular', el => { el.value = ''; });
  await page.type('#mot-edit-celular', '14977770000');
  await page.evaluate(() => { window.__resposta = { ok: false, status: 409, dados: { erro: 'Já existe um cadastro com este CPF.' } }; });
  r.editar.erro409 = await salvarEditar();

  // Modal no celular: cabe na tela e os botões ficam visíveis (dashboard aberto já na largura)
  r.editar.celular = [];
  for (const w of [360, 390, 430]) {
    await page.setViewport({ width: w, height: 740 });
    await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
    await new Promise(res => setTimeout(res, 400));
    await page.evaluate((cpf) => {
      estadoMotoristas.frota = [{ id: 'm1', nome: 'Ana Ficticia Rocha', cpf, telefone: '14999990000', status: 'aprovado', tipo_veiculo: 'rodotrem', comissao_alim_rodotrem: 10.5 }];
      renderizarFrota();
      abrirEdicaoMotorista(estadoMotoristas.frota[0]);
    }, cpfs[0]);
    await new Promise(res => setTimeout(res, 300));
    r.editar.celular.push(await page.evaluate((w) => {
      const c = document.querySelector('#modal-mot-editar .modal-container').getBoundingClientRect();
      const botoes = Array.from(document.querySelectorAll('#modal-mot-editar .modal-footer button')).map(b => b.getBoundingClientRect());
      const visiveis = botoes.every(b => b.top >= 0 && b.bottom <= window.innerHeight && b.left >= 0 && b.right <= window.innerWidth);
      return `${w}px: modal ${Math.round(c.width)}x${Math.round(c.height)} ${c.left >= 0 && c.right <= window.innerWidth && c.bottom <= window.innerHeight ? 'cabe' : 'NÃO cabe'}, botões ${visiveis ? 'visíveis' : 'FORA'}, rolagem lateral ${document.documentElement.scrollWidth > window.innerWidth ? 'SIM' : 'não'}`;
    }, w));
  }
  return r;
}

(async () => {
  const ctx = await abrir({});
  const r = {};
  try {
    if (PARTE === 'tudo' || PARTE === 'ficha' || PARTE === 'admin' || PARTE === 'celular') await prepararSupabase(ctx.page);
    if (PARTE === 'tudo' || PARTE === 'ficha') r.ficha = await testarFicha(ctx);
    if (PARTE === 'tudo' || PARTE === 'admin') r.admin = await testarAdmin(ctx);
    if (PARTE === 'tudo' || PARTE === 'celular') r.celular = await testarCelular(ctx);
    if (PARTE === 'tudo' || PARTE === 'dashboard') r.dashboard = await testarDashboard(ctx);
  } catch (e) {
    r.falha = String((e && e.stack) || e);
    process.exitCode = 1;
  } finally {
    r.erros = ctx.erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
    console.log(JSON.stringify(r, null, 2));
    // No Windows o Chrome às vezes ainda segura a pasta temporária ao fechar (EBUSY): não é falha do teste
    await ctx.browser.close().catch(() => {});
    ctx.srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
