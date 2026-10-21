// Cadastro de terceiros: anexo principal com PDF, JPG ou PNG, somando as escolhas (até 3),
// caixinha "Não tenho o PDF nem a foto", payload sem chaves "_foto" e celular sem rolagem lateral.
// Também confere a aba Motoristas do dashboard sem e-mail.
// Só dados inventados (CPF de teste 523.169.159-30).
const { abrir } = require('./harness');
const LARGURAS = (process.argv[2] || '360,390,430').split(',').map(Number);

// Cria os arquivos no navegador (fotos de verdade, para a redução funcionar) e escolhe/solta na zona
const ARQUIVOS_NA_PAGINA = () => {
  window.__arq = {
    async foto(nome, lado, tipo = 'image/png') {
      const c = document.createElement('canvas');
      c.width = lado; c.height = Math.round(lado * 0.6);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3d3d90'; ctx.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, tipo));
      return new File([blob], nome, { type: tipo });
    },
    pdf: (nome, kb = 2) => new File([new Uint8Array(kb * 1024).fill(37)], nome, { type: 'application/pdf' }),
    outro: (nome, tipo) => new File(['x'.repeat(500)], nome, { type: tipo }),
    // "Escolher" pelo input (o mesmo caminho do clique)
    escolher(sel, arquivos) {
      const input = document.querySelector(sel);
      const dt = new DataTransfer();
      arquivos.forEach(f => dt.items.add(f));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    // Arrastar e soltar na zona
    soltar(sel, arquivos) {
      const zona = document.querySelector(sel).closest('.upload-dropzone');
      const dt = new DataTransfer();
      arquivos.forEach(f => dt.items.add(f));
      zona.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    previa: (sel) => Array.from(document.querySelector(sel).closest('.upload-dropzone').querySelectorAll('.file-preview-item'))
      .map(i => (i.querySelector('img') ? '[foto] ' : i.querySelector('.file-preview-icone') ? '[PDF] ' : '') + i.querySelector('.file-preview-nome').textContent),
    async pronto(sel) {
      const zona = document.querySelector(sel).closest('.upload-dropzone');
      for (let i = 0; i < 100 && zona.dataset.processando; i++) await new Promise(r => setTimeout(r, 50));
      return !zona.dataset.processando;
    }
  };
};

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  const r = {};
  const dialogos = () => { const d = page._dialogos || []; page._dialogos = []; return d; };

  await page.goto(`${base}/HTML/FichaMultiCadastro.html`, { waitUntil: 'load' });
  await page.evaluate(ARQUIVOS_NA_PAGINA);
  await page.click('#card-pf');
  await page.select('#pf-tipologia', 'Toco (4×2)');
  await new Promise(res => setTimeout(res, 200));
  const CNH = '#pf-anexo-cnh';

  // Textos da zona, accept e caixinha
  r.zona = await page.evaluate(() => {
    const zonas = Array.from(document.querySelectorAll('#form-pf .upload-dropzone'));
    return {
      zonas: zonas.length,
      accept: [...new Set(zonas.map(z => z.querySelector('input').accept))],
      mouse: [...new Set(zonas.map(z => z.querySelector('.upload-texto-mouse').textContent.trim()))],
      toque: [...new Set(zonas.map(z => z.querySelector('.upload-texto-toque').textContent.trim()))],
      sub: [...new Set(zonas.map(z => z.querySelector('.upload-subtext').textContent.trim()))],
      caixas: Array.from(document.querySelectorAll('#form-pf .cartao-doc .caixa-sem-pdf-texto')).map(c => c.textContent.trim()),
      campoFotoAntigo: document.querySelectorAll('[data-foto], .campo-foto-doc').length
    };
  });

  // 1 foto, depois mais 1, depois mais 1 -> 3
  for (const [nome, lado] of [['frente.png', 300], ['verso.png', 320], ['outra.jpg', 340]]) {
    await page.evaluate(async (sel, nome, lado) => {
      const f = await __arq.foto(nome, lado, nome.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      __arq.escolher(sel, [f]);
    }, CNH, nome, lado);
    await page.evaluate(sel => __arq.pronto(sel), CNH);
  }
  r.tresFotos = await page.evaluate(sel => __arq.previa(sel), CNH);
  r.inputZerado = await page.evaluate(sel => document.querySelector(sel).value === '', CNH);

  // 4º -> aviso e continuam 3
  await page.evaluate(async sel => __arq.escolher(sel, [__arq.pdf('quarto.pdf')]), CNH);
  r.quarto = { aviso: dialogos(), qtd: (await page.evaluate(sel => __arq.previa(sel), CNH)).length };

  // Remover 1 -> 2; escolher o mesmo arquivo de novo -> 3
  await page.evaluate(sel => document.querySelector(sel).closest('.upload-dropzone').querySelectorAll('.file-preview-remover')[1].click(), CNH);
  r.depoisRemover = (await page.evaluate(sel => __arq.previa(sel), CNH)).length;
  await page.evaluate(async sel => __arq.escolher(sel, [await __arq.foto('verso.png', 320)]), CNH);
  await page.evaluate(sel => __arq.pronto(sel), CNH);
  r.mesmoDeNovo = (await page.evaluate(sel => __arq.previa(sel), CNH)).length;
  // Repetido (mesmo nome e tamanho) é ignorado, sem aviso
  dialogos();
  await page.evaluate(async sel => __arq.escolher(sel, [await __arq.foto('verso.png', 320)]), CNH);
  await page.evaluate(sel => __arq.pronto(sel), CNH);
  r.repetido = { qtd: (await page.evaluate(sel => __arq.previa(sel), CNH)).length, aviso: dialogos() };
  // Botão remover com área de toque de 44 px
  r.botaoRemover = await page.evaluate(sel => {
    const b = document.querySelector(sel).closest('.upload-dropzone').querySelector('.file-preview-remover').getBoundingClientRect();
    return `${Math.round(b.width)}x${Math.round(b.height)}`;
  }, CNH);

  // CRLV: 1 PDF + 2 fotos de uma vez (arrastando) -> aceita
  const CRLV = '#pf-anexo-crlv-1';
  await page.evaluate(async sel => __arq.soltar(sel, [__arq.pdf('crlv.pdf'), await __arq.foto('crlv1.png', 200), await __arq.foto('crlv2.jpg', 210, 'image/jpeg')]), CRLV);
  r.pdfMaisFotosPreparando = await page.evaluate(sel => __arq.previa(sel), CRLV);
  await page.evaluate(sel => __arq.pronto(sel), CRLV);
  r.pdfMaisFotos = { previa: await page.evaluate(sel => __arq.previa(sel), CRLV), aviso: dialogos() };

  // RNTRC: .docx e HEIC recusados, os outros continuam
  const RNTRC = '#pf-anexo-rntrc';
  await page.evaluate(sel => __arq.escolher(sel, [
    __arq.pdf('rntrc.pdf'),
    __arq.outro('contrato.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    __arq.outro('foto.heic', 'image/heic')
  ]), RNTRC);
  r.docx = { previa: await page.evaluate(sel => __arq.previa(sel), RNTRC), aviso: dialogos() };
  // PDF acima de 10 MB é recusado
  await page.evaluate(sel => __arq.escolher(sel, [__arq.pdf('grande.pdf', 10 * 1024 + 1)]), RNTRC);
  r.pdfGrande = { qtd: (await page.evaluate(sel => __arq.previa(sel), RNTRC)).length, aviso: dialogos() };

  // Comprovante: marcar "Não tenho o PDF nem a foto" limpa, desabilita a zona e abre o formulário
  const RES = '#pf-anexo-residencia';
  await page.evaluate(sel => __arq.escolher(sel, [__arq.pdf('conta-luz.pdf')]), RES);
  await page.evaluate(() => document.getElementById('pf-sem-pdf-residencia').click()); // o input fica escondido atrás do quadrado
  r.caixinha = await page.evaluate(sel => {
    const input = document.querySelector(sel);
    const cartao = input.closest('.cartao-doc');
    return {
      previa: __arq.previa(sel).length, inputDesabilitado: input.disabled,
      zonaEscondida: cartao.querySelector('.cartao-doc-anexo').hidden,
      formAberto: !cartao.querySelector('.cartao-doc-form').hidden
    };
  }, RES);
  // Soltar arquivo com a caixinha marcada não entra
  await page.evaluate(sel => __arq.soltar(sel, [__arq.pdf('nao-entra.pdf')]), RES);
  r.caixinha.depoisDeSoltar = await page.evaluate(sel => __arq.previa(sel).length, RES);

  // Envio: preenche o resto e captura o corpo enviado à edge function
  await page.evaluate(() => {
    const v = (id, val) => { const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); };
    v('pf-motorista-nome', 'Fulano'); v('pf-motorista-sobrenome', 'de Teste');
    v('pf-cpf', '523.169.159-30'); v('pf-celular', '(11) 90000-0000');
    v('pf-mot-endereco', 'Rua Inventada, 100'); v('pf-mot-cep', '00000-000');
    const uf = document.getElementById('pf-mot-estado');
    uf.value = uf.options[1].value;
    v('pf-mot-cidade', 'Cidade Teste');
    document.getElementById('pf-aceite-lgpd').checked = true;
    window.solicitarCadastroAgregado = async (corpo) => { window.__corpo = corpo; return { sucesso: true, uploads: [] }; };
  });
  // A lista de cidades do IBGE não carrega no teste: a cidade fica como texto livre
  await page.evaluate(() => { const c = document.getElementById('pf-mot-cidade'); c.disabled = false; c.value = 'Cidade Teste'; });
  await page.evaluate(() => document.querySelector('#form-pf button[type="submit"]').click());
  await new Promise(res => setTimeout(res, 300));
  r.revisao = await page.evaluate(() => ({
    aberta: document.getElementById('modal-revisar-cadastro').classList.contains('ativo'),
    linhas: Array.from(document.querySelectorAll('#resumo-cadastro div')).map(d => d.textContent.trim()).filter(t => /CNH|CRLV|RNTRC|Comprovante/.test(t))
  }));
  r.revisao.avisos = [...dialogos(), ...await page.evaluate(() => Array.from(document.querySelectorAll('.aviso-bloco')).map(a => a.textContent))];
  if (r.revisao.aberta) {
    await page.click('#btn-confirmar-envio');
    await new Promise(res => setTimeout(res, 500));
    r.payload = await page.evaluate(() => {
      const c = window.__corpo;
      if (!c) return null;
      return {
        chaves: Object.keys(c.documentos),
        chavesFoto: Object.keys(c.documentos).filter(k => /_foto$/.test(k)),
        documentos: Object.fromEntries(Object.entries(c.documentos).map(([k, l]) => [k, l.map(f => `${f.nome} (${f.tipo})`)])),
        sem_pdf: c.sem_pdf
      };
    });
  }

  // Celular: sem rolagem lateral, com arquivos na prévia
  r.celular = {};
  for (const w of LARGURAS) {
    await page.setViewport({ width: w, height: 780 });
    await page.goto(`${base}/HTML/FichaMultiCadastro.html`, { waitUntil: 'load' });
    await page.evaluate(ARQUIVOS_NA_PAGINA);
    await page.click('#card-pf');
    await page.select('#pf-tipologia', 'Bitrem');
    await page.evaluate(async sel => __arq.escolher(sel, [__arq.pdf('um-nome-de-arquivo-bem-comprido-para-testar-a-quebra.pdf'),
      await __arq.foto('foto-da-cnh-frente.png', 300), await __arq.foto('foto-da-cnh-verso.jpg', 300, 'image/jpeg')]), CNH);
    await page.evaluate(sel => __arq.pronto(sel), CNH);
    r.celular[w] = await page.evaluate(() => {
      const fora = Array.from(document.querySelectorAll('#form-pf *')).filter(el => el.offsetParent !== null)
        .filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > window.innerWidth + 1 || b.left < -1); }).length;
      return `rolagem lateral ${document.documentElement.scrollWidth > window.innerWidth ? 'SIM' : 'não'}, elementos fora da tela: ${fora}`;
    });
  }

  // Dashboard de cadastros: fotos do anexo principal com miniatura; cadastro antigo com "{doc}_foto" igual a antes
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1' })));
  await page.goto(`${base}/HTML/Dashboard-cadastro-motorista.html`, { waitUntil: 'load' });
  r.dashCadastros = await page.evaluate(async () => {
    const doc = (id, campo, n, nome, tipo) => ({ campo, nome, tipo, tamanho: 1000, path: `terceiros/${id}/${campo}_${n}_${nome}` });
    const base = { cpf: '52316915930', celular: '(11) 90000-0000', tipo: 'pf', status: 'pendente', criado_em: '2026-10-20T12:00:00Z', etapas: {} };
    const novo = { ...base, id: 'c-novo', nome: 'Fulano de Teste', dados: { _tipologia: 'Toco (4×2)', _sem_pdf: { cnh: false, crlv_1: false, rntrc: false, residencia: true } },
      documentos: [doc('c-novo', 'cnh', 1, 'frente.jpg', 'image/jpeg'), doc('c-novo', 'cnh', 2, 'verso.png', 'image/png'), doc('c-novo', 'cnh', 3, 'cnh.pdf', 'application/pdf'),
        doc('c-novo', 'crlv_1', 4, 'crlv.pdf', 'application/pdf'), doc('c-novo', 'rntrc', 5, 'rntrc', 'image/jpeg')] };
    const antigo = { ...base, id: 'c-antigo', nome: 'Beltrano de Teste', dados: { _tipologia: 'Toco (4×2)', _sem_pdf: { cnh: true, crlv_1: false, rntrc: false, residencia: false } },
      documentos: [doc('c-antigo', 'cnh_foto', 1, 'foto-cnh.jpg', 'image/jpeg'), doc('c-antigo', 'crlv_1', 2, 'crlv.pdf', 'application/pdf'),
        doc('c-antigo', 'rntrc', 3, 'rntrc.pdf', 'application/pdf'), doc('c-antigo', 'residencia', 4, 'conta.pdf', 'application/pdf')] };
    const todos = [novo, antigo].flatMap(c => c.documentos.map(d => d.path));
    window.supabaseClient = {
      storage: { from: () => ({
        list: async (pasta) => ({ data: todos.filter(p => p.startsWith(pasta + '/')).map(p => ({ name: p.slice(pasta.length + 1) })) }),
        createSignedUrls: async (caminhos) => ({ data: caminhos.map(p => ({ path: p, signedUrl: `https://link.teste/${p}` })) }),
        createSignedUrl: async (p) => ({ data: { signedUrl: `https://link.teste/${p}` } })
      }) }
    };
    cadastros = [novo, antigo];
    const ver = async (c) => {
      await abrirModal(c.id);
      const corpo = document.getElementById('modal-body-content');
      const secoes = Array.from(corpo.querySelectorAll('fieldset.cad-secao')).filter(f => /CNH|CRLV|RNTRC|Comprovante/.test(f.querySelector('legend').textContent));
      const resumo = secoes.map(f => `${f.querySelector('legend').textContent.trim().replace(/\s+/g, ' ')}: ${f.querySelectorAll('.cad-foto-miniatura').length} miniatura(s), ${f.querySelectorAll('[data-acao="abrir-doc"]').length} PDF(s) com Abrir`);
      // Clica na primeira miniatura: abre o lightbox
      const mini = corpo.querySelector('.cad-foto-miniatura');
      if (mini) mini.click();
      await new Promise(res => setTimeout(res, 100));
      const caixa = document.getElementById('lightbox-foto');
      const lightbox = caixa && !caixa.hidden ? document.getElementById('lightbox-titulo').textContent : 'fechado';
      fecharFoto();
      const nomes = Object.values(nomesLegiveis(c));
      const ficha = fichaHtml(c, { enviados: new Set(todos), nomes: nomesLegiveis(c), srcFoto: (x) => `https://link.teste/${x.path}`, imprimir: true });
      const fichaDoc = new DOMParser().parseFromString(ficha, 'text/html');
      const situacoes = Array.from(fichaDoc.querySelectorAll('h2')).map(h => h.textContent.trim().replace(/\s+/g, ' ')).filter(t => /CNH|CRLV|RNTRC|Comprovante/.test(t));
      return { secoes: resumo, lightbox, nomesNoZip: nomes, fichaSituacoes: situacoes, fichaMiniaturas: fichaDoc.querySelectorAll('figure img').length, fichaArquivos: fichaDoc.querySelectorAll('li').length };
    };
    return { novo: await ver(novo), antigo: await ver(antigo) };
  });

  // Dashboard admin -> Motoristas sem e-mail (Chart.js do CDN e login assíncrono simulados, como no t_senha.js)
  await page.evaluateOnNewDocument(() => {
    window.Chart = class { constructor() { this.data = { datasets: [] }; this.options = {}; } update() {} destroy() {} };
    window.Chart.register = () => {};
    let aoAutenticar;
    Object.defineProperty(window, 'ajbAoAutenticar', {
      configurable: true, get: () => aoAutenticar,
      set: (fn) => { aoAutenticar = (...a) => setTimeout(() => fn(...a), 0); }
    });
  });
  r.motoristas = {};
  for (const w of [1280, 360]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
    await new Promise(res => setTimeout(res, 500));
    r.motoristas[w] = await page.evaluate(async () => {
      document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.querySelector('#mot-painel-frota') !== null));
      estadoMotoristas.frota = [
        { id: 'm1', nome: 'Fulano de Teste', cpf: '52316915930', telefone: '11900000000', status: 'aprovado', tem_email: true, email: 'fulano@teste.invalid' },
        { id: 'm2', nome: 'Beltrano de Teste', cpf: '52316915930', telefone: '11900000001', status: 'inativo', tem_email: false }
      ];
      renderizarFrota();
      const colunas = Array.from(document.querySelectorAll('#mot-painel-frota thead th')).map(th => th.textContent.trim());
      const celulasPorLinha = Array.from(document.querySelectorAll('#mot-tbody tr')).map(tr => tr.children.length);
      const cards = Array.from(document.querySelectorAll('#mot-kpis .kpi-card'));
      const pos = cards.map(c => { const b = c.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}px`; });
      // Nenhum resultado: colspan igual ao número de colunas
      document.getElementById('mot-busca').value = 'ninguém com esse nome';
      renderizarFrota();
      const colspan = document.querySelector('#mot-tbody td[colspan]')?.getAttribute('colspan');
      document.getElementById('mot-busca').value = '';
      renderizarFrota();
      // "Adicionar motorista": sem campo e-mail e o corpo enviado não leva email
      let enviado = null;
      chamarGerenciarFrota = async (corpo) => { enviado = corpo; return { ok: true, dados: {} }; };
      carregarAbaMotoristas = async () => {};
      document.getElementById('mot-add-nome').value = 'Fulano de Teste';
      document.getElementById('mot-add-cpf').value = '523.169.159-30';
      document.getElementById('mot-add-celular').value = '(11) 90000-0000';
      document.getElementById('mot-add-senha').value = '';
      await salvarMotoristaFrota();
      return {
        cards: cards.map(c => c.querySelector('.kpi-label').textContent), posicaoCards: pos,
        colunas, celulasPorLinha, colspan,
        textoEmail: /e-mail/i.test(document.getElementById('mot-painel-frota').innerText),
        campoEmail: !!document.getElementById('mot-add-email') || /e-mail/i.test(document.getElementById('modal-mot-adicionar').innerText),
        corpoEnviado: enviado && Object.keys(enviado),
        filtro: Array.from(document.querySelectorAll('#mot-filtro-situacao option')).map(o => o.textContent.trim()),
        abas: Array.from(document.querySelectorAll('[data-mot-aba]')).map(b => b.getAttribute('data-mot-aba')),
        redefinir: document.querySelector('[data-mot-acao="redefinir_senha"]')?.textContent.trim(),
        placeholderBusca: document.getElementById('mot-busca').placeholder,
        rolagemH: document.documentElement.scrollWidth > window.innerWidth
      };
    });
  }

  r.erros = erros.filter(e => !/limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
