// Responsividade da ficha (motorista) com placa principal e secundária, 3 abastecimentos,
// card com as duas médias (uma por placa) e revisão aberta
const { abrir } = require('./harness');
const LARGURAS = (process.argv[2] || '320,360,390,430').split(',').map(Number);

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  const linhas = [];
  for (const w of LARGURAS) {
    await page.setViewport({ width: w, height: 780 });
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
    const digitar = async (sel, txt) => { await page.focus(sel); await page.keyboard.type(txt); };
    await digitar('#placas', 'ABC1D23');
    await digitar('#km-saida', '100000');
    await digitar('#km-chegada', '101500');
    await digitar('#placa-secundaria', 'XYZ9A87');
    await digitar('#km-saida-2', '200000');
    await digitar('#km-chegada-2', '200800');
    // Destinos e adiantamento: o motorista preenche (obrigatórios no envio)
    for (const [sel, v] of [['#destino-inicial', 'Marília - SP'], ['#destino-final', 'Santos - SP']]) {
      await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    }
    await digitar('#valor-adiantamento', '50000');
    const tabAbast = 'table.tabela-abastecimento:not(.tabela-fretes-ml)';
    for (const [i, comb, placa, valor, litros] of [[1, 'diesel_s10', 'principal', '60000', '100'], [2, 'diesel_s10', 'principal', '90000', '150'], [3, 'diesel_s500', 'secundaria', '1000000', '1200']]) {
      if (i > 1) await page.click(`${tabAbast} .btn-adicionar-linha-celular`);
      await page.select(`[name="posto_ml_${i}"]`, 'Marília - Posto Esmeralda');
      await page.select(`[name="combustivel_ml_${i}"]`, comb);
      await page.select(`[name="placa_abast_ml_${i}"]`, placa);
      await digitar(`[name="valor_ml_${i}"]`, valor);
      await digitar(`[name="litros_ml_${i}"]`, litros);
    }
    const m = await page.evaluate((tabAbast) => {
      const t = document.querySelector(tabAbast);
      const cartao = t.tBodies[0].rows[0];
      const colsCartao = getComputedStyle(cartao).gridTemplateColumns.split(' ').length;
      const kmGrid = getComputedStyle(document.querySelector('#bloco-km-secundaria .grid-campos')).gridTemplateColumns.split(' ').length;
      const btnAdd = t.querySelector('.btn-adicionar-linha-celular').getBoundingClientRect();
      const remover = t.tBodies[0].rows[1].querySelector('.btn-limpar-linha-inline').getBoundingClientRect();
      const placaVisivel = getComputedStyle(cartao.querySelector('.col-placa-abast')).display !== 'none';
      const foraDaTela = Array.from(document.querySelectorAll('#form-relatorio input, #form-relatorio select, #form-relatorio button'))
        .filter(el => el.offsetParent !== null).filter(el => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).length;
      return {
        rolagemH: document.documentElement.scrollWidth > window.innerWidth,
        cartao: getComputedStyle(cartao).display === 'grid' ? `cartão ${colsCartao} col.` : 'tabela',
        kmSecCols: kmGrid, placaVisivel,
        btnAdd: `${Math.round(btnAdd.width)}px (${Math.round(btnAdd.width / (t.getBoundingClientRect().width || 1) * 100)}%)`,
        remover: `${Math.round(remover.width)}x${Math.round(remover.height)}`,
        foraDaTela, kmViagem: document.getElementById('km-total-viagem').textContent,
        // Card "Média combustível" com as duas médias: nada passa da borda do card nem da tela
        cardMedia: (() => {
          const card = document.querySelector('.card-indicador.indicador-media');
          const c = card.getBoundingClientRect();
          const blocos = Array.from(card.querySelectorAll('.media-placa'));
          const vazando = blocos.filter(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > c.right + 1).length;
          return `${blocos.length} médias, ${Math.round(c.width)}px, ${c.right <= window.innerWidth ? 'cabe' : 'NÃO cabe'} na tela, ${vazando ? vazando + ' vazando' : 'sem vazar'} (${blocos.map(b => b.innerText.replace(/\s+/g, ' ')).join(' / ')})`;
        })()
      };
    }, tabAbast);
    // Revisão: abre e confere se os botões ficam visíveis sem rolar a página
    // (rola até o botão e espera assentar: no headless o clique às vezes caía durante a rolagem)
    await page.$eval('#btn-finalizar-relatorio-ml', el => el.scrollIntoView({ block: 'center' }));
    await new Promise(r => setTimeout(r, 300));
    await page.click('#btn-finalizar-relatorio-ml');
    await new Promise(r => setTimeout(r, 300));
    const modal = await page.evaluate(() => {
      const card = document.querySelector('#modal-revisar-envio .modal-card-custom');
      const btn = document.getElementById('btn-revisar-confirmar').getBoundingClientRect();
      const c = card.getBoundingClientRect();
      return { aberto: document.getElementById('modal-revisar-envio').classList.contains('ativo'), erro: [...Array.from(document.querySelectorAll('.erro-campo-celular')).map(e => e.textContent), document.querySelector('.toast.toast-visivel .toast-mensagem')?.textContent || ''].filter(Boolean).join(', '), cabeNaLargura: c.left >= 0 && c.right <= window.innerWidth, botaoVisivel: btn.bottom <= window.innerHeight && btn.top >= 0, rolaDentro: card.scrollHeight > card.clientHeight };
    });
    linhas.push(`${w}px | rolagem horizontal: ${m.rolagemH ? 'SIM' : 'não'} | campos fora da tela: ${m.foraDaTela} | abastecimento: ${m.cartao}, coluna Placa ${m.placaVisivel ? 'visível' : 'oculta'} | KM secundária: ${m.kmSecCols} col. | + Adicionar: ${m.btnAdd} | Remover: ${m.remover} | KM viagem ${m.kmViagem} | card média: ${m.cardMedia} | revisão: ${modal.aberto ? 'aberta' : 'FECHADA (' + modal.erro + ')'}, cabe na largura ${modal.cabeNaLargura ? 'sim' : 'NÃO'}, botão Confirmar visível ${modal.botaoVisivel ? 'sim' : 'NÃO'}${modal.rolaDentro ? ' (conteúdo rola dentro do modal)' : ''}`);
  }
  console.log(linhas.join('\n'));
  console.log('erros:', erros);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
