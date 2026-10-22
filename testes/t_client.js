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
// Passo 13: veículo de cada frete (ida e volta), frete origem/retornos fora do envio
ls.ajborges_usuario_ativo = JSON.stringify({ role: 'motorista' });
const comFretes = { ...ficha, destinoInicial: 'Viana - ES', destinoFinal: 'Marília - SP', valorAdiantamento: '500,00', totalFrete: '20.000,00', vrComissao: '2.150,00', saldoComissao: '1.650,00',
  freteOrigem: '1,00', retorno1: '2,00',
  fretes: [{ cliente: 'alimenticio', veiculo: 'rodotrem', valor: '10.000,00' }, { cliente: 'alimenticio', veiculo: 'x', valor: '10.000,00' }, { cliente: 'shopee', valor: '1,00' }] };
comFretes.dados_completos = { ...comFretes };
const ida = ctx.mapearFichaParaSupabase(comFretes);
console.log('envio passo 13:', JSON.stringify({ destino_inicial: ida.destino_inicial, destino_final: ida.destino_final, valor_adiantamento: ida.valor_adiantamento,
  total_frete: ida.total_frete, vr_comissao: ida.vr_comissao, saldo_comissao: ida.saldo_comissao,
  semFreteOrigemERetornos: !['frete_origem', 'retorno_1', 'retorno_2', 'retorno_3'].some(k => k in ida),
  veiculos: ida.dados_completos.fretes.map(f => f.veiculo || '(vazio)') }));
const volta = ctx.mapearFichaDoSupabase({ id: 'P13', destino_inicial: 'Viana - ES', destino_final: 'Marília - SP', valor_adiantamento: 500, total_frete: 20000, vr_comissao: 2150, saldo_comissao: 1650,
  dados_completos: { fretes: [{ cliente: 'alimenticio', veiculo: 'rodotrem' }, { cliente: 'mercado_livre', veiculo: null }] } });
console.log('leitura passo 13:', JSON.stringify({ destinoInicial: volta.destinoInicial, destinoFinal: volta.destinoFinal, valorAdiantamento: volta.valorAdiantamento,
  totalFrete: volta.totalFrete, vrComissao: volta.vrComissao, saldoComissao: volta.saldoComissao, veiculos: volta.fretes.map(f => f.veiculo || '(vazio)') }));
const antigaFretes = ctx.mapearFichaDoSupabase({ id: 'OLD', frete_origem: 900, retorno_1: 100, total_frete: 1000, dados_completos: { freteOrigem: '900,00', fretes: [{ cliente: 'alimenticio', valor: '1.000,00', comissao: '100,00' }] } });
console.log('leitura antiga sem veículo (exibição = carreta):', JSON.stringify({ veiculos: antigaFretes.fretes.map(f => f.veiculo), totalFrete: antigaFretes.totalFrete, freteOrigem: antigaFretes.freteOrigem }));
