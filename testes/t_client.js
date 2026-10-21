// Testa o mapeamento ida/volta do supabase-client.js em Node (sem Supabase)
const fs = require('fs'); const vm = require('vm');
const ls = {}; const ctx = { window: {}, console, localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; } } };
ctx.window.addEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname, '../JavaScript/supabase-client.js'), 'utf8'), ctx);
const ficha = { id: 'X', placas: 'abc-1d23', kmSaida: '100.000', kmEntrada: '101.500', placaSecundaria: 'xyz-9a87', kmSaida2: '200.000', kmEntrada2: '200.800',
  kmTotal1: '1500', kmTotal2: '800', kmTotal: '2.300', km_total: '2.300', mediaKmL: '2.44', mediaPrincipal: '2.5', mediaSecundaria: 'abc',
  abastecimentos: [{ litros: '100', combustivel: 'diesel_s10', placa: 'principal' }, { litros: '20', combustivel: 'gasolina', placa: 'XXX' }] };
ficha.dados_completos = { ...ficha };
ls.ajborges_usuario_ativo = JSON.stringify({ role: 'motorista' });
const m = ctx.mapearFichaParaSupabase(ficha);
console.log('motorista:', JSON.stringify({ placas: m.placas, media_km_l: m.media_km_l, km_total: m.km_total,
  dc: { placas: m.dados_completos.placas, s: m.dados_completos.kmSaida, e: m.dados_completos.kmEntrada, p: m.dados_completos.placaSecundaria, s2: m.dados_completos.kmSaida2, e2: m.dados_completos.kmEntrada2, t: m.dados_completos.kmTotal, t1: m.dados_completos.kmTotal1,
        mP: m.dados_completos.mediaPrincipal, mS: m.dados_completos.mediaSecundaria }, ab: m.abastecimentos }));
ls.ajborges_usuario_ativo = JSON.stringify({ role: 'admin' });
const a = ctx.mapearFichaParaSupabase({ ...ficha, placas: 'ABC-1D23' });
console.log('gestão:', JSON.stringify({ placas: a.placas, media_km_l: a.media_km_l, km_total: a.km_total, t: a.dados_completos.kmTotal, t1: a.dados_completos.kmTotal1, t2: a.dados_completos.kmTotal2 }));
// Volta: registro como o banco devolve (passo 12) e ficha antiga
const novo = ctx.mapearFichaDoSupabase({ id: 'X', placas: 'ABC1D23', km_saida: 100000, km_chegada: 101500, km_total: 2300, abastecimentos: [{ litros: '20', combustivel: 'arla', placa: 'secundaria' }],
  dados_completos: { placas: 'ABC1D23', kmSaida: '100000', kmEntrada: '101500', placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '200800', kmTotal1: '1500', kmTotal2: '800', kmTotal: '2300', mediaPrincipal: '2.50', mediaSecundaria: '3.00' } });
console.log('leitura nova:', JSON.stringify({ placas: novo.placas, s: novo.kmSaida, e: novo.kmEntrada, c: novo.kmChegada, p: novo.placaSecundaria, s2: novo.kmSaida2, t1: novo.kmTotal1, t2: novo.kmTotal2, t: novo.kmTotal, mP: novo.mediaPrincipal, mS: novo.mediaSecundaria, ab: novo.abastecimentos }));
const antiga = ctx.mapearFichaDoSupabase({ id: 'Y', placas: 'DEF-5678', km_saida: 5000, km_chegada: 6000, km_total: 1000, abastecimentos: [{ litros: '50', valor: '300,00' }], dados_completos: { kmChegada: '6000' } });
console.log('leitura antiga:', JSON.stringify({ placas: antiga.placas, s: antiga.kmSaida, e: antiga.kmEntrada, c: antiga.kmChegada, p: antiga.placaSecundaria, t1: antiga.kmTotal1, t: antiga.kmTotal, ab: antiga.abastecimentos }));
const soDc = ctx.mapearFichaDoSupabase({ id: 'Z', placas: null, dados_completos: { kmEntrada: '7000' } });
console.log('leitura só dados_completos.kmEntrada:', JSON.stringify({ placas: soDc.placas, e: soDc.kmEntrada, c: soDc.kmChegada }));
