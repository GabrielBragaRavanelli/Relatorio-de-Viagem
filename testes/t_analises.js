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
    // Ficha do passo 13 como o banco devolve (sem o bloco Resumo: total frete e comissão vêm da
    // Relação de fretes) e a mesma ficha no formato antigo, com frete origem/retornos
    const passo13 = mapearFichaDoSupabase({
      id: 'AJB-2026-913', motorista: 'Motorista Ficticio', placas: 'ABC1D23', status: 'aprovado', data_saida: '2026-10-10',
      km_saida: 100000, km_chegada: 101500, km_total: 1500, destino_inicial: 'Viana - ES', destino_final: 'Marília - SP',
      total_frete: 22000, vr_comissao: 2550, valor_adiantamento: 500, saldo_comissao: 2050,
      abastecimentos: [
        { posto: 'Posto A', valor: '600,00', litros: '100', combustivel: 'diesel_s10' },
        { posto: 'Posto A', valor: '900,00', litros: '150', combustivel: 'diesel_s500' },
        { posto: 'Posto B', valor: '100,00', litros: '20', combustivel: 'arla' }],
      dados_completos: { kmSaida: '100000', kmEntrada: '101500', fretes: [
        { data: '01/10/2026', cliente: 'alimenticio', veiculo: 'rodotrem', origem: 'Viana - ES', destino: 'Marília - SP', valor: '10.000,00', comissao: '1.050,00', descarga: '' },
        { data: '02/10/2026', cliente: 'alimenticio', veiculo: 'carreta', origem: 'Marília - SP', destino: 'Santos - SP', valor: '10.000,00', comissao: '1.100,00', descarga: '' },
        { data: '03/10/2026', cliente: 'mercado_livre', veiculo: null, origem: 'Santos - SP', destino: 'Viana - ES', valor: '2.000,00', comissao: '400,00', descarga: '' }] }
    });
    const formatoAntigo = { ...passo13, id: 'AJB-2026-914', freteOrigem: '10.000,00', retorno1: '10.000,00', retorno2: '2.000,00',
      fretes: passo13.fretes.map(({ veiculo, ...f }) => f) };
    fichas = [...fichas, passo13];
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
      litros: ['1.000', '1.200', '150,5', '800', 1000.5].map(parseLitrosAbast),
      // Passo 13: Análises com a receita e a comissão de sempre (total_frete e vr_comissao)
      analisesPasso13: (() => {
        const n = obterValoresFichaAnalise(passo13), a = obterValoresFichaAnalise(formatoAntigo);
        return { nova: { frete: n.frete, comissao: n.comissao, diesel: n.diesel, arla: n.arla }, formatoAntigo: { frete: a.frete, comissao: a.comissao },
          iguais: n.frete === a.frete && n.comissao === a.comissao };
      })(),
      operacoes: tabela('analises-tabela-operacoes'),
      modalPasso13: (() => {
        abrirModalResumoFicha('AJB-2026-913');
        const c = document.getElementById('modal-ficha-conteudo');
        return {
          linhas: Array.from(c.querySelectorAll('.modal-info-linha')).map(l => l.textContent.trim().replace(/\s+/g, ' ')).filter(t => /Destino|Diesel|ARLA|Adiantamento|Saldo|Frete/.test(t)),
          fretes: Array.from(c.querySelectorAll('.modal-tabela-resumo'))[0].innerText.split('\n').filter(Boolean).slice(0, 5)
        };
      })(),
      modalAntigaSemVeiculo: (() => {
        abrirModalResumoFicha('AJB-2026-050');
        const c = document.getElementById('modal-ficha-conteudo');
        return { cabecalhoFretes: Array.from(c.querySelectorAll('.modal-tabela-resumo'))[0].querySelector('thead').innerText.trim(),
          diesel: Array.from(c.querySelectorAll('.modal-info-linha')).map(l => l.textContent.trim().replace(/\s+/g, ' ')).filter(t => /Diesel|ARLA/.test(t)) };
      })()
    };
  }, [NOVA, GESTAO, ANTIGA]);
  r.erros = erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
