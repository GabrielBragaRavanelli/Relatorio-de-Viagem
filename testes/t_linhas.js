// Linhas dinâmicas: ficha nova, adicionar até o limite, remover do meio, ficha salva com 3 fretes, Limpar
const { abrir } = require('./harness');
const LARGURA = Number(process.argv[2] || 1280);

const estado = () => {
  const info = (sel) => {
    const t = document.querySelector(sel);
    const linhas = Array.from(t.tBodies[0].rows).filter(tr => !tr.classList.contains('linha-adicionar-celular'));
    const visiveis = linhas.filter(tr => getComputedStyle(tr).display !== 'none');
    const btn = t.querySelector('.btn-adicionar-linha-celular');
    const lim = t.querySelector('.texto-limite-linhas');
    return {
      visiveis: visiveis.length,
      numeros: visiveis.map(tr => tr.querySelector('.num-rotulo').textContent.trim()).join(','),
      botao: getComputedStyle(btn).display !== 'none' && btn.offsetParent !== null,
      larguraBotao: Math.round(btn.getBoundingClientRect().width),
      limite: getComputedStyle(lim).display !== 'none' && lim.offsetParent !== null ? lim.textContent : '',
      removerNa1: getComputedStyle(linhas[0].querySelector('.btn-limpar-linha-inline')).display,
      removerNa2: (() => { const b = linhas[1].querySelector('.btn-limpar-linha-inline'); const r = b.getBoundingClientRect(); return `${getComputedStyle(b).display} ${Math.round(r.width)}x${Math.round(r.height)}`; })(),
      totaisVisiveis: getComputedStyle(t.tFoot).display !== 'none'
    };
  };
  return {
    fretes: info('table.tabela-fretes-ml'),
    abast: info('table.tabela-abastecimento:not(.tabela-fretes-ml)'),
    rolagemH: document.documentElement.scrollWidth > window.innerWidth
  };
};

(async () => {
  const { srv, base, browser, page, erros } = await abrir({ largura: LARGURA });
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  const r = {};
  r.fichaNova = await page.evaluate(estado);

  // Adiciona até o limite (fretes: 7 cliques; abastecimentos: 9) e confere o foco
  for (let k = 0; k < 7; k++) await page.click('table.tabela-fretes-ml .btn-adicionar-linha-celular').catch(() => {});
  r.focoAposAdicionar = await page.evaluate(() => document.activeElement?.name || document.activeElement?.tagName);
  for (let k = 0; k < 9; k++) await page.click('table.tabela-abastecimento:not(.tabela-fretes-ml) .btn-adicionar-linha-celular').catch(() => {});
  r.noLimite = await page.evaluate(estado);

  // Preenche 4 fretes com destinos A, B, C, D e remove o 2º (B): C e D sobem
  await page.evaluate(() => {
    ['A', 'B', 'C', 'D'].forEach((d, k) => {
      const i = k + 1;
      document.querySelector(`select[name="cliente_frete_ml_${i}"]`).value = 'alimenticio';
      document.querySelector(`input[name="destino_frete_ml_${i}"]`).value = `Destino ${d}`;
      document.querySelector(`input[name="data_frete_ml_${i}"]`).value = `0${i}/10/2026`;
    });
  });
  await page.click('button.btn-limpar-linha-inline[data-linha="2"]');
  r.aposRemover2 = await page.evaluate(() => ({
    destinos: [1, 2, 3, 4].map(i => document.querySelector(`input[name="destino_frete_ml_${i}"]`).value || '(vazio)'),
    datas: [1, 2, 3, 4].map(i => document.querySelector(`input[name="data_frete_ml_${i}"]`).value || '(vazio)')
  }));
  r.estadoAposRemover = (await page.evaluate(estado)).fretes;
  r.dialogos = page._dialogos || [];

  // "Limpar todas" do bloco: volta para só a linha 1
  await page.click('#btn-lixeira-fretes-ml');
  await page.click('#btn-limpar-fretes-ml-todas');
  r.aposLimpar = (await page.evaluate(estado)).fretes;

  // Ficha salva com 3 fretes e 2 abastecimentos (modo gestão)
  await page.evaluate(() => {
    localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1' }));
    localStorage.setItem('ajborges_fichas_viagem', JSON.stringify([{
      id: 'AJB-2026-777', motorista: 'M', placas: 'ABC-1D23', status: 'pendente',
      fretes: [1, 2, 3].map(i => ({ data: `0${i}/10/2026`, cliente: 'alimenticio', origem: 'Marília - SP', destino: 'Santos - SP', valor: '100,00', comissao: '', descarga: '' })),
      abastecimentos: [{ posto: 'Marília - Posto Esmeralda', valor: '10,00', litros: '5', combustivel: 'diesel_s10' }, { posto: 'Marília - Posto Esmeralda', valor: '20,00', litros: '8', combustivel: 'arla' }]
    }]));
  });
  await page.goto(`${base}/HTML/relatorio-viagem.html?ficha=AJB-2026-777&mode=admin`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 400));
  const salva = await page.evaluate(estado);
  r.fichaSalva = { fretes: salva.fretes.visiveis, numeros: salva.fretes.numeros, abast: salva.abast.visiveis, rolagemH: salva.rolagemH };

  r.erros = erros;
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
