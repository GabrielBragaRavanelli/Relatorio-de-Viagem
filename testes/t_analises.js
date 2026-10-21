// Análises e modal do dashboard: ficha com placa secundária (média amarrada à placa),
// a mesma placa gravada pelo motorista (ABC1D23) e pela gestão (ABC-1D23), e ficha antiga
const { abrir } = require('./harness');

// Principal 100000 -> 105000 (5.000 km), 3 linhas de diesel = 2.000 L + 1 ARLA;
// secundária 200000 -> 206000 (6.000 km), 2 linhas = 2.400 L (litros com ponto de milhar, como a ficha grava)
const NOVA = {
  id: 'AJB-2026-901', motorista: 'Motorista Teste', placas: 'ABC1D23', status: 'aprovado', dataSaida: '2026-10-01',
  totalFrete: '6.000,00', vrComissao: '720,00', impFederal: '10,00', totalPedagio: '50,00',
  kmSaida: '100000', kmEntrada: '105000', kmChegada: '105000', kmTotal: '11000', kmTotal1: '5000', kmTotal2: '6000',
  placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '206000',
  abastecimentos: [
    { posto: 'Posto A', valor: '4.000,00', litros: '800', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto A', valor: '3.500,00', litros: '700', combustivel: 'diesel_s500', placa: 'principal' },
    { posto: 'Posto B', valor: '2.500,00', litros: '500', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto B', valor: '200,00', litros: '50', combustivel: 'arla', placa: 'principal' },
    { posto: 'Posto C', valor: '6.000,00', litros: '1.200', combustivel: 'diesel_s10', placa: 'secundaria' },
    { posto: 'Posto C', valor: '6.000,00', litros: '1.200', combustivel: 'diesel_s500', placa: 'secundaria' }
  ],
  outrasDespesas: [{ desc: 'Imposto Federal', valor: '10,00' }, { desc: 'Borracharia', valor: '50,00' }, { desc: '', valor: '' }]
};
// Mesma placa principal gravada pela gestão (com hífen), só principal: 5.000 km ÷ (1.000 + 1.000) L = 2,50
const GESTAO = {
  id: 'AJB-2026-902', motorista: 'Motorista Teste', placas: 'ABC-1D23', status: 'aprovado', dataSaida: '2026-10-05',
  totalFrete: '3.000,00', vrComissao: '300,00', kmSaida: '300000', kmEntrada: '305000', kmTotal: '5000',
  abastecimentos: [
    { posto: 'Posto A', valor: '5.000,00', litros: '1.000', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto A', valor: '5.000,00', litros: '1.000', combustivel: 'diesel_s10', placa: 'principal' },
    { posto: 'Posto A', valor: '200,00', litros: '50', combustivel: 'arla', placa: 'principal' }
  ],
  outrasDespesas: []
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
  const r = await page.evaluate((fichas) => {
    appState.fichas = fichas;
    document.getElementById('analises-filtro-status').value = 'todas';
    renderizarAnalises();
    const tabela = (id) => Array.from(document.querySelectorAll(`#${id} tr`)).map(tr => Array.from(tr.children).map(c => c.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
    const modal = (id) => {
      abrirModalResumoFicha(id);
      return Array.from(document.querySelectorAll('#modal-ficha-conteudo .modal-info-linha'))
        .map(l => l.textContent.trim().replace(/\s+/g, ' ')).filter(t => /KM|Média|Placa/.test(t));
    };
    const medias = (f) => { const m = mediasPorPlacaDaFicha(f); return [m.principal.media, m.secundaria.media].map(v => v === null ? '—' : v.toFixed(2)); };
    // Litros diferentes: secundária com 2.000 L (3,00) e principal com 2.500 L (2,00)
    const diferente = JSON.parse(JSON.stringify(fichas[0]));
    diferente.abastecimentos[5].litros = '800';
    diferente.abastecimentos[2].litros = '1.000';
    return {
      placas: tabela('analises-tabela-placas'),
      combustiveis: tabela('analises-tabela-combustiveis'),
      modalNova: modal('AJB-2026-901'),
      modalGestao: modal('AJB-2026-902'),
      mediasNova: medias(fichas[0]),
      mediasDiferente: medias(diferente),
      // Viagem toda (ranking, alerta, gráfico): (5.000 + 6.000) ÷ (2.000 + 2.400) = 2,50
      mediaViagemNova: obterMediaRealFicha(fichas[0]).texto,
      mediaViagemDiferente: obterMediaRealFicha(diferente).texto,
      mediaGestao: obterMediaRealFicha(fichas[1]).texto,
      litros: ['1.000', '1.200', '150,5', '800', 1000.5].map(parseLitrosAbast)
    };
  }, [NOVA, GESTAO, ANTIGA]);
  r.erros = erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
