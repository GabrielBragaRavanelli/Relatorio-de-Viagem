// Header das páginas: linhas de links, altura, logo, rolagem horizontal e se cobre o conteúdo
const { abrir } = require('./harness');
const PAGINAS = (process.argv[3] || 'index,Contato,FichaMultiCadastro,Login,Nossosfretes,Sobrenos,politica-privacidade,relatorio-viagem').split(',');
const LARGURAS = (process.argv[2] || '320,360,390,430,641,700,780,781,860,900,1024,1280,1440').split(',').map(Number);

(async () => {
  const { srv, base, browser, page } = await abrir({});
  const linhas = [];
  for (const pag of PAGINAS) {
    for (const w of LARGURAS) {
      await page.setViewport({ width: w, height: 800 });
      await page.goto(`${base}/HTML/${pag}.html${pag === 'relatorio-viagem' ? '?novo=true' : ''}`, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 150));
      const m = await page.evaluate(() => {
        const lis = Array.from(document.querySelectorAll('.lista-links li'));
        const tops = new Set(lis.map(li => Math.round(li.getBoundingClientRect().top)));
        const header = document.querySelector('header');
        const logo = document.querySelector('.logotipo-AJBorges img');
        const quebrados = lis.filter(li => li.querySelector('a').getClientRects().length && li.querySelector('a').getBoundingClientRect().height > 50).length;
        // Conteúdo coberto: primeiro elemento do main começa embaixo do header?
        const main = document.querySelector('main') || document.body.children[1];
        const cobre = getComputedStyle(header).position === 'fixed' && main && (main.firstElementChild || main).getBoundingClientRect().top < header.getBoundingClientRect().bottom - 1;
        return {
          links: lis.length, linhas: tops.size, alturaHeader: Math.round(header.getBoundingClientRect().height),
          posicao: getComputedStyle(header).position, logo: Math.round(logo.getBoundingClientRect().height),
          fonte: getComputedStyle(lis[0].querySelector('a')).fontSize, rolagemH: document.documentElement.scrollWidth > window.innerWidth,
          linkQuebrado: quebrados, cobre
        };
      });
      linhas.push(`${pag.padEnd(21)} ${String(w).padStart(4)}px  links=${m.links} linhas=${m.linhas} header=${m.alturaHeader}px ${m.posicao.padEnd(8)} logo=${m.logo}px fonte=${m.fonte} rolagemH=${m.rolagemH ? 'SIM' : 'não'} cobre=${m.cobre ? 'SIM' : 'não'} quebra2l=${m.linkQuebrado}`);
    }
  }
  console.log(linhas.join('\n'));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
