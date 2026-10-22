// Edge function gerenciar-frota sem Deno e sem rede: tira os tipos com o Node
// (module.stripTypeScriptTypes), confere a sintaxe e roda as funções puras
// (validação do veículo e das comissões, CPF, celular, nome, senhaPadrao e e-mail interno).
// Uso: node testes/t_gerenciar_frota.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const RAIZ = process.env.RAIZ || path.resolve(__dirname, '..');
const ts = fs.readFileSync(path.join(RAIZ, 'supabase/functions/gerenciar-frota/index.ts'), 'utf8');
const js = stripTypeScriptTypes(ts);

// Sem o import (npm:) e com um Deno de mentira; as funções ficam no escopo do script
const semImport = js.replace(/^import .*$/m, '');
const codigo = `${semImport}
globalThis.__puras = { cpfValido, senhaPadrao, emailProvisorio, limparNome, limparCelular, lerTipoVeiculo, lerComissao, lerVeiculo, final4 };`;
const ctx = { Deno: { env: { get: () => undefined }, serve: (fn) => { ctx.__handler = fn; } }, console, Response: class {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
new vm.Script(codigo, { filename: 'gerenciar-frota.js' }).runInContext(ctx);
const f = ctx.__puras;

// CPF inventado com dígitos verificadores válidos
function cpfFicticio(base9) {
  const d = String(base9).split('').map(Number);
  const dig = (arr, peso) => { const s = arr.reduce((a, n, i) => a + n * (peso - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dig(d, 10)); d.push(dig(d, 11));
  return d.join('');
}
const cpf = cpfFicticio('123456780');
const cpfNovo = cpfFicticio('987654320');

const r = {
  sintaxe: 'ok (tipos removidos e script carregado)',
  handlerRegistrado: typeof ctx.__handler === 'function',
  cpfValido: { [cpf]: f.cpfValido(cpf), '12345678900': f.cpfValido('12345678900'), '11111111111': f.cpfValido('11111111111'), curto: f.cpfValido('123') },
  senhaPadrao: { [cpf]: f.senhaPadrao(cpf), [cpfNovo]: f.senhaPadrao(cpfNovo) },
  emailInterno: { antigo: f.emailProvisorio(cpf), novo: f.emailProvisorio(cpfNovo) },
  final4: f.final4(cpf),
  limparNome: [' Ana  "Ficticia" <b>Rocha</b> ', '', 42].map(v => JSON.stringify(f.limparNome(v))),
  limparCelular: ['(14) 99999-0000', '+55 14 99999-0000', '1433334444', '1499'].map(v => `${v} -> ${f.limparCelular(v)}`),
  tipoVeiculo: [undefined, '', 'carreta', 'rodotrem', 'carreta_rodotrem', 'bitrem', 5].map(v => `${JSON.stringify(v)} -> ${f.lerTipoVeiculo(v)}`),
  comissao: [undefined, null, '', '  ', '10,5', '10.5', 10.5, 6, '0', '100', '100,01', '101', '-1', '10,555', 'abc', '1e1', true].map(v => `${JSON.stringify(v)} -> ${JSON.stringify(f.lerComissao(v))}`),
  veiculo: [
    {},
    { tipo_veiculo: 'rodotrem', comissao_alim_rodotrem: '10,5' },
    { tipo_veiculo: 'carreta', comissao_alim_carreta: 6, comissao_alim_rodotrem: '10,5' },
    { tipo_veiculo: 'carreta_rodotrem', comissao_alim_carreta: '', comissao_alim_rodotrem: '10,5' },
    { tipo_veiculo: 'van' },
    { tipo_veiculo: 'carreta', comissao_alim_carreta: '200' },
    { tipo_veiculo: 'rodotrem', comissao_alim_rodotrem: 'dez' }
  ].map(c => `${JSON.stringify(c)} -> ${JSON.stringify(f.lerVeiculo(c))}`),
  // Nada de senha ou CPF inteiro nos logs da função
  logsComCpfOuSenha: (ts.match(/console\.(log|error)\([^;]*\b(cpf|senha|password)\b(?!_final4|_alterado|\))[^;]*;/g) || [])
    .filter(l => !/final4\(|cpf_alterado|cpf_final4/.test(l))
};
console.log(JSON.stringify(r, null, 2));
