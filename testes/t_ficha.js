// Simulação da ficha do motorista: placa principal obrigatória, KM Chegada, 2º trecho obrigatório
// com placa secundária, média de combustível amarrada à placa (ARLA fora), revisão e envio
const { abrir } = require('./harness');

(async () => {
  const { srv, base, browser, page, erros } = await abrir({ largura: Number(process.argv[2] || 1280), altura: Number(process.argv[3] || 0) || undefined });
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  // Captura o envio em vez de chamar o Supabase
  await page.evaluate(() => {
    window.reservarNumeroFichaSupabase = async () => 'AJB-2026-999';
    window.salvarFichaSupabase = async (f) => { window.__enviado = f; window.__payload = window.mapearFichaParaSupabase(f); return { success: true }; };
  });

  const digitar = async (sel, txt) => { await page.focus(sel); await page.keyboard.type(txt); };
  const limparEDigitar = async (sel, txt) => { await page.$eval(sel, el => { el.value = ''; }); await digitar(sel, txt); await page.$eval(sel, el => el.blur()); };
  const tentarEnviar = async () => {
    await page.click('#btn-finalizar-relatorio-ml');
    await new Promise(res => setTimeout(res, 200));
    return page.evaluate(() => ({
      revisaoAberta: document.querySelector('#modal-revisar-envio').classList.contains('ativo'),
      erros: Array.from(document.querySelectorAll('.erro-campo-celular')).map(e => e.textContent)
    }));
  };
  const card = () => page.evaluate(() => {
    const vis = (el) => el && !el.hidden;
    const valor = document.getElementById('ml-indicador-media-combustivel');
    const porPlaca = document.getElementById('ml-media-por-placa');
    return {
      valorUnico: vis(valor) ? valor.textContent.trim().replace(/\s+/g, ' ') + ' | ' + document.getElementById('ml-media-base-geral').textContent.trim().replace(/\s+/g, ' ') : '(oculto)',
      porPlaca: vis(porPlaca) ? Array.from(porPlaca.querySelectorAll('.media-placa')).map(m => m.innerText.replace(/\s+/g, ' ')) : '(oculto)'
    };
  });
  const linhaAbast = async (i, comb, placa, litros, valor = '10000') => {
    await page.evaluate((i) => { const tr = document.querySelector(`[name="posto_ml_${i}"]`).closest('tr'); tr.classList.remove('linha-oculta-celular'); tr.hidden = false; }, i);
    await page.select(`[name="posto_ml_${i}"]`, 'Marília - Posto Esmeralda');
    await page.select(`[name="combustivel_ml_${i}"]`, comb);
    if (placa) await page.select(`[name="placa_abast_ml_${i}"]`, placa);
    await limparEDigitar(`[name="valor_ml_${i}"]`, valor);
    await limparEDigitar(`[name="litros_ml_${i}"]`, litros);
  };
  const r = {};

  // 7. Nenhum "KM Entrada" / "KM de entrada" nas telas (textos, placeholders e mensagens escondidas)
  r.textoEntrada = await page.evaluate(() => {
    const textos = [document.body.textContent, ...Array.from(document.querySelectorAll('[placeholder]')).map(e => e.placeholder)];
    return textos.join(' ').match(/km\s+(de\s+)?entrada|entrada\s*−\s*saída/gi) || 'nenhum';
  });
  r.placaPrincipal = await page.$eval('#placas', el => ({ editavel: !el.readOnly && el.tabIndex !== -1, required: el.required, placeholder: el.placeholder,
    rotulo: el.closest('.campo-grupo').querySelector('.label-com-tag').textContent.replace(/\s+/g, ' ').trim() }));

  // 1. Sem a placa principal a ficha não envia
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '105000');
  await linhaAbast(1, 'diesel_s10', null, '1000');
  r.semPlaca = await tentarEnviar();

  // 2. Placa principal aceita "abc1d23" (máscara) e mostra ABC-1D23
  await digitar('#placas', 'abc1d23');
  r.placaFormatada = await page.$eval('#placas', el => el.value);

  // 4. Só principal: 5.000 km, 2 linhas de diesel com 1.000 L e 1 de ARLA com 50 L -> 2,50 (sem ARLA)
  await linhaAbast(2, 'diesel_s500', null, '1000');
  await linhaAbast(3, 'arla', null, '50');
  r.soPrincipal = await card();

  // Secundária igual à principal não envia
  await digitar('#placa-secundaria', 'ABC1D23');
  r.secundariaIgual = (await tentarEnviar()).erros;
  await page.$eval('#placa-secundaria', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });

  // 3. Com secundária e sem os KMs do 2º trecho não envia
  await digitar('#placa-secundaria', 'xyz9a87');
  r.secundaria = await page.evaluate(() => ({
    valor: document.querySelector('#placa-secundaria').value,
    blocoVisivel: !document.querySelector('#bloco-km-secundaria').hidden,
    required: [document.querySelector('#km-saida-2').required, document.querySelector('#km-chegada-2').required],
    rotulos: Array.from(document.querySelectorAll('#bloco-km-secundaria label')).map(l => l.textContent.trim())
  }));
  r.semKmSecundaria = await tentarEnviar();
  r.opcoesPlaca = await page.$eval('[name="placa_abast_ml_1"]', s => Array.from(s.options).map(o => `${o.value}=${o.textContent}`));

  // 5. Duas placas: principal 5.000 km, 3 linhas de diesel = 2.000 L + 1 ARLA; secundária 6.000 km, 2 linhas = 2.400 L
  await digitar('#km-saida-2', '200000');
  await digitar('#km-chegada-2', '206000');
  await linhaAbast(1, 'diesel_s10', 'principal', '800');
  await linhaAbast(2, 'diesel_s500', 'principal', '700');
  await linhaAbast(3, 'arla', 'principal', '50');
  await linhaAbast(4, 'diesel_s10', 'principal', '500');
  await linhaAbast(5, 'diesel_s10', 'secundaria', '1200');
  await linhaAbast(6, 'diesel_s500', 'secundaria', '1200');
  r.duasPlacasIguais = await card();
  // Litros diferentes: secundária com 2.000 L (3,00) e principal com 2.500 L (2,00)
  await limparEDigitar('[name="litros_ml_6"]', '800');
  await limparEDigitar('[name="litros_ml_4"]', '1000');
  r.duasPlacasDiferentes = await card();
  // Secundária sem litros de diesel: "—" só para ela
  await page.select('[name="placa_abast_ml_5"]', 'principal');
  await page.select('[name="placa_abast_ml_6"]', 'principal');
  r.secundariaSemLitros = await card();
  await page.select('[name="placa_abast_ml_5"]', 'secundaria');
  await page.select('[name="placa_abast_ml_6"]', 'secundaria');

  // Revisão e envio (com as duas placas): datas, destino inicial e adiantamento são obrigatórios
  // para o motorista; destino final é opcional (passo 14)
  const mudar = (sel, v) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  r.datasDoMotorista = await page.evaluate(() => ['#data-saida', '#data-chegada'].map(sel => {
    const el = document.querySelector(sel);
    const btn = el.parentElement.querySelector('.btn-picker-data');
    return `${sel}: ${el.readOnly ? 'SÓ LEITURA' : 'editável'}, tag "${el.closest('.campo-grupo').querySelector('.tag-motorista')?.textContent || '(sem)'}", ` +
      `calendário ${btn.disabled || btn.style.pointerEvents === 'none' ? 'DESLIGADO' : 'ligado'}, obrigatório ${el.required}`;
  }));
  r.semDatas = (await tentarEnviar()).erros;
  await digitar('#data-saida', '01102026');
  r.semChegada = (await tentarEnviar()).erros;
  // Calendário da chegada: o seletor nativo preenche o campo
  await page.$eval('#data-chegada-picker', el => { el.value = '2026-09-30'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  r.chegadaPeloCalendario = await page.$eval('#data-chegada', el => el.value);
  r.chegadaAntes = (await tentarEnviar()).erros;
  await mudar('#data-chegada', '');
  await digitar('#data-chegada', '05102026');
  r.semDestinoInicial = (await tentarEnviar()).erros;
  await mudar('#destino-inicial', 'Marília - SP');
  r.destinoFinal = await page.$eval('#destino-final', el => ({ obrigatorio: el.required, rotulo: el.closest('.campo-grupo').querySelector('label').textContent.replace(/\s+/g, ' ').trim(), valor: el.value || '(vazio)' }));
  await digitar('#valor-adiantamento', '0');
  r.envio = await tentarEnviar();
  r.revisao = await page.$eval('#revisar-detalhes-viagem', el => el.innerText.replace(/\n+/g, ' | '));
  // Confirmar visível e clicável sem rolar a página: dentro da tela e é o elemento no ponto do clique
  r.modalRevisao = await page.evaluate(() => {
    const card = document.querySelector('#modal-revisar-envio .modal-card-custom').getBoundingClientRect();
    const b = document.getElementById('btn-revisar-confirmar').getBoundingClientRect();
    const noPonto = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      tela: `${window.innerWidth}x${window.innerHeight}`,
      card: `${Math.round(card.height)}px, ${card.top >= 0 && card.bottom <= window.innerHeight ? 'cabe na tela' : 'NÃO cabe'}`,
      confirmarVisivel: b.top >= 0 && b.bottom <= window.innerHeight,
      confirmarClicavel: !!noPonto && noPonto.closest('#btn-revisar-confirmar') !== null,
      rolagemDaPagina: window.scrollY
    };
  });
  await page.click('#btn-revisar-confirmar');
  await new Promise(res => setTimeout(res, 800));
  r.enviado = await page.evaluate(() => {
    const p = window.__payload;
    if (!p) return null;
    const dc = p.dados_completos;
    return {
      placas: p.placas, dcPlacas: dc.placas,
      dc: { kmSaida: dc.kmSaida, kmEntrada: dc.kmEntrada, placaSecundaria: dc.placaSecundaria, kmSaida2: dc.kmSaida2, kmEntrada2: dc.kmEntrada2 },
      medias: { mediaPrincipal: dc.mediaPrincipal, mediaSecundaria: dc.mediaSecundaria, media_km_l: p.media_km_l },
      abast: p.abastecimentos.map(a => `${a.combustivel}/${a.placa}/${a.litros}`),
      destinos: [p.destino_inicial, p.destino_final, p.valor_adiantamento],
      datas: { data_saida: p.data_saida, data_chegada: p.data_chegada, dcSaida: dc.dataSaida, dcChegada: dc.dataChegada },
      totaisAbastecimento: { total: dc.totalAbastecimento, diesel: dc.totalDiesel, arla: dc.totalArla }
    };
  });

  // 6. Apagar a placa secundária volta as linhas para "principal" e mostra uma média só
  await page.evaluate(() => localStorage.removeItem('ajborges_relatorio_viagem_ml_draft'));
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  await digitar('#placas', 'ABC1D23');
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '105000');
  await digitar('#placa-secundaria', 'XYZ9A87');
  await digitar('#km-saida-2', '200000');
  await digitar('#km-chegada-2', '206000');
  await linhaAbast(1, 'diesel_s10', 'principal', '1000');
  await linhaAbast(2, 'diesel_s10', 'secundaria', '1000');
  r.antesDeApagar = await card();
  await page.$eval('#placa-secundaria', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  r.depoisDeApagar = {
    ...(await card()),
    placas: await page.evaluate(() => [1, 2].map(i => document.querySelector(`[name="placa_abast_ml_${i}"]`).value)),
    km2: await page.evaluate(() => [document.querySelector('#km-saida-2').value, document.querySelector('#km-chegada-2').value, document.querySelector('#km-saida-2').required])
  };

  // ARLA na média (passo 14): 1.500 km, 2 linhas de diesel (200 L e 100 L) e 1 de ARLA (50 L) = 1.500 ÷ 350 = 4,29
  await page.evaluate(() => localStorage.removeItem('ajborges_relatorio_viagem_ml_draft'));
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.reservarNumeroFichaSupabase = async () => 'AJB-2026-998';
    window.salvarFichaSupabase = async (f) => { window.__payload = window.mapearFichaParaSupabase(f); return { success: true }; };
  });
  await digitar('#placas', 'ABC1D23');
  await digitar('#data-saida', '01102026');
  await digitar('#data-chegada', '05102026');
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '101500');
  await page.$eval('#destino-inicial', el => { el.value = 'Marília - SP'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await digitar('#valor-adiantamento', '0');
  await linhaAbast(1, 'diesel_s10', null, '200');
  await linhaAbast(2, 'diesel_s500', null, '100');
  await linhaAbast(3, 'arla', null, '50');
  r.mediaComArla = await card();
  r.mediaComArlaEnvio = await tentarEnviar();
  r.mediaComArlaRevisao = await page.$eval('#revisar-detalhes-viagem', el => (el.innerText.match(/Média[^\n]*\n[^\n]*/g) || []).map(t => t.replace(/\n/g, ': ')));
  await page.click('#btn-revisar-confirmar');
  await new Promise(res => setTimeout(res, 600));
  r.mediaComArlaPayload = await page.evaluate(() => window.__payload && { media_km_l: window.__payload.media_km_l, mediaPrincipal: window.__payload.dados_completos.mediaPrincipal });

  // Duas placas: cada placa soma as suas linhas, inclusive ARLA.
  // Principal 1.000 km ÷ (150 diesel + 50 ARLA) = 5,00; secundária 900 km ÷ (200 diesel + 25 ARLA) = 4,00
  await page.evaluate(() => localStorage.removeItem('ajborges_relatorio_viagem_ml_draft'));
  await page.goto(`${base}/HTML/relatorio-viagem.html?novo=true`, { waitUntil: 'load' });
  await digitar('#placas', 'ABC1D23');
  await digitar('#km-saida', '100000');
  await digitar('#km-chegada', '101000');
  await digitar('#placa-secundaria', 'XYZ9A87');
  await digitar('#km-saida-2', '200000');
  await digitar('#km-chegada-2', '200900');
  await linhaAbast(1, 'diesel_s10', 'principal', '150');
  await linhaAbast(2, 'arla', 'principal', '50');
  await linhaAbast(3, 'diesel_s10', 'secundaria', '200');
  await linhaAbast(4, 'arla', 'secundaria', '25');
  r.duasPlacasComArla = await card();

  r.dialogos = page._dialogos || [];
  r.erros = erros;
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
