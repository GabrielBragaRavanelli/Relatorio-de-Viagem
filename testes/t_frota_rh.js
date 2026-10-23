// Convite "Faça parte da nossa frota" (WhatsApp do RH): linha nova no Login (aba Motorista)
// e card "Faça Parte da Nossa Frota" no Contato, com a mesma altura do card de Filiais.
const { abrir } = require('./harness');
const LINK_RH = 'https://wa.me/5514998627375?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20AJBorges%20e%20gostaria%20de%20fazer%20parte%20da%20frota.';
const CELULAR = [360, 390, 430];

(async () => {
  const { srv, base, browser, page, erros } = await abrir({});
  const r = { login: {}, contato: {} };

  // Login: ordem botão -> linha nova -> linha do cadastro, só na aba Motorista
  for (const w of [1280, ...CELULAR]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${base}/HTML/Login.html`, { waitUntil: 'load' });
    r.login[w] = await page.evaluate((LINK_RH) => {
      const form = document.getElementById('form-motorista');
      const filhos = Array.from(form.children);
      const botao = form.querySelector('.btn-submit');
      const link = Array.from(form.querySelectorAll('a')).find(a => a.href === LINK_RH);
      const linhaNova = link && link.closest('.form-footer');
      const linhaCadastro = form.querySelector('a[href="FichaMultiCadastro.html"]').closest('.form-footer');
      const b = (el) => el.getBoundingClientRect();
      const alturaCard = () => Math.round(b(document.querySelector('.login-card')).height);
      const cardMotorista = alturaCard();
      document.getElementById('tab-admin').click();
      const cardAdmin = alturaCard();
      document.getElementById('tab-motorista').click();
      return {
        texto: linhaNova ? linhaNova.textContent.replace(/\s+/g, ' ').trim() : '(não achou)',
        ordem: linhaNova ? (filhos.indexOf(botao) < filhos.indexOf(linhaNova) && filhos.indexOf(linhaNova) < filhos.indexOf(linhaCadastro) ? 'botão → linha nova → cadastro' : 'ORDEM ERRADA') : '-',
        mesmaClasse: link ? link.className === form.querySelector('a[href="FichaMultiCadastro.html"]').className : false,
        target: link && link.target, rel: link && link.rel,
        espacos: linhaNova ? `botão→nova ${Math.round(b(linhaNova).top - b(botao).bottom)}px, nova→cadastro ${Math.round(b(linhaCadastro).top - b(linhaNova).bottom)}px` : '-',
        linhasDoTexto: linhaNova ? Math.round(b(linhaNova).height) + 'px' : '-',
        linkNoAdmin: Array.from(document.querySelectorAll('#form-admin a')).some(a => a.href.includes('wa.me')),
        cards: `motorista ${cardMotorista}px, admin ${cardAdmin}px`,
        rolagemH: document.documentElement.scrollWidth > window.innerWidth
      };
    }, LINK_RH);
  }

  // Contato: os dois cards da linha de baixo com a mesma altura e botões dos rodapés na mesma linha
  for (const w of [1280, 1440, ...CELULAR]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${base}/HTML/Contato.html`, { waitUntil: 'load' });
    await new Promise(res => setTimeout(res, 300));
    r.contato[w] = await page.evaluate((LINK_RH) => {
      const filiais = document.querySelector('.contato-linha-inferior .info-card-horizontal');
      const frota = document.querySelector('.info-card-atendimento');
      // Rodapé do card de Filiais: o bloco da torre (com o botão do Operacional dentro)
      const rodapeFiliais = filiais.querySelector('.torre-destaque-horizontal');
      const btnFrota = frota.querySelector('.apoio-acoes-botoes a');
      const b = (el) => el.getBoundingClientRect();
      return {
        titulo: frota.querySelector('h3').textContent.trim(),
        label: frota.querySelector('.info-label').textContent.trim(),
        valor: frota.querySelector('.info-valor').textContent.trim(),
        itens: Array.from(frota.querySelectorAll('.fretes-vantagens-lista li')).map(li => li.textContent.replace(/\s+/g, ' ').trim()),
        botao: { texto: btnFrota.textContent.trim(), hrefOk: btnFrota.href === LINK_RH, target: btnFrota.target, rel: btnFrota.rel, classes: btnFrota.className, tamanho: `${Math.round(b(btnFrota).width)}x${Math.round(b(btnFrota).height)}`, cor: getComputedStyle(btnFrota).backgroundImage.slice(0, 60) },
        alturas: `filiais ${Math.round(b(filiais).height)}px, frota ${Math.round(b(frota).height)}px`,
        diferencaAltura: Math.round(Math.abs(b(filiais).height - b(frota).height)),
        rodapes: `fundo: rodapé de filiais ${Math.round(b(rodapeFiliais).bottom)}, botão da frota ${Math.round(b(btnFrota).bottom)}`,
        diferencaRodape: Math.round(Math.abs(b(rodapeFiliais).bottom - b(btnFrota).bottom)),
        linkFretesAindaNoCard: !!frota.querySelector('a[href="Nossosfretes.html"]'),
        rolagemH: document.documentElement.scrollWidth > window.innerWidth
      };
    }, LINK_RH);
  }
  r.erros = erros.filter(e => !/limparDadosLocais/.test(e));
  console.log(JSON.stringify(r, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
