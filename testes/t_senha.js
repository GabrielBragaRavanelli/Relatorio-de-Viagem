// Frota sem troca de senha: a ficha abre direto, o login não tem recuperação por e-mail
// e a aba Motoristas não fala mais de "trocar a senha"
const fs = require('fs');
const path = require('path');
const { abrir } = require('./harness');
const LARGURAS = (process.argv[2] || '360,390,430').split(',').map(Number);
const PROIBIDOS = /trocar-senha-frota\.js|recuperar-senha\.js/;

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  const r = {};

  // Nenhuma página carrega os scripts que saíram (olhando o HTML e o que o navegador pede)
  const pastaHtml = path.resolve(__dirname, '../HTML');
  r.paginasComScriptAntigo = fs.readdirSync(pastaHtml).filter(f => f.endsWith('.html'))
    .filter(f => PROIBIDOS.test(fs.readFileSync(path.join(pastaHtml, f), 'utf8')));
  r.arquivosAntigosExistem = ['JavaScript/trocar-senha-frota.js', 'JavaScript/recuperar-senha.js', 'HTML/recuperar-senha.html', 'CSS/recuperar-senha.css']
    .filter(f => fs.existsSync(path.resolve(__dirname, '..', f)));
  const pedidos = [];
  page.on('request', q => pedidos.push(q.url()));

  // Ficha: motorista frota com trocar_senha true abre direto, sem modal
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('teste_usuario', JSON.stringify({
    role: 'motorista', nome: 'Motorista Frota', id: 'u2', cpf: '12345678900', vinculo: 'frota', trocar_senha: true, senha_provisoria: true
  })));
  await page.goto(`${base}/HTML/relatorio-viagem.html`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 500));
  r.ficha = await page.evaluate(() => ({
    modalSenha: !!document.getElementById('modal-senha-frota') || !!document.querySelector('[class*="msf-"]'),
    modalAberto: Array.from(document.querySelectorAll('.modal-overlay-custom.ativo, .modal-overlay.ativo')).map(m => m.id),
    rolagemTravada: getComputedStyle(document.body).overflow === 'hidden',
    botaoIniciarVisivel: !!document.getElementById('btn-iniciar-relatorio')?.offsetParent,
    textoSenha: /trocar (a )?senha|criar uma senha|cadastrar (o )?e-mail|senha provisória/i.test(document.body.innerText)
  }));

  // Login: texto no lugar do link, nas duas abas
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'load' });
  r.login = await page.evaluate(() => ({
    motorista: document.querySelector('#form-motorista .texto-esqueceu')?.textContent.trim(),
    admin: document.querySelector('#form-admin .texto-esqueceu')?.textContent.trim(),
    linkRecuperar: document.querySelectorAll('a[href*="recuperar-senha"], .link-recuperar').length
  }));
  r.login.rolagemH = {};
  for (const w of LARGURAS) {
    await page.setViewport({ width: w, height: 780 });
    await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'load' });
    r.login.rolagemH[w] = {};
    for (const aba of ['motorista', 'admin']) {
      await page.click(`#tab-${aba}`);
      await new Promise(res => setTimeout(res, 200));
      r.login.rolagemH[w][aba] = await page.evaluate(() => {
        const t = document.querySelector('.tab-content.active .texto-esqueceu').getBoundingClientRect();
        return `${document.documentElement.scrollWidth > window.innerWidth ? 'SIM' : 'não'}, texto ${t.right <= window.innerWidth ? 'cabe' : 'NÃO cabe'}`;
      });
    }
  }
  await page.setViewport({ width: 1280, height: 900 });

  // Dashboard → Motoristas (Chart.js vem do CDN, que fica vazio no teste: sem ele o script para no meio)
  await page.evaluateOnNewDocument(() => {
    window.Chart = class { constructor() { this.data = { datasets: [] }; this.options = {}; } update() {} destroy() {} };
    window.Chart.register = () => {};
    // No site o login responde depois (assíncrono); o stub síncrono rodaria antes das const do dashboard-admin.js
    let aoAutenticar;
    Object.defineProperty(window, 'ajbAoAutenticar', {
      configurable: true, get: () => aoAutenticar,
      set: (fn) => { aoAutenticar = (...a) => setTimeout(() => fn(...a), 0); }
    });
  });
  await page.evaluate(() => localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão', id: 'a1' })));
  await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 500));
  r.motoristas = await page.evaluate(async () => {
    estadoMotoristas.frota = [
      { id: 'm1', nome: 'Ana Souza', cpf: '11122233344', telefone: '14999990000', status: 'aprovado', senha_provisoria: true, tem_email: false },
      { id: 'm2', nome: 'Bruno Lima', cpf: '55566677788', telefone: '14988880000', status: 'aprovado', senha_provisoria: false, tem_email: true, email: 'b@x.com' },
      { id: 'm3', nome: 'Caio Rocha', cpf: '99988877766', telefone: '14977770000', status: 'inativo', senha_provisoria: true, tem_email: false }
    ];
    renderizarFrota();
    const painel = document.getElementById('mot-painel-frota');
    const texto = painel.innerText;
    const opcoes = Array.from(document.querySelectorAll('#mot-filtro-situacao option')).map(o => o.textContent.trim());
    const linhas = (filtro) => {
      document.getElementById('mot-filtro-situacao').value = filtro;
      renderizarFrota();
      return Array.from(document.querySelectorAll('#mot-tbody tr strong')).map(s => s.textContent);
    };
    // Redefinir: confirmação e mensagem novas (sem chamar o servidor)
    const toasts = [];
    chamarGerenciarFrota = async () => ({ ok: true, dados: {} });
    carregarAbaMotoristas = async () => {};
    exibirToast = (msg) => toasts.push(msg);
    document.getElementById('mot-filtro-situacao').value = '';
    renderizarFrota();
    const botao = document.querySelector('[data-mot-acao="redefinir_senha"][data-id="m1"]');
    const rotuloBotao = botao?.textContent.trim();
    await executarAcaoMotorista('redefinir_senha', 'm1');
    return {
      cards: Array.from(document.querySelectorAll('#mot-kpis .kpi-label')).map(l => l.textContent),
      opcoes,
      btnExportar: !!document.getElementById('mot-btn-exportar'),
      selos: Array.from(document.querySelectorAll('#mot-tbody .status-pill')).map(s => s.textContent),
      falaDeTroca: /trocar|trocou|trocaram|provisória/i.test(texto),
      validos: linhas('validos'), inativos: linhas('inativo'),
      rotuloBotao, toasts,
      abas: Array.from(document.querySelectorAll('[data-mot-aba]')).map(b => b.getAttribute('data-mot-aba')),
      textoAdicionar: document.getElementById('modal-mot-adicionar').innerText.replace(/\s+/g, ' ').match(/[^.]*(primeiro acesso|trocar|senha própria)[^.]*/gi) || []
    };
  });
  r.motoristas.confirmacao = (page._dialogos || []).pop();
  r.scriptsPedidos = pedidos.filter(u => PROIBIDOS.test(u));
  r.erros = erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
