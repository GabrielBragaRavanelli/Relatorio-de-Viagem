// Aba Motoristas → Frota: filtro "Veículo" (tipo_veiculo) junto com a busca e a Situação,
// contador "X de Y" e barra sem rolagem lateral no celular. Dados inventados.
const { abrir } = require('./harness');
const LARGURAS = (process.argv[2] || '1280,360,390,430').split(',').map(Number);

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  const r = {};
  // Chart.js vem do CDN, que fica vazio no teste; o login responde depois (assíncrono), como no site
  await page.evaluateOnNewDocument(() => {
    window.Chart = class { constructor() { this.data = { datasets: [] }; this.options = {}; } update() {} destroy() {} };
    window.Chart.register = () => {};
    let aoAutenticar;
    Object.defineProperty(window, 'ajbAoAutenticar', {
      configurable: true, get: () => aoAutenticar,
      set: (fn) => { aoAutenticar = (...a) => setTimeout(() => fn(...a), 0); }
    });
  });
  await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('teste_usuario', JSON.stringify({ role: 'admin', nome: 'Gestão Teste', id: 'a1' })));

  for (const w of LARGURAS) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${base}/HTML/dashboard-admin.html`, { waitUntil: 'load' });
    await new Promise(res => setTimeout(res, 500));
    r[w] = await page.evaluate(() => {
      document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.querySelector('#mot-painel-frota') !== null));
      estadoMotoristas.frota = [
        { id: 'm1', nome: 'Alfa Carreta Ficticio', cpf: '11122233344', telefone: '14999990001', status: 'aprovado', tipo_veiculo: 'carreta' },
        { id: 'm2', nome: 'Beta Rodotrem Ficticio', cpf: '55566677788', telefone: '14999990002', status: 'aprovado', tipo_veiculo: 'rodotrem' },
        { id: 'm3', nome: 'Gama Ambos Ficticio', cpf: '99988877766', telefone: '14999990003', status: 'inativo', tipo_veiculo: 'carreta_rodotrem' }
      ];
      const nomes = () => Array.from(document.querySelectorAll('#mot-tbody tr strong')).map(s => s.textContent);
      const filtrar = ({ veiculo = '', situacao = '', busca = '' }) => {
        document.getElementById('mot-filtro-veiculo').value = veiculo;
        document.getElementById('mot-filtro-situacao').value = situacao;
        document.getElementById('mot-busca').value = busca;
        document.getElementById('mot-filtro-veiculo').dispatchEvent(new Event('change', { bubbles: true }));
        return `${nomes().join(', ') || '(nenhum)'} — ${document.getElementById('mot-info-registros').textContent}`;
      };
      const casos = {
        todos: filtrar({}),
        carreta: filtrar({ veiculo: 'carreta' }),
        rodotrem: filtrar({ veiculo: 'rodotrem' }),
        carretaOuRodotrem: filtrar({ veiculo: 'carreta_rodotrem' }),
        rodotremComBuscaBeta: filtrar({ veiculo: 'rodotrem', busca: 'beta' }),
        rodotremComBuscaAlfa: filtrar({ veiculo: 'rodotrem', busca: 'alfa' }),
        ambosValidos: filtrar({ veiculo: 'carreta_rodotrem', situacao: 'validos' }),
        ambosInativos: filtrar({ veiculo: 'carreta_rodotrem', situacao: 'inativo' }),
        carretaValidosBusca: filtrar({ veiculo: 'carreta', situacao: 'validos', busca: '14999990001' })
      };
      filtrar({});
      const sel = document.getElementById('mot-filtro-veiculo').getBoundingClientRect();
      const barra = document.querySelector('.mot-toolbar').getBoundingClientRect();
      return {
        opcoes: Array.from(document.querySelectorAll('#mot-filtro-veiculo option')).map(o => `${o.value || '(vazio)'}=${o.textContent.trim()}`),
        padrao: document.getElementById('mot-filtro-veiculo').value || '(Todos)',
        casos,
        cards: Array.from(document.querySelectorAll('#mot-kpis .kpi-label')).map(l => l.textContent),
        selectDentroDaBarra: sel.left >= barra.left - 1 && sel.right <= barra.right + 1 && sel.width > 0,
        rolagemH: document.documentElement.scrollWidth > window.innerWidth
      };
    });
  }
  r.erros = erros.filter(e => !/Chart is not defined|limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
