// Servidor estático do projeto + Chrome headless com auth/Supabase simulados.
// Uso (na raiz do projeto, uma vez): npm i --no-save puppeteer-core@23.11.1 @electric-sql/pglite@0.2.17
// Depois: node testes/t_ficha.js [largura] [altura]   (Chrome em CHROME=... se não estiver no caminho padrão;
// a altura também vale por ALTURA=... para os outros testes; padrão 900)
// Nada vai para o Supabase: auth.js é trocado por um usuário de teste e o CDN fica vazio.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const RAIZ = process.env.RAIZ || path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const AUTH_STUB = `
window.ajbAuth = { vigiarSessao(){}, sair(){} };
window.ajbAoAutenticar = function (papeis, destino, cb) {
  const u = JSON.parse(localStorage.getItem('teste_usuario') || '{"role":"motorista","nome":"Motorista Teste","id":"u1","cpf":"12345678900"}');
  localStorage.setItem('ajborges_usuario_ativo', JSON.stringify(u));
  document.documentElement.style.visibility = '';
  cb(u);
};`;

function iniciarServidor() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/JavaScript/auth.js') { resp.writeHead(200, { 'Content-Type': TIPOS['.js'] }); return resp.end(AUTH_STUB); }
      const arq = path.join(RAIZ, url);
      fs.readFile(arq, (err, dados) => {
        if (err) { resp.writeHead(404); return resp.end(); }
        resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream' });
        resp.end(dados);
      });
    });
    srv.listen(0, () => res(srv));
  });
}

async function abrir(opcoes = {}) {
  const srv = await iniciarServidor();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('dialog', d => { (page._dialogos = page._dialogos || []).push(d.message()); d.accept(); });
  // Depois de navegar, espera a página assentar (digitar cedo demais perde teclas no headless)
  const irOriginal = page.goto.bind(page);
  page.goto = async (...args) => { const r = await irOriginal(...args); await new Promise(res => setTimeout(res, 300)); return r; };
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(base)) return r.respond({ status: 200, contentType: 'text/javascript', body: '' });
    r.continue();
  });
  await page.setViewport({ width: opcoes.largura || 1280, height: opcoes.altura || Number(process.env.ALTURA) || 900 });
  return { srv, base, browser, page, erros };
}

module.exports = { abrir };
