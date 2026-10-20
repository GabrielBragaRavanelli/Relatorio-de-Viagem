// Gestão abre uma ficha salva (do cache local), confere os campos novos e salva
const { abrir } = require('./harness');

const FICHA = {
  id: 'AJB-2026-900', motorista: 'Motorista Teste', placas: 'ABC-1D23', status: 'pendente',
  kmSaida: '100000', kmEntrada: '101500', kmChegada: '101500', placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '200800',
  fretes: [
    { data: '01/10/2026', cliente: 'alimenticio', origem: 'Marília - SP', destino: 'Santos - SP', valor: '1.000,00', comissao: '100,00', descarga: '' },
    { data: '02/10/2026', cliente: 'shopee', origem: 'Santos - SP', destino: 'Campinas - SP', valor: '2.000,00', comissao: '220,00', descarga: '' },
    { data: '03/10/2026', cliente: 'mercado_livre', origem: 'Campinas - SP', destino: 'Marília - SP', valor: '3.000,00', comissao: '400,00', descarga: '' }
  ],
  abastecimentos: [
    { posto: 'Marília - Posto Esmeralda', valor: '600,00', litros: '100', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto Antigo Fora da Lista', valor: '900,00', litros: '150' },
    { posto: 'Marília - Posto Esmeralda', valor: '100,00', litros: '20', combustivel: 'arla', placa: 'secundaria' }
  ],
  outrasDespesas: [{ desc: 'Imposto Federal', valor: '10,00' }, { desc: 'Chapa (texto antigo)', valor: '30,00' }, { desc: '', valor: '' }]
};

(async () => {
  const { srv, base, browser, page, erros } = await abrir({ largura: Number(process.argv[2] || 1280) });
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((f) => {
    localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1', email: 'ti@x.com' }));
    localStorage.setItem('ajborges_fichas_viagem', JSON.stringify([f]));
  }, FICHA);
  await page.goto(`${base}/HTML/relatorio-viagem.html?ficha=${FICHA.id}&mode=admin`, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 500));
  const r = await page.evaluate(() => {
    const v = (s) => document.querySelector(s)?.value;
    const visiveis = (sel) => Array.from(document.querySelectorAll(sel)).filter(tr => tr.offsetParent !== null).length;
    return {
      kms: [v('#km-saida'), v('#km-chegada'), v('#km-total'), v('#placa-secundaria'), v('#km-saida-2'), v('#km-chegada-2'), v('#km-total-2'), document.getElementById('km-total-viagem').textContent],
      editaveis: ['#km-saida', '#placa-secundaria', '#km-saida-2', '#placas'].map(s => !document.querySelector(s).readOnly),
      abast: [1, 2, 3].map(i => `${v(`[name="combustivel_ml_${i}"]`) || '(vazio)'}/${v(`[name="placa_abast_ml_${i}"]`)}`),
      desc2: v('#ml-despesa-desc-2'),
      media: document.getElementById('ml-indicador-media-combustivel').textContent.trim().replace(/\s+/g, ' '),
      porPlaca: document.getElementById('ml-media-por-placa').textContent,
      linhasFrete: visiveis('table.tabela-fretes-ml tbody tr:not(.linha-adicionar-celular)'),
      linhasAbast: visiveis('table.tabela-abastecimento:not(.tabela-fretes-ml) tbody tr:not(.linha-adicionar-celular)')
    };
  });
  // Gestão corrige o KM de entrada da secundária e salva
  await page.evaluate(() => { window.salvarFichaSupabase = async (f) => { const p = window.mapearFichaParaSupabase(f); sessionStorage.setItem('payload', JSON.stringify(p)); return { success: true }; }; });
  await page.$eval('#km-chegada-2', el => { el.value = ''; });
  await page.focus('#km-chegada-2'); await page.keyboard.type('200900');
  await page.click('#btn-admin-salvar-alteracoes');
  await new Promise(res => setTimeout(res, 800));
  r.salvo = await page.evaluate(() => { window.__payload = JSON.parse(sessionStorage.getItem('payload') || 'null'); return window.__payload && {
    km_total: window.__payload.km_total, kmTotal: window.__payload.dados_completos.kmTotal,
    kmTotal2: window.__payload.dados_completos.kmTotal2, status: window.__payload.status,
    abast: window.__payload.abastecimentos.map(a => `${a.combustivel || '(vazio)'}/${a.placa}`) };
  });
  r.erros = erros;
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
