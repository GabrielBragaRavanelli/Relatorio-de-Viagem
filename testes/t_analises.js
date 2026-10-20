// Análises do dashboard: ficha com placa secundária (cenário do teste) + ficha antiga
const { abrir } = require('./harness');

const NOVA = {
  id: 'AJB-2026-901', motorista: 'Motorista Teste', placas: 'ABC-1D23', status: 'aprovado', dataSaida: '2026-10-01',
  totalFrete: '6.000,00', vrComissao: '720,00', impFederal: '10,00', totalPedagio: '50,00',
  kmSaida: '100000', kmEntrada: '101500', kmChegada: '101500', kmTotal: '2300', kmTotal1: '1500', kmTotal2: '800',
  placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '200800',
  abastecimentos: [
    { posto: 'Posto A', valor: '600,00', litros: '100', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto A', valor: '900,00', litros: '150', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto B', valor: '100,00', litros: '20', combustivel: 'arla', placa: 'secundaria' }
  ],
  outrasDespesas: [{ desc: 'Imposto Federal', valor: '10,00' }, { desc: 'Borracharia', valor: '50,00' }, { desc: '', valor: '' }]
};
const ANTIGA = {
  id: 'AJB-2026-050', motorista: 'Motorista Antigo', placas: 'DEF-5678', status: 'aprovado', dataSaida: '2026-09-01',
  totalFrete: '3.000,00', vrComissao: '300,00', kmTotal: '1000',
  abastecimentos: [{ posto: 'Posto C', valor: '1.200,00', litros: '400' }],
  outrasDespesas: []
};

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1' })));
  await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 500));
  console.log('url', page.url(), erros);
  const r = await page.evaluate((fichas) => {
    appState.fichas = fichas;
    document.getElementById('analises-filtro-status').value = 'todas';
    renderizarAnalises();
    const tabela = (id) => Array.from(document.querySelectorAll(`#${id} tr`)).map(tr => Array.from(tr.children).map(c => c.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
    return {
      resumo: Array.from(document.querySelectorAll('#analises-resumo .kpi-card')).map(c => c.innerText.replace(/\s+/g, ' ')),
      placas: tabela('analises-tabela-placas'),
      combustiveis: tabela('analises-tabela-combustiveis'),
      despesas: tabela('analises-tabela-despesas'),
      mediaFichaNova: obterMediaRealFicha(fichas[0]).texto
    };
  }, [NOVA, ANTIGA]);
  r.erros = erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
