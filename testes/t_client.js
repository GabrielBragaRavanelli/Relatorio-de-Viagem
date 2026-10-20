// Testa o mapeamento ida/volta do supabase-client.js em Node (sem Supabase)
const fs = require('fs'); const vm = require('vm');
const ls = {}; const ctx = { window: {}, console, localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; } } };
ctx.window.addEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname, '../JavaScript/supabase-client.js'), 'utf8'), ctx);
const ficha = { id: 'X', kmSaida: '100.000', kmEntrada: '101.500', placaSecundaria: 'xyz-9a87', kmSaida2: '200.000', kmEntrada2: '200.800',
  kmTotal1: '1500', kmTotal2: '800', kmTotal: '2.300', km_total: '2.300',
  abastecimentos: [{ litros: '100', combustivel: 'diesel_s10', placa: 'principal' }, { litros: '20', combustivel: 'gasolina', placa: 'XXX' }] };
ficha.dados_completos = { ...ficha };
ls.ajborges_usuario_ativo = JSON.stringify({ role: 'motorista' });
const m = ctx.mapearFichaParaSupabase(ficha);
console.log('motorista:', JSON.stringify({ km_total: m.km_total, dc: { s: m.dados_completos.kmSaida, e: m.dados_completos.kmEntrada, p: m.dados_completos.placaSecundaria, s2: m.dados_completos.kmSaida2, e2: m.dados_completos.kmEntrada2, t: m.dados_completos.kmTotal, t1: m.dados_completos.kmTotal1 }, ab: m.abastecimentos }));
ls.ajborges_usuario_ativo = JSON.stringify({ role: 'admin' });
const a = ctx.mapearFichaParaSupabase(ficha);
console.log('gestão:', JSON.stringify({ km_total: a.km_total, t: a.dados_completos.kmTotal, t1: a.dados_completos.kmTotal1, t2: a.dados_completos.kmTotal2 }));
// Volta: registro como o banco devolve (passo 11) e ficha antiga
const novo = ctx.mapearFichaDoSupabase({ id: 'X', km_saida: 100000, km_chegada: 101500, km_total: 2300, abastecimentos: [{ litros: '20', combustivel: 'arla', placa: 'secundaria' }],
  dados_completos: { kmSaida: '100000', kmEntrada: '101500', placaSecundaria: 'XYZ9A87', kmSaida2: '200000', kmEntrada2: '200800', kmTotal1: '1500', kmTotal2: '800', kmTotal: '2300' } });
console.log('leitura nova:', JSON.stringify({ s: novo.kmSaida, e: novo.kmEntrada, p: novo.placaSecundaria, s2: novo.kmSaida2, t1: novo.kmTotal1, t2: novo.kmTotal2, t: novo.kmTotal, ab: novo.abastecimentos }));
const antiga = ctx.mapearFichaDoSupabase({ id: 'Y', km_saida: 5000, km_chegada: 6000, km_total: 1000, abastecimentos: [{ litros: '50', valor: '300,00' }], dados_completos: { kmChegada: '6000' } });
console.log('leitura antiga:', JSON.stringify({ s: antiga.kmSaida, e: antiga.kmEntrada, c: antiga.kmChegada, p: antiga.placaSecundaria, t1: antiga.kmTotal1, t: antiga.kmTotal, ab: antiga.abastecimentos }));
