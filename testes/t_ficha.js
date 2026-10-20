// Simulação da ficha do motorista: KMs, placa secundária, 3 abastecimentos, revisão e envio
const { abrir } = require('./harness');

(async () => {
  const { srv, base, browser, page, erros } = await abrir({ largura: Number(process.argv[2] || 1280) });
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  // Captura o envio em vez de chamar o Supabase
  await page.evaluate(() => {
    window.reservarNumeroFichaSupabase = async () => 'AJB-2026-999';
    window.salvarFichaSupabase = async (f) => { window.__enviado = f; window.__payload = window.mapearFichaParaSupabase(f); return { success: true }; };
  });

  const digitar = async (sel, txt) => { await page.focus(sel); await page.keyboard.type(txt); };
  const r = {};
  r.secundariaVisivelAntes = await page.$eval('#bloco-km-secundaria', el => !el.hidden);
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '1015');
  r.valsParcial = await page.evaluate(() => [document.querySelector('#km-saida').value, document.querySelector('#km-chegada').value]);
  r.erroKmVisivelParcial = await page.$eval('#erro-km-principal', el => !el.hidden);
  await digitar('#km-chegada', '00');
  r.kmTotalPrincipal = await page.$eval('#km-total', el => el.value);
  r.erroKmDepois = await page.$eval('#erro-km-principal', el => !el.hidden);
  await digitar('#placa-secundaria', 'xyz9a87');
  r.placaSecFormatada = await page.$eval('#placa-secundaria', el => el.value);
  r.secundariaVisivel = await page.$eval('#bloco-km-secundaria', el => !el.hidden);
  r.colunaPlacaVisivel = await page.$eval('th.col-placa-abast', el => getComputedStyle(el).display !== 'none');
  await digitar('#km-saida-2', '200000');
  await digitar('#km-chegada-2', '200800');
  r.kmTotal2 = await page.$eval('#km-total-2', el => el.value);
  r.kmTotalViagem = await page.$eval('#km-total-viagem', el => el.textContent);

  // Mostra 3 linhas de abastecimento (botão "+ Adicionar" no celular; no computador já aparecem)
  const linhas = [
    { i: 1, comb: 'diesel_s10', placa: 'principal', valor: '60000', litros: '100' },
    { i: 2, comb: 'diesel_s10', placa: 'principal', valor: '90000', litros: '150' },
    { i: 3, comb: 'arla', placa: 'secundaria', valor: '10000', litros: '20' }
  ];
  for (const l of linhas) {
    await page.evaluate((i) => { const tr = document.querySelector(`[name="posto_ml_${i}"]`).closest('tr'); tr.classList.remove('linha-oculta-celular'); tr.hidden = false; }, l.i);
    await page.select(`[name="posto_ml_${l.i}"]`, 'Marília - Posto Esmeralda');
    await page.select(`[name="combustivel_ml_${l.i}"]`, l.comb);
    await page.select(`[name="placa_abast_ml_${l.i}"]`, l.placa);
    await digitar(`[name="valor_ml_${l.i}"]`, l.valor);
    await digitar(`[name="litros_ml_${l.i}"]`, l.litros);
    await page.$eval(`[name="litros_ml_${l.i}"]`, el => el.blur());
  }
  r.opcoesPlaca = await page.$eval('[name="placa_abast_ml_1"]', s => Array.from(s.options).map(o => `${o.value}=${o.textContent}`));
  r.totalValor = await page.$eval('#ml-total-valor-combustivel', el => el.value);
  r.totalLitros = await page.$eval('#ml-total-litros-combustivel', el => el.value);
  r.media = await page.$eval('#ml-indicador-media-combustivel', el => el.textContent.trim().replace(/\s+/g, ' '));
  r.baseLitrosDiesel = await page.$eval('#ml-calc-base-litros', el => el.textContent);
  r.mediaPorPlaca = await page.$eval('#ml-media-por-placa', el => el.hidden ? '(oculto)' : el.textContent);

  // Despesa: valor sem tipo deve bloquear
  await digitar('#ml-despesa-valor-2', '5000');
  await page.click('#btn-finalizar-relatorio-ml');
  r.modalAbertoComErro = await page.$eval('#modal-revisar-envio', el => el.classList.contains('ativo'));
  r.erroDespesa = await page.evaluate(() => document.querySelector('#ml-despesa-desc-2').closest('.input-wrapper').nextElementSibling?.textContent || '');
  await page.select('#ml-despesa-desc-2', 'Borracharia');

  await page.click('#btn-finalizar-relatorio-ml');
  r.modalAberto = await page.$eval('#modal-revisar-envio', el => el.classList.contains('ativo'));
  r.revisao = await page.$eval('#revisar-detalhes-viagem', el => el.innerText.replace(/\n+/g, ' | '));
  await page.click('#btn-revisar-confirmar');
  await new Promise(res => setTimeout(res, 800));
  r.enviado = await page.evaluate(() => {
    const f = window.__enviado; const p = window.__payload;
    if (!f) return null;
    return {
      dc: { kmSaida: p.dados_completos.kmSaida, kmEntrada: p.dados_completos.kmEntrada, placaSecundaria: p.dados_completos.placaSecundaria,
            kmSaida2: p.dados_completos.kmSaida2, kmEntrada2: p.dados_completos.kmEntrada2,
            kmTotal: p.dados_completos.kmTotal, kmTotal1: p.dados_completos.kmTotal1, kmTotal2: p.dados_completos.kmTotal2 },
      colunas: { km_saida: p.km_saida, km_chegada: p.km_chegada, km_total: p.km_total },
      abast: p.abastecimentos.map(a => `${a.combustivel}/${a.placa}/${a.litros}`),
      despesas: p.despesas_extras.map(d => `${d.desc}=${d.valor}`)
    };
  });
  r.dialogos = page._dialogos || [];
  r.erros = erros;
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
