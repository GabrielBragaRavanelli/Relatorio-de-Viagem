/**
 * ==========================================================================
 * AJBorges Transportes - Dashboard Administrativo
 * Gestão Operacional, Inteligência de Dados (BI) e Ciclo de Vida de Fichas
 * ==========================================================================
 * Conectado exclusivamente aos dados reais enviados pelos motoristas
 * via Relatório de Viagem e cadastros de Seja um Agregado Conosco.
 * Sem dados inventados ou fictícios.
 */

const STORAGE_FICHAS_KEY = 'ajborges_fichas_viagem';
const STORAGE_USER_KEY = 'ajborges_usuario_ativo';
const STORAGE_CONFIG_META_DIESEL = 'ajborges_config_meta_diesel';
const STORAGE_CONFIG_TAXA_BORGES = 'ajborges_config_taxa_borges';

// Status do Acerto com o Motorista: salvo POR FICHA no banco (dados_completos.statusAcerto)
async function alternarConfirmacaoAcerto(fichaId, novoStatus) {
    const ficha = appState.fichas.find(f => f.id === fichaId);
    if (!ficha) return;

    const statusAcerto = novoStatus === 'confirmado' ? 'confirmado' : 'nao_confirmado';

    if (typeof window.atualizarStatusAcertoSupabase !== 'function') {
        exibirToast('Sem conexão com o banco. O status do acerto não foi salvo.', 'erro');
        return;
    }

    const salvou = await window.atualizarStatusAcertoSupabase(fichaId, statusAcerto);
    if (!salvou) {
        exibirToast(`Não foi possível salvar o acerto da ficha ${fichaId}. Tente novamente.`, 'erro');
        return;
    }

    ficha.statusAcerto = statusAcerto;
    salvarFichasNoStorage();
    renderizarTabelaFichas();
    preencherSecoesSecundarias();

    if (statusAcerto === 'confirmado') {
        exibirToast(`Acerto da ficha ${fichaId} marcado como Confirmado!`, 'sucesso');
    } else {
        exibirToast(`Acerto da ficha ${fichaId} revertido para Não Confirmado.`, 'info');
    }
}
window.alternarConfirmacaoAcerto = alternarConfirmacaoAcerto;
window.alternarStatusAcerto = alternarConfirmacaoAcerto;

function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Sem valor salvo = não confirmado
function obterStatusAcertoFicha(ficha) {
    return (ficha && ficha.statusAcerto === 'confirmado') ? 'confirmado' : 'nao_confirmado';
}

function parseMilharOuFloat(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim();
    if (str.includes(',')) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str.replace(/,/g, '')) || 0;
}

// --------------------------------------------------------------------------
// Combustível e trechos da ficha (passo 11)
// Cada abastecimento tem combustivel ('diesel_s10' | 'diesel_s500' | 'arla') e,
// com placa secundária, placa ('principal' | 'secundaria'). Ficha antiga sem
// combustível conta como diesel e fica toda na placa principal.
// --------------------------------------------------------------------------
const ROTULOS_COMBUSTIVEL = { diesel_s10: 'Diesel S10', diesel_s500: 'Diesel S500', arla: 'ARLA' };
const ehArla = (a) => !!a && a.combustivel === 'arla';
const listaAbastecimentos = (f) => (Array.isArray(f && f.abastecimentos) ? f.abastecimentos.filter(Boolean) : []);
const valorAbastecimento = (a) => parseValorMoeda(a.valor || a.total || 0);

// Litros de um abastecimento, com a mesma regra da ficha (parseLitros em relatorio.js):
// com vírgula, ela é o decimal ("150,5"); sem vírgula, o ponto é milhar ("1.000" = 1000 L).
// (parseValorMoeda leria "1.000" como 1 L.)
function parseLitrosAbast(valor) {
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    const s = String(valor ?? '').trim();
    if (!s) return 0;
    if (s.includes(',')) {
        const [inteiro, ...decimais] = s.split(',');
        const n = parseFloat((inteiro.replace(/\D/g, '') || '0') + '.' + (decimais.join('').replace(/\D/g, '') || '0'));
        return isNaN(n) ? 0 : n;
    }
    const n = parseInt(s.replace(/\D/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

// Litros de diesel da ficha (sem ARLA). Sem a lista, usa o total gravado.
function litrosDieselDaFicha(f) {
    const abasts = listaAbastecimentos(f);
    if (abasts.length > 0) return abasts.reduce((acc, a) => acc + (ehArla(a) ? 0 : parseLitrosAbast(a.litros)), 0);
    return parseValorMoeda(f.totalLitros || f.total_litros || 0);
}

// Placa secundária válida da ficha (gravada sem hífen) ou ''
function placaSecundariaDaFicha(f) {
    return String((f && f.placaSecundaria) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// KM de cada trecho: com placa secundária usa kmTotal1/kmTotal2 (calculados pelo banco);
// sem ela, ou em ficha antiga, tudo fica na principal.
function kmTrechosDaFicha(f) {
    const total = parseMilharOuFloat(f.kmTotal ?? f.km_total ?? 0);
    if (!placaSecundariaDaFicha(f)) return { total, principal: total, secundaria: 0 };
    const digitos = (v) => parseInt(String(v ?? '').replace(/\D/g, ''), 10);
    const trecho = (salvo, saida, entrada) => {
        const n = digitos(salvo);
        if (!isNaN(n)) return n;
        const s = digitos(saida), e = digitos(entrada);
        return (!isNaN(s) && !isNaN(e) && e >= s) ? e - s : 0;
    };
    const principal = trecho(f.kmTotal1, f.kmSaida, f.kmEntrada ?? f.kmChegada);
    const secundaria = trecho(f.kmTotal2, f.kmSaida2, f.kmEntrada2);
    return { total: total || principal + secundaria, principal, secundaria };
}

// Média de cada placa (ficha com placa secundária): KM do trecho daquela placa ÷ litros de
// diesel das linhas de abastecimento marcadas com ela (ARLA fora). Mesma regra da ficha e
// das Análises "Por placa". Sem base (KM ou litros zerados) a média é null ("—").
function mediasPorPlacaDaFicha(f) {
    const km = kmTrechosDaFicha(f);
    const litros = { principal: 0, secundaria: 0 };
    listaAbastecimentos(f).forEach(a => {
        if (!ehArla(a)) litros[a.placa === 'secundaria' ? 'secundaria' : 'principal'] += parseLitrosAbast(a.litros);
    });
    const parte = (qual) => ({
        km: km[qual], litros: litros[qual],
        media: (km[qual] > 0 && litros[qual] > 0) ? km[qual] / litros[qual] : null
    });
    return { principal: parte('principal'), secundaria: parte('secundaria') };
}

// Média da viagem toda: (KM do trecho 1 + KM do trecho 2) ÷ litros de todas as linhas de diesel.
// Usada no ranking por motorista, no alerta de "menor média" e no gráfico de consumo.
// Com placa secundária isso é o mesmo que juntar as médias das duas placas pelo peso de cada
// uma ((km1 + km2) ÷ (l1 + l2)), então fica coerente com a média por placa da ficha.
function obterMediaRealFicha(f) {
    if (!f) return { valorNum: 0, texto: '0.00' };

    // 1. Tenta calcular diretamente pelos dados reais da viagem (KM Total / Total Litros)
    let km = 0;
    if (f.kmTotal !== undefined && f.kmTotal !== null && f.kmTotal !== '') {
        km = parseMilharOuFloat(f.kmTotal);
    } else if (f.km_total !== undefined && f.km_total !== null && f.km_total !== '') {
        km = parseMilharOuFloat(f.km_total);
    }

    // Só diesel (S10 + S500); o ARLA não entra na média
    const litros = litrosDieselDaFicha(f);

    if (km > 0 && litros > 0) {
        const mediaCalc = km / litros;
        if (!isNaN(mediaCalc) && isFinite(mediaCalc) && mediaCalc > 0) {
            return { valorNum: mediaCalc, texto: mediaCalc.toFixed(2) };
        }
    }

    // 2. Se não calculou por KM/Litros, sanitiza mediaKmL ou media_km_l
    let raw = f.mediaKmL ?? f.media_km_l ?? '';
    let rawStr = String(raw).replace(/km\/l/gi, '').trim();
    if (rawStr.includes(',')) {
        rawStr = rawStr.replace(/\./g, '').replace(',', '.');
    }
    let num = parseFloat(rawStr);
    if (isNaN(num) || num <= 0) {
        return { valorNum: 0, texto: '0.00' };
    }

    // Corrige valor falso legado de 238 ou 238.00 (resultado de erro de escala de 2.38)
    if (Math.abs(num - 238) < 0.1 || Math.abs(num - 2.38) < 0.01) {
        if (km === 0 || litros === 0) {
            return { valorNum: 0, texto: '0.00' };
        }
        return { valorNum: 2.38, texto: '2.38' };
    }
    if (num > 50) {
        num = num / 100;
    }

    return { valorNum: num, texto: num.toFixed(2) };
}

// Instâncias globais de gráficos Chart.js
let chartClientesInstance = null;
let chartConsumoInstance = null;

// Estado da Aplicação
let appState = {
    fichas: [],
    filtroStatus: 'pendente', // 'pendente' | 'aprovado' | 'todos'
    filtroMotorista: 'todos',
    filtroPeriodo: 'mes', // 'mes' | '30d' | 'semana'
    termoBusca: '',
    fichaSelecionadaModal: null,
    motoristasCadastrados: [], // perfis com role = 'motorista' ({ id, nome, cpf })
    config: {
        metaDiesel: 2.40,
        taxaBorges: 5.0
    }
};

// ==========================================================================
// 1. INICIALIZAÇÃO DO BANCO DE DADOS LOCAL
// ==========================================================================

// Lista de motoristas e identificadores de demonstração utilizados nos testes anteriores
const NOMES_DEMO_EXEMPLOS = [
    'Marcos Antônio Silva',
    'Carlos Eduardo Ferreira',
    'Jean Gomes de Oliveira',
    'Valdemir Siqueira',
    'Paulo Rogério de Souza',
    'Ricardo Mendes Barreto',
    'Fernando Alves de Lima',
    'Roberto Carlos Prado',
    'Marcelo Viana',
    'Diego Silveira',
    'Luciano Batista'
];

function inicializarBancoDados() {
    const dadosSalvos = localStorage.getItem(STORAGE_FICHAS_KEY);
    if (!dadosSalvos) {
        appState.fichas = [];
    } else {
        try {
            const parsed = JSON.parse(dadosSalvos);
            if (Array.isArray(parsed)) {
                // Filtra e expurga apenas dados de exemplo marcados explicitamente
                appState.fichas = parsed.filter(f => {
                    if (!f || !f.id) return false;
                    // Se for qualquer motorista das planilhas antigas de demonstração
                    if (NOMES_DEMO_EXEMPLOS.includes(f.motorista)) return false;
                    if (f.origemEnvio === 'seed_sistema' || f.isExemplo || f.isDemonstrativo) {
                        return false;
                    }
                    return true;
                });

                // Sanitiza médias para garantir que dados reais da viagem sejam calculados sem falhas legadas
                appState.fichas.forEach(f => {
                    const infoMed = obterMediaRealFicha(f);
                    f.mediaKmL = infoMed.texto;
                    f.media_km_l = infoMed.texto;
                });

                // Persiste o banco de dados limpo sem nenhum dado de exemplo
                localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(appState.fichas));
            } else {
                appState.fichas = [];
            }
        } catch (e) {
            console.error('Erro ao ler banco de dados local:', e);
            appState.fichas = [];
        }
    }

    if (!appState.fichas || !Array.isArray(appState.fichas)) {
        appState.fichas = [];
    }

    // Proteção de Rota: Apenas administradores autenticados podem acessar
    const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_KEY);
    let usuarioAtivo = null;
    if (usuarioAtivoStr) {
        try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) {}
    }

    if (!usuarioAtivo || (usuarioAtivo.role !== 'admin' && usuarioAtivo.role !== 'diretoria')) {
        console.warn('Acesso não autorizado ao Dashboard. Redirecionando para login...');
        window.location.href = 'Login.html#admin';
        return;
    }
}

// Escapa texto antes de montar HTML (evita script injetado em dados da ficha)
function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"'`]/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
    }[c]));
}

// Placa no formato de exibição (XYZ9A87 -> XYZ-9A87)
function formatarPlacaExibicao(valor) {
    const limpo = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return limpo.length === 7 ? `${limpo.slice(0, 3)}-${limpo.slice(3)}` : String(valor || '').trim();
}

// Placas da ficha para exibição: "ABC-1D23 / XYZ-9A87" quando houve troca de cavalo
// (placa secundária em dados_completos.placaSecundaria). Nas Análises, KM e abastecimentos
// de cada trecho vão para a placa certa (ver partesPorPlacaAnalise).
function placasDaFicha(f, vazio = '') {
    const principal = formatarPlacaExibicao(f.placas);
    const secundaria = formatarPlacaExibicao(f.placaSecundaria);
    if (!principal && !secundaria) return vazio;
    return secundaria ? `${principal || '—'} / ${secundaria}` : principal;
}

// Usuário logado (cache gravado pelo auth.js depois de validar a sessão no servidor)
function obterUsuarioLogado() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || 'null') || {};
    } catch (e) {
        return {};
    }
}

// Iniciais: primeira letra do primeiro e do último nome; sem nome, 2 primeiras letras do e-mail
function obterIniciaisUsuario(nome, email) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return String(email || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

function preencherUsuarioSidebar() {
    const usuario = obterUsuarioLogado();
    const elAvatar = document.getElementById('user-avatar-initials');
    const elEmail = document.getElementById('sidebar-user-email');
    const elPapel = document.getElementById('sidebar-user-role');

    if (elAvatar) elAvatar.textContent = obterIniciaisUsuario(usuario.nome, usuario.email);
    if (elEmail) {
        elEmail.textContent = usuario.email || '';
        elEmail.title = usuario.nome ? `${usuario.nome} • ${usuario.email || ''}` : (usuario.email || '');
    }
    if (elPapel) elPapel.textContent = usuario.role === 'diretoria' ? 'DIRETORIA' : 'ADMINISTRADOR';
}

// Abre comprovante privado com link temporário (bucket não é público)
document.addEventListener('click', async (e) => {
    const chip = e.target.closest && e.target.closest('.modal-anexo-chip[data-caminho]');
    if (!chip || typeof window.obterLinkComprovante !== 'function') return;
    const link = await window.obterLinkComprovante(chip.getAttribute('data-caminho'));
    if (link) {
        window.open(link, '_blank', 'noopener');
    } else {
        exibirToast('Não foi possível abrir o comprovante.', 'erro');
    }
});

function salvarFichasNoStorage() {
    localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(appState.fichas));
}

// --------------------------------------------------------------------------
// 1.1 CONFIGURAÇÕES OPERACIONAIS DINÂMICAS (META DIESEL & TAXA BORGES)
// --------------------------------------------------------------------------

function parseNumeroBR(valor) {
    if (valor === null || valor === undefined) return NaN;
    const str = String(valor).trim().replace(',', '.');
    return parseFloat(str);
}

function carregarConfiguracoes() {
    const metaSalva = localStorage.getItem(STORAGE_CONFIG_META_DIESEL);
    const taxaSalva = localStorage.getItem(STORAGE_CONFIG_TAXA_BORGES);

    if (metaSalva !== null) {
        const parsedMeta = parseNumeroBR(metaSalva);
        if (!isNaN(parsedMeta) && parsedMeta >= 0) {
            appState.config.metaDiesel = parsedMeta;
        }
    }
    if (taxaSalva !== null) {
        const parsedTaxa = parseNumeroBR(taxaSalva);
        if (!isNaN(parsedTaxa) && parsedTaxa >= 0) {
            appState.config.taxaBorges = parsedTaxa;
        }
    }

    const inputMeta = document.getElementById('config-meta-diesel');
    const inputTaxa = document.getElementById('config-taxa-borges');
    if (inputMeta) inputMeta.value = appState.config.metaDiesel.toFixed(2).replace('.', ',');
    if (inputTaxa) inputTaxa.value = appState.config.taxaBorges.toFixed(1).replace('.', ',');

    aplicarAtualizacoesConfiguracao(false);
}

function confirmarESalvarMetaDiesel() {
    const inputMeta = document.getElementById('config-meta-diesel');
    if (!inputMeta) return;

    const novaMeta = parseNumeroBR(inputMeta.value);

    // Validação da Meta de Diesel (aceita maior ou igual a zero)
    if (isNaN(novaMeta) || novaMeta < 0) {
        alert('Por favor, informe uma Meta de Consumo Diesel válida maior ou igual a zero (ex: 2,40 km/l ou 0,00 para sem meta).');
        inputMeta.focus();
        return;
    }

    const metaFmt = novaMeta.toFixed(2).replace('.', ',');

    const confirmou = confirm(
        `Deseja realmente confirmar a alteração da Meta de Consumo Diesel?\n\n` +
        `• Nova Meta: ${metaFmt} km/l\n\n` +
        `Os indicadores de consumo, auditorias e gráficos serão atualizados imediatamente.`
    );

    if (confirmou) {
        appState.config.metaDiesel = novaMeta;
        localStorage.setItem(STORAGE_CONFIG_META_DIESEL, novaMeta.toString());

        inputMeta.value = metaFmt;

        aplicarAtualizacoesConfiguracao(true);
        renderizarTabelaFichas();

        exibirToast(`Meta de consumo diesel confirmada: ${metaFmt} km/l.`, 'sucesso');
    } else {
        inputMeta.value = appState.config.metaDiesel.toFixed(2).replace('.', ',');
        exibirToast('Alteração da Meta de Diesel cancelada. Valor mantido.', 'info');
    }
}
window.confirmarESalvarMetaDiesel = confirmarESalvarMetaDiesel;

function confirmarESalvarTaxaBorges() {
    const inputTaxa = document.getElementById('config-taxa-borges');
    if (!inputTaxa) return;

    const novaTaxa = parseNumeroBR(inputTaxa.value);

    // Validação da Taxa Borges (entre 0% e 100%)
    if (isNaN(novaTaxa) || novaTaxa < 0 || novaTaxa > 100) {
        alert('Por favor, informe um Percentual de Taxa Borges válido entre 0% e 100% (ex: 5,0%).');
        inputTaxa.focus();
        return;
    }

    const taxaFmt = novaTaxa.toFixed(1).replace('.', ',');

    const confirmou = confirm(
        `Deseja realmente confirmar a alteração do percentual da Taxa Borges?\n\n` +
        `• Novo Percentual: ${taxaFmt}%\n\n` +
        `A revisão de faturamento e receitas administrativas será atualizada imediatamente.`
    );

    if (confirmou) {
        appState.config.taxaBorges = novaTaxa;
        localStorage.setItem(STORAGE_CONFIG_TAXA_BORGES, novaTaxa.toString());

        inputTaxa.value = taxaFmt;

        aplicarAtualizacoesConfiguracao(true);
        renderizarTabelaFichas();

        exibirToast(`Taxa Borges confirmada: ${taxaFmt}%.`, 'sucesso');
    } else {
        inputTaxa.value = appState.config.taxaBorges.toFixed(1).replace('.', ',');
        exibirToast('Alteração da Taxa Borges cancelada. Valor mantido.', 'info');
    }
}
window.confirmarESalvarTaxaBorges = confirmarESalvarTaxaBorges;

function confirmarESalvarParametrosOperacionais() {
    confirmarESalvarMetaDiesel();
    confirmarESalvarTaxaBorges();
}

function salvarConfiguracaoMetaDiesel(novaMeta) {
    const val = parseNumeroBR(novaMeta);
    if (isNaN(val) || val < 0) return false;
    appState.config.metaDiesel = val;
    localStorage.setItem(STORAGE_CONFIG_META_DIESEL, val.toString());
    aplicarAtualizacoesConfiguracao(true);
    renderizarTabelaFichas();
    return true;
}

function salvarConfiguracaoTaxaBorges(novaTaxa) {
    const val = parseNumeroBR(novaTaxa);
    if (isNaN(val) || val < 0) return false;
    appState.config.taxaBorges = val;
    localStorage.setItem(STORAGE_CONFIG_TAXA_BORGES, val.toString());
    aplicarAtualizacoesConfiguracao(true);
    return true;
}

function aplicarAtualizacoesConfiguracao(atualizarGraficosFlag = true) {
    const metaFmt = appState.config.metaDiesel.toFixed(2).replace('.', ',');
    const taxaFmt = appState.config.taxaBorges.toFixed(1).replace('.', ',');

    const elMetaDisplay = document.getElementById('kpi-meta-frota-display');
    if (elMetaDisplay) elMetaDisplay.textContent = metaFmt;

    const elChartMetaDisplay = document.getElementById('chart-meta-frota-display');
    if (elChartMetaDisplay) elChartMetaDisplay.textContent = metaFmt;

    const elSubtitle = document.getElementById('subtitle-chart-consumo');
    if (elSubtitle) {
        elSubtitle.innerHTML = `Monitoramento de eficiência energética e auditoria de abastecimento (Quem consome mais diesel vs meta de <strong id="chart-meta-frota-display">${metaFmt}</strong> km/l)`;
    }

    const elNavTaxa = document.getElementById('nav-text-faturamento');
    if (elNavTaxa) elNavTaxa.textContent = `Faturamento (${taxaFmt}%)`;

    const elSecFaturamentoTitle = document.getElementById('heading-sec-faturamento');
    if (elSecFaturamentoTitle) elSecFaturamentoTitle.innerHTML = `🧾 Revisão de Faturamento (${taxaFmt}% Borges)`;

    const elLabelTaxaAdm = document.getElementById('label-taxa-adm');
    if (elLabelTaxaAdm) elLabelTaxaAdm.textContent = `Taxa Administrativa AJBorges (${taxaFmt}%)`;

    calcularMetricasDashboard();

    if (atualizarGraficosFlag) {
        atualizarGraficos();
    }

    preencherSecoesSecundarias();
}

// ==========================================================================
// 2. CÁLCULOS E ATUALIZAÇÃO DOS KPIS FINANCEIROS E OPERACIONAIS
// ==========================================================================

function calcularMetricasDashboard() {
    let totalEntrada = 0;
    let entradaShopee = 0;
    let entradaML = 0;
    let entradaAlimenticio = 0;

    let totalSaida = 0;
    let saidaDiesel = 0;
    let saidaComissao = 0;
    let saidaPedagios = 0;
    let saidaImpostos = 0;

    let somaKmTotal = 0;
    let somaLitrosTotal = 0;

    // Iteração sobre todas as fichas reais
    appState.fichas.forEach(f => {
        const freteNum = parseValorMoeda(f.totalFrete ?? f.total_frete);
        totalEntrada += freteNum;

        // Distribuição por cliente
        if (f.fretes && Array.isArray(f.fretes) && f.fretes.length > 0) {
            f.fretes.forEach(item => {
                const v = parseValorMoeda(item.valor);
                if (item.cliente === 'shopee') entradaShopee += v;
                else if (item.cliente === 'mercado_livre') entradaML += v;
                else if (item.cliente === 'alimenticio') entradaAlimenticio += v;
                else entradaShopee += v;
            });
        } else {
            entradaShopee += freteNum;
        }

        // Diesel: totalAbastecimento ou soma de abastecimentos
        let dieselNum = parseValorMoeda(f.totalAbastecimento);
        if (dieselNum === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
            dieselNum = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.valor || a.total || 0), 0);
        }

        // Comissão
        const comissaoNum = parseValorMoeda(f.vrComissao ?? f.vr_comissao);

        // Pedágios: totalPedagio ou soma dos pedágios
        let pedagioNum = parseValorMoeda(f.totalPedagio);
        if (pedagioNum === 0 && Array.isArray(f.pedagios) && f.pedagios.length > 0) {
            pedagioNum = f.pedagios.reduce((acc, p) => acc + parseValorMoeda(p.valor || p || 0), 0);
        }

        // Imposto Federal
        const impostoNum = parseValorMoeda(f.impFederal ?? f.imp_federal);

        saidaDiesel += dieselNum;
        saidaComissao += comissaoNum;
        saidaPedagios += pedagioNum;
        saidaImpostos += impostoNum;
        totalSaida += (dieselNum + comissaoNum + pedagioNum + impostoNum);

        // KM da viagem toda (principal + secundária)
        somaKmTotal += kmTrechosDaFicha(f).total;

        // Média da frota só com diesel (o valor do ARLA continua na saída acima)
        somaLitrosTotal += litrosDieselDaFicha(f);
    });

    const resultadoLiquido = totalEntrada - totalSaida;
    const margemLiquida = totalEntrada > 0 ? ((resultadoLiquido / totalEntrada) * 100) : 0;
    const mediaGeralFrota = somaLitrosTotal > 0 ? (somaKmTotal / somaLitrosTotal) : 0;
    const totalViagens = appState.fichas.length;
    const lucroMedioPorViagem = totalViagens > 0 ? (resultadoLiquido / totalViagens) : 0;

    // Atualiza elementos no DOM
    const elTotalEntrada = document.getElementById('kpi-total-entrada');
    const elEntradaShopee = document.getElementById('kpi-entrada-shopee');
    const elEntradaMl = document.getElementById('kpi-entrada-ml');
    const elEntradaAli = document.getElementById('kpi-entrada-ali');
    const elMetaViagensCount = document.getElementById('kpi-viagens-meta-count');

    const elTotalSaida = document.getElementById('kpi-total-saida');
    const elSaidaDiesel = document.getElementById('kpi-saida-diesel');
    const elSaidaComissao = document.getElementById('kpi-saida-comissao');
    const elSaidaPedagio = document.getElementById('kpi-saida-pedagio');
    const elSaidaImpostos = document.getElementById('kpi-saida-impostos');

    const elResultadoLiquido = document.getElementById('kpi-resultado-liquido');
    const elMargemLucro = document.getElementById('kpi-margem-lucro');
    const elLucroMedioViagem = document.getElementById('kpi-lucro-medio-viagem');
    const elMetaStatusTag = document.getElementById('meta-status-tag-el');
    const elMediaConsumo = document.getElementById('kpi-media-consumo-geral');
    const elAlertaConsumoTexto = document.getElementById('alerta-consumo-texto');
    const elTagCritico = document.getElementById('tag-alerta-consumo-header');

    if (elTotalEntrada) elTotalEntrada.textContent = formatarMoeda(totalEntrada);
    if (elEntradaShopee) elEntradaShopee.textContent = formatarMoeda(entradaShopee);
    if (elEntradaMl) elEntradaMl.textContent = formatarMoeda(entradaML);
    if (elEntradaAli) elEntradaAli.textContent = formatarMoeda(entradaAlimenticio);
    if (elMetaViagensCount) elMetaViagensCount.textContent = `${totalViagens} viagem(ns) no período`;

    if (elTotalSaida) elTotalSaida.textContent = formatarMoeda(totalSaida);
    if (elSaidaDiesel) elSaidaDiesel.textContent = formatarMoeda(saidaDiesel);
    if (elSaidaComissao) elSaidaComissao.textContent = formatarMoeda(saidaComissao);
    if (elSaidaPedagio) elSaidaPedagio.textContent = formatarMoeda(saidaPedagios);
    if (elSaidaImpostos) elSaidaImpostos.textContent = formatarMoeda(saidaImpostos);

    if (elResultadoLiquido) elResultadoLiquido.textContent = formatarMoeda(resultadoLiquido);
    if (elMargemLucro) elMargemLucro.textContent = totalEntrada > 0 ? `${margemLiquida.toFixed(1)}%` : '0.0%';
    if (elLucroMedioViagem) elLucroMedioViagem.textContent = `Média: ${formatarMoeda(lucroMedioPorViagem)} / viagem`;

    if (elMetaStatusTag) {
        if (totalViagens === 0) {
            elMetaStatusTag.className = 'meta-status-tag';
            elMetaStatusTag.textContent = 'Aguardando Viagens';
        } else if (margemLiquida >= 35) {
            elMetaStatusTag.className = 'meta-status-tag meta-atingida';
            elMetaStatusTag.textContent = 'Meta Superada (>35%)';
        } else {
            elMetaStatusTag.className = 'meta-status-tag';
            elMetaStatusTag.textContent = 'Em Operação';
        }
    }

    if (elMediaConsumo) {
        elMediaConsumo.textContent = mediaGeralFrota > 0 ? `${mediaGeralFrota.toFixed(2)} km/l` : '0.00 km/l';
    }

    // Identificação de alerta real de consumo entre as fichas
    let piorMotorista = null;
    let menorMedia = 999;
    appState.fichas.forEach(f => {
        const med = obterMediaRealFicha(f).valorNum;
        if (med > 0 && med < menorMedia) {
            menorMedia = med;
            piorMotorista = f.motorista || 'Motorista';
        }
    });

    const metaDiesel = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;

    if (piorMotorista && metaDiesel > 0 && menorMedia < metaDiesel) {
        if (elAlertaConsumoTexto) {
            elAlertaConsumoTexto.innerHTML = `${piorMotorista} está com a menor média (<strong>${menorMedia.toFixed(2)} km/l</strong>), abaixo da meta (${metaDiesel.toFixed(2)} km/l).`;
        }
        if (elTagCritico) {
            elTagCritico.textContent = '⚠️ Alerta de Alto Consumo';
            elTagCritico.className = 'tag-critico';
        }
    } else {
        if (elAlertaConsumoTexto) {
            elAlertaConsumoTexto.textContent = totalViagens === 0 
                ? 'Nenhuma viagem registrada no momento.' 
                : 'Consumo de combustível dentro dos padrões normais.';
        }
        if (elTagCritico) {
            elTagCritico.textContent = '✓ Consumo sob Controle';
            elTagCritico.className = 'tag-critico tag-ok';
        }
    }

    // Atualiza barras de progresso de despesas
    const barraDiesel = document.querySelector('.bar-diesel');
    const barraComissao = document.querySelector('.bar-comissao');
    if (barraDiesel) {
        const pctDiesel = totalSaida > 0 ? ((saidaDiesel / totalSaida) * 100).toFixed(1) : 0;
        barraDiesel.style.width = `${pctDiesel}%`;
    }
    if (barraComissao) {
        const pctComissao = totalSaida > 0 ? ((saidaComissao / totalSaida) * 100).toFixed(1) : 0;
        barraComissao.style.width = `${pctComissao}%`;
    }

    // Atualiza contadores das abas e sidebar
    atualizarContadoresStatus();

    // Atualiza indicadores das seções secundárias
    atualizarIndicadoresSecoesSecundarias({
        totalViagens,
        somaKmTotal,
        totalEntrada,
        totalSaida,
        saidaDiesel,
        saidaComissao,
        saidaPedagios,
        saidaImpostos
    });
}

function atualizarContadoresStatus() {
    const pendentes = appState.fichas.filter(f => f.status === 'pendente').length;
    const aguardando = appState.fichas.filter(f => f.status === 'aguardando_confirmacao').length;
    const aprovadas = appState.fichas.filter(f => f.status === 'aprovado').length;
    const total = appState.fichas.length;

    const elContadorSidebar = document.getElementById('badge-pendentes-sidebar');
    const elContadorTabPendentes = document.getElementById('contador-tab-pendentes');
    const elContadorTabAguardando = document.getElementById('contador-tab-aguardando');
    const elContadorTabAprovadas = document.getElementById('contador-tab-aprovadas');
    const elContadorTabTodas = document.getElementById('contador-tab-todas');
    const elHeaderCounter = document.getElementById('header-fichas-pendentes-counter');

    if (elContadorSidebar) elContadorSidebar.textContent = pendentes + aguardando;
    if (elContadorTabPendentes) elContadorTabPendentes.textContent = pendentes;
    if (elContadorTabAguardando) elContadorTabAguardando.textContent = aguardando;
    if (elContadorTabAprovadas) elContadorTabAprovadas.textContent = aprovadas;
    if (elContadorTabTodas) elContadorTabTodas.textContent = total;
    if (elHeaderCounter) elHeaderCounter.textContent = `${pendentes + aguardando} pendente${(pendentes + aguardando) !== 1 ? 's' : ''}`;
}

function atualizarIndicadoresSecoesSecundarias(totais) {
    const elSecViagensTotal = document.getElementById('sec-viagens-total-mes');
    const elSecViagensKm = document.getElementById('sec-viagens-total-km');
    const elSecPedagiosTotal = document.getElementById('sec-pedagios-total');
    const elSecPedagiosCount = document.getElementById('sec-pedagios-count');
    const elSecPedagiosTags = document.getElementById('sec-pedagios-tags');
    const elSecFaturamentoBase = document.getElementById('sec-faturamento-base');
    const elSecFaturamentoTaxa = document.getElementById('sec-faturamento-taxa');
    const elSecViagensPrazo = document.getElementById('sec-viagens-prazo');

    if (elSecViagensTotal) elSecViagensTotal.textContent = totais.totalViagens;
    if (elSecViagensKm) elSecViagensKm.textContent = `${totais.somaKmTotal.toLocaleString('pt-BR')} km`;
    if (elSecViagensPrazo) elSecViagensPrazo.textContent = totais.totalViagens > 0 ? '100%' : '-';
    if (elSecPedagiosTotal) elSecPedagiosTotal.textContent = formatarMoeda(totais.saidaPedagios);
    if (elSecPedagiosCount) elSecPedagiosCount.textContent = `${totais.totalViagens} viagem(ns) auditada(s)`;
    if (elSecPedagiosTags) elSecPedagiosTags.textContent = formatarMoeda(totais.saidaPedagios);

    const taxaBorges = (appState.config && typeof appState.config.taxaBorges === 'number') ? appState.config.taxaBorges : 5.0;
    if (elSecFaturamentoBase) elSecFaturamentoBase.textContent = formatarMoeda(totais.totalEntrada);
    if (elSecFaturamentoTaxa) elSecFaturamentoTaxa.textContent = formatarMoeda(totais.totalEntrada * (taxaBorges / 100));
}

// ==========================================================================
// 3. RENDERIZAÇÃO DA TABELA DO PORTAL DO MOTORISTA
// ==========================================================================

function renderizarTabelaFichas() {
    const tbody = document.getElementById('tabela-fichas-body');
    const emptyState = document.getElementById('tabela-empty-state');
    const elInfoRegistros = document.getElementById('tabela-info-registros');
    if (!tbody) return;

    // Filtra fichas pelo status atual
    let listaFiltrada = appState.fichas.filter(f => {
        if (appState.filtroStatus === 'pendente') return f.status === 'pendente';
        if (appState.filtroStatus === 'aguardando_confirmacao') return f.status === 'aguardando_confirmacao';
        if (appState.filtroStatus === 'aprovado') return f.status === 'aprovado';
        return true;
    });

    // Filtra pelo motorista selecionado
    if (appState.filtroMotorista && appState.filtroMotorista !== 'todos') {
        listaFiltrada = listaFiltrada.filter(f => (f.motorista || '').trim().toLowerCase() === appState.filtroMotorista.trim().toLowerCase());
    }

    // Filtra pelo termo de busca (motorista, placa, rota, ficha)
    if (appState.termoBusca) {
        const t = appState.termoBusca.toLowerCase().trim();
        listaFiltrada = listaFiltrada.filter(f => {
            const id = (f.id || '').toLowerCase();
            const mot = (f.motorista || '').toLowerCase();
            const pla = `${f.placas || ''} ${f.placaSecundaria || ''}`.toLowerCase();
            const rota = `${f.destinoInicial || ''} ${f.destinoFinal || ''}`.toLowerCase();
            return id.includes(t) || mot.includes(t) || pla.includes(t) || rota.includes(t);
        });
    }

    // Atualiza info de contagem
    if (elInfoRegistros) {
        if (listaFiltrada.length === 0) {
            elInfoRegistros.textContent = 'Nenhuma ficha registrada';
        } else {
            const tipoTexto = appState.filtroStatus === 'pendente' ? 'pendente(s)' : 
                              appState.filtroStatus === 'aguardando_confirmacao' ? 'aguardando confirmação' :
                              appState.filtroStatus === 'aprovado' ? 'aprovada(s)' : 'registrada(s)';
            elInfoRegistros.textContent = `Exibindo ${listaFiltrada.length} ficha(s) ${tipoTexto}`;
        }
    }

    tbody.innerHTML = '';

    if (listaFiltrada.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    listaFiltrada.forEach(ficha => {
        const tr = document.createElement('tr');
        tr.id = `row-ficha-${ficha.id}`;

        const statusFicha = ficha.status || 'pendente';
        let statusBadgeHtml = '';
        if (statusFicha === 'aprovado') {
            statusBadgeHtml = `<span class="status-pill status-concluido">🟢 Concluído / Aprovado</span>`;
        } else if (statusFicha === 'aguardando_confirmacao') {
            statusBadgeHtml = `<span class="status-pill status-aguardando-confirmacao">🟠 Esperando Confirmação</span>`;
        } else {
            statusBadgeHtml = `<span class="status-pill status-pendente">🟡 Pendente de Conferência</span>`;
        }

        const acertoConfirmado = obterStatusAcertoFicha(ficha) === 'confirmado';
        const acertoBadgeHtml = acertoConfirmado
            ? `<span class="status-pill status-concluido">🟢 Acerto Confirmado</span>`
            : `<span class="status-pill status-pendente">🟡 Não Confirmado</span>`;

        const mediaInfo = obterMediaRealFicha(ficha);
        const mediaNum = mediaInfo.valorNum;
        const mediaTexto = mediaInfo.texto;

        const metaAtual = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
        let mediaClass = 'diesel-bom';
        if (metaAtual > 0 && mediaNum > 0) {
            if (mediaNum < (metaAtual - 0.20)) mediaClass = 'diesel-alerta';
            else if (mediaNum < metaAtual) mediaClass = 'diesel-atencao';
        }

        const rotaStr = (ficha.destinoInicial && ficha.destinoFinal) 
            ? `${ficha.destinoInicial} ➔ ${ficha.destinoFinal}` 
            : (ficha.destinoInicial || 'Rota em trânsito');

        const origemEnvioBadge = ficha.origemEnvio === 'motorista_com_login' 
            ? `<span class="driver-origin-badge badge-com-login"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> Com login</span>`
            : `<span class="driver-origin-badge badge-sem-login"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> Sem login (Direto)</span>`;

        tr.innerHTML = `
            <td>
                <span class="td-ficha-id">${ficha.id}</span>
            </td>
            <td>
                <span class="td-data-envio">${ficha.dataEnvio || ficha.dataSaida || '-'}</span>
            </td>
            <td>
                <div class="driver-cell">
                    <span class="driver-name">${ficha.motorista || 'Motorista Não Identificado'}</span>
                    ${origemEnvioBadge}
                </div>
            </td>
            <td>
                <span class="placa-box">${escaparHtml(placasDaFicha(ficha, 'Não informada'))}</span>
            </td>
            <td>
                <span class="frete-val-destaque">R$ ${ficha.totalFrete || '0,00'}</span>
            </td>
            <td>
                <span class="diesel-badge ${mediaClass}">
                    ${mediaNum > 0 ? `${mediaTexto} km/l` : '0.00 km/l'}
                </span>
            </td>
            <td>
                ${statusBadgeHtml}
            </td>
            <td>
                ${acertoBadgeHtml}
            </td>
            <td class="col-acoes text-right">
                <div class="table-actions-cell">
                    <a href="relatorio-viagem.html?ficha=${ficha.id}&mode=admin" class="btn-acao-conferir" title="Abrir ficha completa para conferência e edição">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Conferir / Editar</span>
                    </a>
                    <button type="button" class="btn-acao-resumo" data-ficha-id="${ficha.id}" title="Resumo rápido em modal">
                        👁️
                    </button>
                    ${statusFicha !== 'aprovado' ? `
                        <button type="button" class="btn-acao-aprovar-rapido" data-ficha-id="${ficha.id}" title="Aprovar Ficha Imediatamente">
                            ✓
                        </button>
                    ` : ''}
                    <button type="button" class="btn-acao-excluir" data-ficha-id="${ficha.id}" title="Excluir Ficha e remover dados do Dashboard">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Registra eventos nos botões de resumo, aprovação rápida e exclusão
    tbody.querySelectorAll('.btn-acao-resumo').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-ficha-id');
            abrirModalResumoFicha(id);
        });
    });

    tbody.querySelectorAll('.btn-acao-aprovar-rapido').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-ficha-id');
            aprovarFichaDiretamente(id);
        });
    });

    tbody.querySelectorAll('.btn-acao-excluir').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-ficha-id');
            excluirFichaDiretamente(id);
        });
    });
}

// ==========================================================================
// 4. APROVAÇÃO DIRETA E AÇÕES DE FICHAS (APROVAR E EXCLUIR)
// ==========================================================================

function aprovarFichaDiretamente(fichaId) {
    const index = appState.fichas.findIndex(f => f.id === fichaId);
    if (index === -1) return;

    if (!confirm(`Deseja aprovar e homologar o Relatório de Viagem ${fichaId}?`)) {
        return;
    }

    appState.fichas[index].status = 'aprovado';
    appState.fichas[index].dataAprovacao = new Date().toLocaleString('pt-BR');
    const emailGestor = obterUsuarioLogado().email || null;
    appState.fichas[index].aprovadoPor = emailGestor;

    salvarFichasNoStorage();

    // Atualiza status no banco de dados Supabase
    if (typeof window.atualizarStatusFichaSupabase === 'function') {
        window.atualizarStatusFichaSupabase(fichaId, 'aprovado', emailGestor);
    }

    calcularMetricasDashboard();
    renderizarTabelaFichas();
    atualizarGraficos();
    preencherSecoesSecundarias();
    exibirToast(`Ficha ${fichaId} homologada com sucesso!`, 'sucesso');
}

/**
 * Exclui a ficha permanentemente e remove todos os seus lançamentos
 * de faturamento, despesas, diesel, pedágios e médias do Dashboard.
 */
async function excluirFichaDiretamente(fichaId) {
    const ficha = appState.fichas.find(f => f.id === fichaId);
    if (!ficha) return;

    const motoristaNome = ficha.motorista || 'Motorista';
    const freteFormatado = ficha.totalFrete ? ` (Frete: R$ ${ficha.totalFrete})` : '';

    const confirmou = confirm(
        `Tem certeza de que deseja apagar a ficha ${fichaId}?\n` +
        `Motorista: ${motoristaNome}${freteFormatado}\n\n` +
        `Esta ação apagará permanentemente esta ficha e removerá todos os seus dados e valores do Dashboard e dos relatórios.`
    );

    if (!confirmou) return;

    // 1. Remove do estado de memória
    appState.fichas = appState.fichas.filter(f => f.id !== fichaId);

    // 2. Persiste a lista limpa no LocalStorage
    salvarFichasNoStorage();

    // 3. Exclui do banco de dados em nuvem Supabase (se conectado)
    if (typeof window.excluirFichaSupabase === 'function') {
        try {
            await window.excluirFichaSupabase(fichaId);
        } catch (e) {
            console.warn('Erro ao excluir no Supabase:', e);
        }
    }

    // 4. Fecha o modal de resumo se estiver aberto nesta ficha
    if (appState.fichaSelecionadaModal && appState.fichaSelecionadaModal.id === fichaId) {
        fecharModalResumo();
    }

    // 5. Recalcula imediatamente todos os KPIs, tabelas e gráficos do Dashboard
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    atualizarGraficos();
    preencherSecoesSecundarias();

    exibirToast(`Ficha ${fichaId} apagada com sucesso! Dados removidos do dashboard.`, 'sucesso');
}

// ==========================================================================
// 5. MODAL DE RESUMO RÁPIDO DA FICHA
// ==========================================================================

function abrirModalResumoFicha(fichaId) {
    const ficha = appState.fichas.find(f => f.id === fichaId);
    if (!ficha) return;

    appState.fichaSelecionadaModal = ficha;

    const modal = document.getElementById('modal-resumo-ficha');
    const elId = document.getElementById('modal-ficha-id');
    const elMot = document.getElementById('modal-ficha-motorista');
    const elConteudo = document.getElementById('modal-ficha-conteudo');
    const btnLinkCompleto = document.getElementById('btn-modal-abrir-completo');
    const btnAprovarDireto = document.getElementById('btn-modal-aprovar-direto');
    const btnExcluirDireto = document.getElementById('btn-modal-excluir-direto');

    if (elId) elId.textContent = ficha.id;
    if (elMot) elMot.textContent = `${ficha.motorista || 'Motorista'} • ${placasDaFicha(ficha, 'Placas')}`;
    if (btnLinkCompleto) btnLinkCompleto.href = `relatorio-viagem.html?ficha=${ficha.id}&mode=admin`;

    if (btnAprovarDireto) {
        btnAprovarDireto.style.display = ficha.status !== 'aprovado' ? 'inline-flex' : 'none';
        btnAprovarDireto.onclick = () => {
            aprovarFichaDiretamente(ficha.id);
            fecharModalResumo();
        };
    }

    if (btnExcluirDireto) {
        btnExcluirDireto.onclick = () => {
            excluirFichaDiretamente(ficha.id);
        };
    }

    if (elConteudo) {
        let fretesHtml = '';
        if (ficha.fretes && ficha.fretes.length > 0) {
            fretesHtml = ficha.fretes.map(fr => `
                <tr>
                    <td>${fr.data || '-'}</td>
                    <td><strong>${formatarNomeCliente(fr.cliente)}</strong></td>
                    <td>${fr.origem || '-'} ➔ ${fr.destino || '-'}</td>
                    <td><strong>R$ ${fr.valor || '0,00'}</strong></td>
                    <td>R$ ${fr.comissao || '0,00'}</td>
                </tr>
            `).join('');
        } else {
            fretesHtml = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum frete lançado</td></tr>`;
        }

        // Combustível e placa de cada abastecimento (placa só quando há placa secundária)
        const placaSecModal = placaSecundariaDaFicha(ficha);
        const placaPrincipalModal = formatarPlacaExibicao(ficha.placas);
        const placaDoAbast = (ab) => ab.placa === 'secundaria'
            ? `Secundária (${formatarPlacaExibicao(placaSecModal)})`
            : (placaPrincipalModal ? `Principal (${placaPrincipalModal})` : 'Principal');
        let abastHtml = '';
        if (ficha.abastecimentos && ficha.abastecimentos.length > 0) {
            abastHtml = ficha.abastecimentos.map(ab => `
                <tr>
                    <td>${escaparHtml(ab.posto || '-')}</td>
                    <td>${escaparHtml(ROTULOS_COMBUSTIVEL[ab.combustivel] || '—')}</td>
                    ${placaSecModal ? `<td>${escaparHtml(placaDoAbast(ab))}</td>` : ''}
                    <td>NF: ${escaparHtml(ab.nf || '-')}</td>
                    <td>${escaparHtml(ab.km || '-')} km</td>
                    <td><strong>${escaparHtml(ab.litros || '0')} L</strong></td>
                    <td><strong>R$ ${escaparHtml(ab.valor || '0,00')}</strong></td>
                </tr>
            `).join('');
        } else {
            abastHtml = `<tr><td colspan="${placaSecModal ? 7 : 6}" style="text-align: center; color: #94a3b8;">Nenhum abastecimento lançado</td></tr>`;
        }

        // KMs: um trecho por placa quando houve troca de cavalo
        const kmModal = kmTrechosDaFicha(ficha);
        const kmTxtModal = (v) => {
            const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
            return isNaN(n) ? '-' : n.toLocaleString('pt-BR');
        };
        const kmLinhasHtml = placaSecModal ? `
                    <div class="modal-info-linha"><span>KM Saída / Chegada (principal):</span> <strong>${kmTxtModal(ficha.kmSaida)} / ${kmTxtModal(ficha.kmEntrada ?? ficha.kmChegada)}</strong></div>
                    <div class="modal-info-linha"><span>Placa secundária:</span> <strong>${escaparHtml(formatarPlacaExibicao(placaSecModal))}</strong></div>
                    <div class="modal-info-linha"><span>KM Saída / Chegada (secundária):</span> <strong>${kmTxtModal(ficha.kmSaida2)} / ${kmTxtModal(ficha.kmEntrada2)}</strong></div>
                    <div class="modal-info-linha"><span>KM principal + secundária:</span> <strong>${kmModal.principal.toLocaleString('pt-BR')} + ${kmModal.secundaria.toLocaleString('pt-BR')} km</strong></div>
                    <div class="modal-info-linha"><span>KM Total da Viagem:</span> <strong>${kmModal.total.toLocaleString('pt-BR')} km</strong></div>` : `
                    <div class="modal-info-linha"><span>KM Saída / Chegada:</span> <strong>${kmTxtModal(ficha.kmSaida)} / ${kmTxtModal(ficha.kmEntrada ?? ficha.kmChegada)}</strong></div>
                    <div class="modal-info-linha"><span>KM Total Rodado:</span> <strong>${kmModal.total.toLocaleString('pt-BR')} km</strong></div>`;

        // Média: com placa secundária, uma linha por placa (km do trecho ÷ diesel da placa)
        const mediaPorPlacaModal = (rotulo, p) => `
                    <div class="modal-info-linha"><span>Média Consumo Diesel (${escaparHtml(rotulo)}):</span> <strong style="color: #047857;">${p.media === null ? '—'
                        : `${p.media.toFixed(2)} km/l <small>(${p.km.toLocaleString('pt-BR')} km ÷ ${p.litros.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L)</small>`}</strong></div>`;
        const mediasModal = placaSecModal ? mediasPorPlacaDaFicha(ficha) : null;
        const mediaLinhasHtml = mediasModal
            ? mediaPorPlacaModal(placaPrincipalModal || 'principal', mediasModal.principal) +
              mediaPorPlacaModal(formatarPlacaExibicao(placaSecModal), mediasModal.secundaria)
            : `
                    <div class="modal-info-linha"><span>Média Consumo Diesel:</span> <strong style="color: #047857;">${obterMediaRealFicha(ficha).texto} km/l</strong></div>`;

        let anexosHtml = '';
        if (ficha.anexos && ficha.anexos.length > 0) {
            anexosHtml = ficha.anexos.map(an => {
                const nome = escaparHtml(an.name || an.nome || 'Comprovante');
                const tamanho = an.size ? `${(an.size / 1024 / 1024).toFixed(2)} MB` : escaparHtml(an.tamanho || 'Anexo');
                const caminho = an.path ? escaparHtml(an.path) : '';
                return `
                <div class="modal-anexo-chip"${caminho ? ` data-caminho="${caminho}" role="button" tabindex="0" title="Abrir comprovante" style="cursor:pointer"` : ''}>
                    <span>📎</span>
                    <span>${nome} (${tamanho})</span>
                </div>`;
            }).join('');
        } else {
            anexosHtml = `<span style="font-size: 0.82rem; color: #94a3b8;">Nenhum comprovante anexado.</span>`;
        }

        elConteudo.innerHTML = `
            <div class="modal-grid-2">
                <div class="modal-info-box">
                    <div class="modal-info-box-title">Dados Operacionais da Viagem</div>
                    <div class="modal-info-linha"><span>Data Envio:</span> <strong>${ficha.dataEnvio || '-'}</strong></div>
                    <div class="modal-info-linha"><span>Período:</span> <strong>${ficha.dataSaida || '-'} até ${ficha.dataChegada || '-'}</strong></div>
                    ${kmLinhasHtml}
                    ${mediaLinhasHtml}
                </div>
                <div class="modal-info-box">
                    <div class="modal-info-box-title">Fechamento Financeiro</div>
                    <div class="modal-info-linha"><span>Total Frete Bruto:</span> <strong style="color: #047857;">R$ ${ficha.totalFrete || '0,00'}</strong></div>
                    <div class="modal-info-linha"><span>Total Diesel:</span> <strong>R$ ${ficha.totalAbastecimento || '0,00'}</strong></div>
                    <div class="modal-info-linha"><span>Pedágios + Imposto:</span> <strong>R$ ${formatarMoedaSemPrefixo(parseValorMoeda(ficha.totalPedagio) + parseValorMoeda(ficha.impFederal))}</strong></div>
                    <div class="modal-info-linha"><span>Adiantamento Concedido:</span> <strong>R$ ${ficha.valorAdiantamento || '0,00'}</strong></div>
                    <div class="modal-info-linha"><span>Saldo Comissão:</span> <strong style="color: #8b5cf6;">R$ ${ficha.saldoComissao || '0,00'}</strong></div>
                </div>
            </div>

            <div>
                <h4 style="font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Relação de Fretes</h4>
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table class="modal-tabela-resumo">
                        <thead>
                            <tr><th>Data</th><th>Cliente</th><th>Trecho</th><th>Valor</th><th>Comissão</th></tr>
                        </thead>
                        <tbody>${fretesHtml}</tbody>
                    </table>
                </div>
            </div>

            <div>
                <h4 style="font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Abastecimentos Lançados</h4>
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table class="modal-tabela-resumo">
                        <thead>
                            <tr><th>Posto</th><th>Combustível</th>${placaSecModal ? '<th>Placa</th>' : ''}<th>Nota Fiscal</th><th>KM</th><th>Litros</th><th>Valor R$</th></tr>
                        </thead>
                        <tbody>${abastHtml}</tbody>
                    </table>
                </div>
            </div>

            <div>
                <h4 style="font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Comprovantes Anexados</h4>
                <div class="modal-anexos-list">${anexosHtml}</div>
            </div>

            ${ficha.observacoesMotorista ? `
                <div class="modal-info-box" style="background-color: #fffbeb; border-color: #fde68a;">
                    <div class="modal-info-box-title" style="color: #b45309;">Observações do Motorista</div>
                    <p style="font-size: 0.85rem; color: #78350f;">${ficha.observacoesMotorista}</p>
                </div>
            ` : ''}
        `;
    }

    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function fecharModalResumo() {
    const modal = document.getElementById('modal-resumo-ficha');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
}

// ==========================================================================
// 6. GRÁFICOS DE BI (CHART.JS - BASEADOS EXCLUSIVAMENTE EM DADOS REAIS)
// ==========================================================================

function obterDadosGraficosReais() {
    // 1. Dados Financeiros
    let labelsFin = [];
    let fatData = [];
    let custoData = [];
    let lucroData = [];

    if (appState.fichas.length === 0) {
        labelsFin = ['Sem dados'];
        fatData = [0];
        custoData = [0];
        lucroData = [0];
    } else {
        // Agrupa por ficha ou por data da viagem
        labelsFin = appState.fichas.map(f => f.id || 'Ficha');
        fatData = appState.fichas.map(f => parseValorMoeda(f.totalFrete ?? f.total_frete));
        custoData = appState.fichas.map(f => {
            let diesel = parseValorMoeda(f.totalAbastecimento);
            if (diesel === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
                diesel = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.valor || a.total || 0), 0);
            }
            const comissao = parseValorMoeda(f.vrComissao ?? f.vr_comissao);
            let pedagio = parseValorMoeda(f.totalPedagio);
            if (pedagio === 0 && Array.isArray(f.pedagios) && f.pedagios.length > 0) {
                pedagio = f.pedagios.reduce((acc, p) => acc + parseValorMoeda(p.valor || p || 0), 0);
            }
            const imposto = parseValorMoeda(f.impFederal ?? f.imp_federal);
            return diesel + comissao + pedagio + imposto;
        });
        lucroData = fatData.map((fat, i) => fat - custoData[i]);
    }

    // 2. Dados por Cliente
    let entradaShopee = 0;
    let entradaML = 0;
    let entradaAli = 0;

    appState.fichas.forEach(f => {
        if (f.fretes && Array.isArray(f.fretes) && f.fretes.length > 0) {
            f.fretes.forEach(item => {
                const v = parseValorMoeda(item.valor);
                if (item.cliente === 'shopee') entradaShopee += v;
                else if (item.cliente === 'mercado_livre') entradaML += v;
                else if (item.cliente === 'alimenticio') entradaAli += v;
                else entradaShopee += v;
            });
        } else {
            entradaShopee += parseValorMoeda(f.totalFrete ?? f.total_frete);
        }
    });

    const totalClientes = entradaShopee + entradaML + entradaAli;
    let labelsClientes = [];
    let dataClientes = [];
    let coresClientes = [];

    if (totalClientes === 0) {
        labelsClientes = ['Aguardando Viagens'];
        dataClientes = [1];
        coresClientes = ['#e2e8f0'];
    } else {
        labelsClientes = [
            `Shopee (${((entradaShopee / totalClientes) * 100).toFixed(1)}%)`,
            `Mercado Livre (${((entradaML / totalClientes) * 100).toFixed(1)}%)`,
            `Alimentício (${((entradaAli / totalClientes) * 100).toFixed(1)}%)`
        ];
        dataClientes = [entradaShopee, entradaML, entradaAli];
        coresClientes = ['#f97316', '#eab308', '#3d3d90'];
    }

    // 3. Dados de Consumo por Motorista
    const motoristasMediaMap = {};
    appState.fichas.forEach(f => {
        const m = f.motorista || 'Motorista';
        let med = obterMediaRealFicha(f).valorNum;
        if (med > 0) {
            if (!motoristasMediaMap[m]) motoristasMediaMap[m] = { soma: 0, count: 0 };
            motoristasMediaMap[m].soma += med;
            motoristasMediaMap[m].count += 1;
        }
    });

    const nomesMotoristas = Object.keys(motoristasMediaMap);
    let labelsConsumo = [];
    let dataConsumo = [];
    let coresConsumo = [];

    if (nomesMotoristas.length === 0) {
        labelsConsumo = ['Nenhum motorista com consumo registrado'];
        dataConsumo = [0];
        coresConsumo = ['#cbd5e1'];
    } else {
        const meta = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
        nomesMotoristas.forEach(nome => {
            const med = motoristasMediaMap[nome].soma / motoristasMediaMap[nome].count;
            labelsConsumo.push(nome);
            dataConsumo.push(parseFloat(med.toFixed(2)));
            if (meta > 0) {
                if (med < (meta - 0.20)) coresConsumo.push('#ef4444');
                else if (med < meta) coresConsumo.push('#f59e0b');
                else coresConsumo.push('#10b981');
            } else {
                coresConsumo.push('#10b981');
            }
        });
    }

    return {
        financeiro: { labels: labelsFin, faturamento: fatData, custos: custoData, lucro: lucroData },
        clientes: { labels: labelsClientes, data: dataClientes, cores: coresClientes, total: totalClientes },
        consumo: { labels: labelsConsumo, data: dataConsumo, cores: coresConsumo }
    };
}

// ==========================================================================
// 6. TABELAS DIÁRIAS DA FROTA (FATURAMENTO & DESPESAS CONSOLIDADAS POR DIA)
// ==========================================================================

function padronizarDataBR(strData) {
    if (!strData) return { br: 'Sem Data', iso: '0000-00-00' };
    const s = String(strData).trim();
    if (!s) return { br: 'Sem Data', iso: '0000-00-00' };

    // Se já é DD/MM/AAAA ou DD/MM/AAAA HH:mm
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const dia = s.substring(0, 2);
        const mes = s.substring(3, 5);
        const ano = s.substring(6, 10);
        return { br: `${dia}/${mes}/${ano}`, iso: `${ano}-${mes}-${dia}` };
    }

    // Se é formato ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const ano = s.substring(0, 4);
        const mes = s.substring(5, 7);
        const dia = s.substring(8, 10);
        return { br: `${dia}/${mes}/${ano}`, iso: `${ano}-${mes}-${dia}` };
    }

    // Fallback Date
    try {
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) {
            const dia = String(dt.getDate()).padStart(2, '0');
            const mes = String(dt.getMonth() + 1).padStart(2, '0');
            const ano = dt.getFullYear();
            return { br: `${dia}/${mes}/${ano}`, iso: `${ano}-${mes}-${dia}` };
        }
    } catch (e) {}

    return { br: s, iso: s };
}

function extrairDataVidaReal(ficha) {
    if (!ficha) return new Date().toLocaleDateString('pt-BR');
    const d = ficha.dataEnvio || ficha.data_envio;
    if (!d) return new Date().toLocaleDateString('pt-BR');
    
    // Se for timestamp ISO (ex: 2026-10-11T14:20:00)
    if (typeof d === 'string' && d.includes('-') && !d.includes('/')) {
        return new Date(d).toLocaleDateString('pt-BR');
    }
    // Se for string no padrão BR (ex: "11/10/2026, 14:28:00" ou "11/10/2026")
    return String(d).split(',')[0].split(' ')[0].trim();
}

function converterDataBRparaISO(dataBR) {
    if (!dataBR || dataBR === 'Sem Data') return '0000-00-00';
    const partes = String(dataBR).split('/');
    if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const ano = partes[2];
        return `${ano}-${mes}-${dia}`;
    }
    return String(dataBR);
}

function obterDataFicha(ficha) {
    const raw = ficha.dataSaida || ficha.data_saida || ficha.dataEnvio || ficha.data_envio || ficha.dataCriacao || ficha.data || '';
    return padronizarDataBR(raw);
}

function renderizarTabelaFaturamentoDiario() {
    const tbody = document.getElementById('tbody-faturamento-diario');
    const badgeTotal = document.getElementById('badge-total-faturamento-acumulado');
    if (!tbody) return;

    const fichas = appState.fichas || [];
    if (fichas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="tabela-diaria-vazio">
                    <div class="empty-state-diario">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <p>Nenhuma viagem com faturamento registrada.</p>
                    </div>
                </td>
            </tr>
        `;
        if (badgeTotal) badgeTotal.textContent = 'R$ 0,00';
        return;
    }

    const mapaDias = {};
    let totalGeralAcumulado = 0;

    fichas.forEach(f => {
        const dataBR = extrairDataVidaReal(f);
        const dataISO = converterDataBRparaISO(dataBR);
        const frete = parseValorMoeda(f.totalFrete ?? f.total_frete ?? 0);
        totalGeralAcumulado += frete;

        if (!mapaDias[dataBR]) {
            mapaDias[dataBR] = {
                dataBR: dataBR,
                dataISO: dataISO,
                qtdViagens: 0,
                totalFaturamento: 0
            };
        }

        mapaDias[dataBR].qtdViagens += 1;
        mapaDias[dataBR].totalFaturamento += frete;
    });

    if (badgeTotal) {
        badgeTotal.textContent = formatarMoeda(totalGeralAcumulado);
    }

    // Ordenar pelas datas mais recentes primeiro (decrescente)
    const listaDias = Object.values(mapaDias).sort((a, b) => {
        if (a.dataISO === '0000-00-00') return 1;
        if (b.dataISO === '0000-00-00') return -1;
        return b.dataISO.localeCompare(a.dataISO);
    });

    tbody.innerHTML = listaDias.map(item => {
        const ticketMedio = item.qtdViagens > 0 ? (item.totalFaturamento / item.qtdViagens) : 0;
        return `
            <tr>
                <td class="td-data-diaria">${item.dataBR}</td>
                <td style="text-align: center;">
                    <span class="badge-qtd-viagens" title="${item.qtdViagens} viagens">${item.qtdViagens}</span>
                </td>
                <td style="text-align: right;">
                    <span class="val-faturamento-destaque">${formatarMoeda(item.totalFaturamento)}</span>
                </td>
                <td style="text-align: right;">
                    <span class="val-ticket-medio">${formatarMoeda(ticketMedio)}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarTabelaDespesasDiarias() {
    const tbody = document.getElementById('tbody-despesas-diarias');
    const badgeTotal = document.getElementById('badge-total-despesas-acumulado');
    if (!tbody) return;

    const fichas = appState.fichas || [];
    if (fichas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="tabela-diaria-vazio">
                    <div class="empty-state-diario">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        <p>Nenhuma despesa operacional registrada.</p>
                    </div>
                </td>
            </tr>
        `;
        if (badgeTotal) badgeTotal.textContent = 'R$ 0,00';
        return;
    }

    const mapaDias = {};
    let totalGeralDespesas = 0;

    fichas.forEach(f => {
        const dataBR = extrairDataVidaReal(f);
        const dataISO = converterDataBRparaISO(dataBR);

        let diesel = parseValorMoeda(f.totalAbastecimento);
        if (diesel === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
            diesel = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.valor || a.total || 0), 0);
        }

        const comissao = parseValorMoeda(f.vrComissao ?? f.vr_comissao ?? 0);

        let pedagio = parseValorMoeda(f.totalPedagio);
        if (pedagio === 0 && Array.isArray(f.pedagios) && f.pedagios.length > 0) {
            pedagio = f.pedagios.reduce((acc, p) => acc + parseValorMoeda(p.valor || p || 0), 0);
        }

        const imposto = parseValorMoeda(f.impFederal ?? f.imp_federal ?? f.outrasDespesas ?? f.outrosCustos ?? 0);

        const totalCustoFicha = diesel + comissao + pedagio + imposto;
        totalGeralDespesas += totalCustoFicha;

        if (!mapaDias[dataBR]) {
            mapaDias[dataBR] = {
                dataBR: dataBR,
                dataISO: dataISO,
                qtdLancamentos: 0,
                totalDespesas: 0,
                somaDiesel: 0,
                somaPedagio: 0,
                somaComissao: 0,
                somaOutras: 0
            };
        }

        let qtd = 0;
        if (diesel > 0) qtd++;
        if (pedagio > 0) qtd++;
        if (comissao > 0) qtd++;
        if (imposto > 0) qtd++;
        if (qtd === 0 && totalCustoFicha > 0) qtd = 1;

        mapaDias[dataBR].qtdLancamentos += qtd;
        mapaDias[dataBR].totalDespesas += totalCustoFicha;
        mapaDias[dataBR].somaDiesel += diesel;
        mapaDias[dataBR].somaPedagio += pedagio;
        mapaDias[dataBR].somaComissao += comissao;
        mapaDias[dataBR].somaOutras += imposto;
    });

    if (badgeTotal) {
        badgeTotal.textContent = formatarMoeda(totalGeralDespesas);
    }

    // Ordenar decrescente por data mais recente
    const listaDias = Object.values(mapaDias).sort((a, b) => {
        if (a.dataISO === '0000-00-00') return 1;
        if (b.dataISO === '0000-00-00') return -1;
        return b.dataISO.localeCompare(a.dataISO);
    });

    tbody.innerHTML = listaDias.map(item => {
        const categorias = [
            { nome: 'Diesel', valor: item.somaDiesel, classe: 'badge-custo-diesel' },
            { nome: 'Pedágios', valor: item.somaPedagio, classe: 'badge-custo-pedagio' },
            { nome: 'Comissão', valor: item.somaComissao, classe: 'badge-custo-comissao' },
            { nome: 'Diárias/Outros', valor: item.somaOutras, classe: 'badge-custo-outros' }
        ];
        categorias.sort((a, b) => b.valor - a.valor);
        const principal = categorias[0].valor > 0 ? categorias[0] : { nome: 'Nenhum', classe: 'badge-custo-outros' };

        return `
            <tr>
                <td class="td-data-diaria">${item.dataBR}</td>
                <td style="text-align: center;">
                    <span class="badge-qtd-despesas" title="${item.qtdLancamentos} lançamentos">${item.qtdLancamentos}</span>
                </td>
                <td style="text-align: right;">
                    <span class="val-despesas-destaque">${formatarMoeda(item.totalDespesas)}</span>
                </td>
                <td style="text-align: center;">
                    <span class="badge-principal-custo ${principal.classe}">${principal.nome}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarTabelasDiarias() {
    renderizarTabelaFaturamentoDiario();
    renderizarTabelaDespesasDiarias();
}

function inicializarGraficos() {
    // Renderiza as tabelas diárias consolidadas da frota
    renderizarTabelasDiarias();

    const dados = obterDadosGraficosReais();

    // 2. Gráfico Donut de Clientes
    const ctxClientes = document.getElementById('chart-clientes');
    if (ctxClientes) {
        chartClientesInstance = new Chart(ctxClientes, {
            type: 'doughnut',
            data: {
                labels: dados.clientes.labels,
                datasets: [{
                    data: dados.clientes.data,
                    backgroundColor: dados.clientes.cores,
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 14,
                            font: { size: 11, weight: '500' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (dados.clientes.total === 0) return ' Sem dados de viagens';
                                return ` ${context.label}: R$ ${context.parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Gráfico Horizontal de Consumo
    const ctxConsumo = document.getElementById('chart-consumo-motoristas');
    if (ctxConsumo) {
        chartConsumoInstance = new Chart(ctxConsumo, {
            type: 'bar',
            data: {
                labels: dados.consumo.labels,
                datasets: [{
                    label: 'Média de Consumo (km/l)',
                    data: dados.consumo.data,
                    backgroundColor: dados.consumo.cores,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.05)'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.x;
                                if (val === 0) return ' Sem consumo registrado';
                                const meta = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
                                const status = (meta > 0 && val < meta) ? `(Abaixo da meta de ${meta.toFixed(2)} km/l)` : (meta > 0 ? '(Dentro da meta)' : '');
                                return ` Média: ${val.toFixed(2)} km/l ${status}`.trim();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 0,
                        max: 4.0,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            callback: function(val) {
                                return val + ' km/l';
                            }
                        }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function atualizarGraficos() {
    // Atualiza as tabelas diárias com os dados sincronizados
    renderizarTabelasDiarias();

    const dados = obterDadosGraficosReais();

    if (chartClientesInstance) {
        chartClientesInstance.data.labels = dados.clientes.labels;
        chartClientesInstance.data.datasets[0].data = dados.clientes.data;
        chartClientesInstance.data.datasets[0].backgroundColor = dados.clientes.cores;
        chartClientesInstance.update();
    }

    if (chartConsumoInstance) {
        chartConsumoInstance.data.labels = dados.consumo.labels;
        chartConsumoInstance.data.datasets[0].data = dados.consumo.data;
        chartConsumoInstance.data.datasets[0].backgroundColor = dados.consumo.cores;
        if (chartConsumoInstance.options && chartConsumoInstance.options.scales && chartConsumoInstance.options.scales.x) {
            chartConsumoInstance.options.scales.x.max = Math.max(4.0, ((appState.config && appState.config.metaDiesel) ? appState.config.metaDiesel : 2.4) + 1.0);
        }
        chartConsumoInstance.update();
    }

    // Mantém a aba Análises em dia quando os dados mudam
    renderizarAnalisesSeVisivel();
}

// ==========================================================================
// 7. RENDERIZAÇÃO DAS SEÇÕES SECUNDÁRIAS (SUB-VISÕES DO MENU)
// ==========================================================================

function preencherSecoesSecundarias() {
    // 1. Seção Viagens Resumo
    const containerViagens = document.getElementById('container-viagens-resumo');
    if (containerViagens) {
        if (appState.fichas.length === 0) {
            containerViagens.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #64748b;">
                    <p style="font-size: 0.95rem; font-weight: 500;">Nenhuma rota ou viagem registrada no momento.</p>
                    <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 4px;">Os relatórios submetidos pelos motoristas serão listados aqui.</p>
                </div>
            `;
        } else {
            containerViagens.innerHTML = `
                <table class="tabela-fichas">
                    <thead>
                        <tr><th>Viagem</th><th>Data</th><th>Motorista</th><th>Placas</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${appState.fichas.slice(0, 10).map(f => `
                            <tr>
                                <td><strong>${f.id}</strong></td>
                                <td>${f.dataSaida || f.dataEnvio || '-'}</td>
                                <td>${f.motorista || 'Motorista'}</td>
                                <td><span class="placa-box">${escaparHtml(placasDaFicha(f, 'Não informada'))}</span></td>
                                <td><span class="status-pill ${f.status === 'pendente' ? 'status-pendente' : 'status-concluido'}">${f.status === 'pendente' ? 'Em Conferência' : 'Concluído'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    // 2. Seção Pedágios
    const tbodyPedagios = document.getElementById('tabela-pedagios-body');
    if (tbodyPedagios) {
        const fichasComPedagio = appState.fichas.filter(f => parseValorMoeda(f.totalPedagio) > 0);
        if (fichasComPedagio.length === 0) {
            tbodyPedagios.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 28px;">
                        Nenhuma conciliação de pedágio disponível ou declarada nas viagens atuais.
                    </td>
                </tr>
            `;
        } else {
            tbodyPedagios.innerHTML = fichasComPedagio.map(f => {
                return `
                    <tr>
                        <td><strong>${f.id}</strong></td>
                        <td>${f.motorista}</td>
                        <td>Praças declaradas</td>
                        <td>R$ ${f.totalPedagio || '0,00'}</td>
                        <td>R$ ${f.totalPedagio || '0,00'}</td>
                        <td><span class="status-pill status-concluido">✓ Auditado</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Seção Acerto Motoristas (uma linha por ficha)
    renderizarTabelaAcertos();

    // 4. Seção Combustível
    renderizarTabelaCombustivel();

    // 5. Seção Frota
    renderizarTabelaFrota();

    // 6. Seção Despesas Gerais
    const containerDespesas = document.getElementById('container-despesas-resumo');
    if (containerDespesas) {
        let saidaDiesel = 0, saidaComissao = 0, saidaPedagios = 0, saidaImpostos = 0;
        appState.fichas.forEach(f => {
            let diesel = parseValorMoeda(f.totalAbastecimento);
            if (diesel === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
                diesel = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.valor || a.total || 0), 0);
            }
            saidaDiesel += diesel;
            saidaComissao += parseValorMoeda(f.vrComissao ?? f.vr_comissao);
            let pedagio = parseValorMoeda(f.totalPedagio);
            if (pedagio === 0 && Array.isArray(f.pedagios) && f.pedagios.length > 0) {
                pedagio = f.pedagios.reduce((acc, p) => acc + parseValorMoeda(p.valor || p || 0), 0);
            }
            saidaPedagios += pedagio;
            saidaImpostos += parseValorMoeda(f.impFederal ?? f.imp_federal);
        });
        const total = saidaDiesel + saidaComissao + saidaPedagios + saidaImpostos;

        containerDespesas.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Diesel &amp; Postos</span>
                    <h3 class="kpi-value">${formatarMoeda(saidaDiesel)}</h3>
                    <span class="kpi-meta-text">${total > 0 ? ((saidaDiesel / total) * 100).toFixed(1) : 0}% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Diárias e Comissões</span>
                    <h3 class="kpi-value">${formatarMoeda(saidaComissao)}</h3>
                    <span class="kpi-meta-text">${total > 0 ? ((saidaComissao / total) * 100).toFixed(1) : 0}% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Pedágios em Rodovias</span>
                    <h3 class="kpi-value">${formatarMoeda(saidaPedagios)}</h3>
                    <span class="kpi-meta-text">${total > 0 ? ((saidaPedagios / total) * 100).toFixed(1) : 0}% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Impostos &amp; Outras</span>
                    <h3 class="kpi-value">${formatarMoeda(saidaImpostos)}</h3>
                    <span class="kpi-meta-text">${total > 0 ? ((saidaImpostos / total) * 100).toFixed(1) : 0}% do custo total</span>
                </div>
            </div>
        `;
    }

    // 7. Seção Motoristas: carregada do banco ao abrir (carregarAbaMotoristas)

    // 8. Seção Planejamento
    const containerPlanejamento = document.getElementById('container-planejamento-resumo');
    if (containerPlanejamento) {
        const fichasPendentes = appState.fichas.filter(f => f.status === 'pendente');
        if (fichasPendentes.length === 0) {
            containerPlanejamento.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #64748b;">
                    <p style="font-size: 0.95rem; font-weight: 500;">Nenhuma escala ou rota com viagem pendente no momento.</p>
                    <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 4px;">Todas as viagens recebidas foram homologadas ou estão concluídas.</p>
                </div>
            `;
        } else {
            containerPlanejamento.innerHTML = `
                <div class="modal-info-box" style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 6px;">Programação de Viagens em Conferência</h4>
                    <p style="font-size: 0.82rem; color: #475569;">Relatórios enviados que aguardam homologação da gestão operacional.</p>
                </div>
                <table class="tabela-fichas">
                    <thead><tr><th>Ficha</th><th>Motorista</th><th>Origem</th><th>Destino</th><th>Veículo</th><th>Status</th></tr></thead>
                    <tbody>
                        ${fichasPendentes.map(f => `
                            <tr>
                                <td><strong>${f.id}</strong></td>
                                <td>${f.motorista}</td>
                                <td>${f.destinoInicial || '-'}</td>
                                <td>${f.destinoFinal || '-'}</td>
                                <td>${escaparHtml(placasDaFicha(f, '-'))}</td>
                                <td><span class="status-pill status-pendente">Aguardando Conferência</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }
}

// ==========================================================================
// 7.0. SEÇÃO ACERTO COM MOTORISTAS (UMA LINHA POR FICHA, FILTROS E STATUS NO BANCO)
// ==========================================================================

function renderizarTabelaAcertos() {
    const tbodyAcertos = document.getElementById('tabela-acertos-body');
    const selectMotorista = document.getElementById('filtro-acertos-motorista');
    const inputBuscaFicha = document.getElementById('busca-acertos-ficha');
    const infoRegistros = document.getElementById('info-registros-acertos');
    if (!tbodyAcertos) return;

    const fichas = appState.fichas || [];

    // Popula o select com os motoristas das fichas, preservando a seleção atual
    if (selectMotorista) {
        const selecionado = selectMotorista.value || '';
        const nomes = Array.from(new Set(fichas.map(f => (f.motorista || '').trim()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const chave = nomes.join('|');
        if (selectMotorista.getAttribute('data-cache-chave') !== chave) {
            selectMotorista.innerHTML = '<option value="">Todos</option>' +
                nomes.map(n => `<option value="${escaparHtml(n)}">${escaparHtml(n)}</option>`).join('');
            selectMotorista.value = nomes.includes(selecionado) ? selecionado : '';
            selectMotorista.setAttribute('data-cache-chave', chave);
        }
    }

    const filtroMotorista = selectMotorista ? selectMotorista.value : '';
    const termoFicha = inputBuscaFicha ? inputBuscaFicha.value.trim().toLowerCase() : '';

    const lista = fichas
        .filter(f => !filtroMotorista || (f.motorista || '').trim() === filtroMotorista)
        .filter(f => !termoFicha || String(f.id || '').toLowerCase().includes(termoFicha))
        .map(f => ({ ficha: f, data: obterDataFicha(f) }))
        // Mesmo motorista agrupado (uma ficha embaixo da outra), viagens mais recentes primeiro
        .sort((a, b) => {
            const porNome = (a.ficha.motorista || '').localeCompare(b.ficha.motorista || '', 'pt-BR');
            if (porNome !== 0) return porNome;
            if (a.data.iso !== b.data.iso) return b.data.iso.localeCompare(a.data.iso);
            return String(b.ficha.id || '').localeCompare(String(a.ficha.id || ''));
        });

    if (infoRegistros) infoRegistros.textContent = `${lista.length} ficha(s)`;

    if (lista.length === 0) {
        const msg = fichas.length === 0
            ? 'Nenhum acerto de motorista pendente. Aguardando relatórios de viagem.'
            : 'Nenhuma ficha encontrada para os filtros selecionados.';
        tbodyAcertos.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #94a3b8; padding: 28px;">${msg}</td>
            </tr>
        `;
        return;
    }

    tbodyAcertos.innerHTML = lista.map(({ ficha: f, data }) => {
        const frete = parseValorMoeda(f.totalFrete ?? f.total_frete);
        const comissao = parseValorMoeda(f.vrComissao ?? f.vr_comissao);
        const adiantamento = parseValorMoeda(f.valorAdiantamento ?? f.valor_adiantamento);
        const saldoLiquidar = comissao - adiantamento;
        const id = escaparHtml(f.id);
        const dataViagem = data.iso === '0000-00-00' ? '—' : escaparHtml(data.br);

        const acoesHtml = obterStatusAcertoFicha(f) === 'confirmado'
            ? `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                   <span class="status-pill status-concluido">🟢 Confirmado</span>
                   <button type="button" class="btn-desfazer-acerto" data-ficha-id="${id}" title="Reverter status para Não Confirmado">Desfazer</button>
               </div>`
            : `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                   <span class="status-pill status-pendente">🟡 Não Confirmado</span>
                   <button type="button" class="btn-acao-aprovar-rapido btn-confirmar-acerto" data-ficha-id="${id}" title="Confirmar conferência do acerto">Confirmar</button>
               </div>`;

        return `
            <tr>
                <td><span class="td-ficha-id">${id}</span></td>
                <td>${dataViagem}</td>
                <td><strong>${escaparHtml(f.motorista || 'Motorista')}</strong></td>
                <td>R$ ${formatarMoedaSemPrefixo(frete)}</td>
                <td><strong style="color: #4f46e5;">R$ ${formatarMoedaSemPrefixo(comissao)}</strong></td>
                <td>R$ ${formatarMoedaSemPrefixo(adiantamento)}</td>
                <td><strong style="color: ${saldoLiquidar >= 0 ? '#10b981' : '#ef4444'};">R$ ${formatarMoedaSemPrefixo(saldoLiquidar)}</strong></td>
                <td>${acoesHtml}</td>
            </tr>
        `;
    }).join('');

    tbodyAcertos.querySelectorAll('.btn-confirmar-acerto, .btn-desfazer-acerto').forEach(btn => {
        btn.addEventListener('click', async () => {
            const novoStatus = btn.classList.contains('btn-confirmar-acerto') ? 'confirmado' : 'nao_confirmado';
            btn.disabled = true;
            await alternarConfirmacaoAcerto(btn.getAttribute('data-ficha-id'), novoStatus);
            btn.disabled = false;
        });
    });
}

// ==========================================================================
// 7.0.1. SEÇÃO GESTÃO DE FROTA (FILTRO POR MOTORISTA CADASTRADO)
// ==========================================================================

function somenteDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

function normalizarNomePessoa(nome) {
    return String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().replace(/\s+/g, ' ').toLowerCase();
}

// Ex.: 11166686822 -> ***.666.868-**
function mascararCpf(cpf) {
    const d = somenteDigitos(cpf);
    if (d.length !== 11) return '';
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

// Ficha pertence ao motorista cadastrado? CPF quando os dois lados têm; senão, nome
function fichaEhDoMotorista(ficha, perfil) {
    if (!ficha || !perfil) return false;
    const cpfPerfil = somenteDigitos(perfil.cpf);
    const cpfFicha = somenteDigitos(ficha.motoristaCpf ?? ficha.motorista_cpf);
    if (cpfPerfil && cpfFicha) return cpfPerfil === cpfFicha;
    return normalizarNomePessoa(ficha.motorista) !== '' &&
        normalizarNomePessoa(ficha.motorista) === normalizarNomePessoa(perfil.nome);
}

async function carregarMotoristasCadastrados() {
    if (!window.supabaseClient) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('perfis')
            .select('id, nome, cpf')
            .eq('role', 'motorista')
            .order('nome', { ascending: true });
        if (error) {
            console.warn('Erro ao carregar motoristas cadastrados:', error);
            return;
        }
        appState.motoristasCadastrados = Array.isArray(data) ? data : [];
        renderizarTabelaFrota();
    } catch (e) {
        console.warn('Erro ao carregar motoristas cadastrados:', e);
    }
}

function renderizarTabelaFrota() {
    const tbodyFrota = document.getElementById('tabela-frota-body');
    const selectMotorista = document.getElementById('filtro-frota-motorista');
    const infoRegistros = document.getElementById('info-registros-frota');
    if (!tbodyFrota) return;

    const perfis = appState.motoristasCadastrados || [];

    // Popula o select com os motoristas cadastrados (nome + CPF mascarado), preservando a seleção
    if (selectMotorista) {
        const selecionado = selectMotorista.value || '';
        const chave = perfis.map(p => `${p.id}:${p.nome}:${p.cpf}`).join('|');
        if (selectMotorista.getAttribute('data-cache-chave') !== chave) {
            selectMotorista.innerHTML = '<option value="">Todos</option>' + perfis.map(p => {
                const cpfMascarado = mascararCpf(p.cpf);
                const rotulo = cpfMascarado ? `${p.nome || 'Sem nome'} (${cpfMascarado})` : (p.nome || 'Sem nome');
                return `<option value="${escaparHtml(p.id)}">${escaparHtml(rotulo)}</option>`;
            }).join('');
            selectMotorista.value = perfis.some(p => String(p.id) === selecionado) ? selecionado : '';
            selectMotorista.setAttribute('data-cache-chave', chave);
        }
    }

    const idSelecionado = selectMotorista ? selectMotorista.value : '';
    const perfilSelecionado = idSelecionado ? perfis.find(p => String(p.id) === idSelecionado) : null;
    const fichas = perfilSelecionado
        ? appState.fichas.filter(f => fichaEhDoMotorista(f, perfilSelecionado))
        : appState.fichas;

    // Um veículo por placa (fichas vêm da mais recente para a mais antiga)
    const veiculosMap = {};
    fichas.forEach(f => {
        if (f.placas && !veiculosMap[f.placas]) {
            veiculosMap[f.placas] = {
                motorista: f.motorista || 'Motorista',
                kmAtual: f.kmChegada || f.kmSaida || f.km_chegada || f.km_saida || '-',
                media: obterMediaRealFicha(f).texto,
                status: f.status === 'pendente' ? 'Em Rota' : 'Disponível'
            };
        }
    });

    const placas = Object.keys(veiculosMap);
    if (infoRegistros) infoRegistros.textContent = `${placas.length} veículo(s)`;

    if (placas.length === 0) {
        const msg = perfilSelecionado
            ? 'Nenhum veículo encontrado nas fichas deste motorista.'
            : 'Nenhum veículo registrado em viagens ativas no momento.';
        tbodyFrota.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 28px;">${msg}</td>
            </tr>
        `;
        return;
    }

    tbodyFrota.innerHTML = placas.map(p => {
        const v = veiculosMap[p];
        const partes = p.split('/');
        const cavalo = partes[0]?.trim() || p;
        const carreta = partes[1]?.trim() || '-';
        return `
            <tr>
                <td><strong>${escaparHtml(cavalo)}</strong></td>
                <td>${escaparHtml(carreta)}</td>
                <td>Veículo Pesado</td>
                <td>${escaparHtml(v.motorista)}</td>
                <td>${escaparHtml(v.kmAtual)} km</td>
                <td><span class="diesel-badge diesel-bom">${escaparHtml(v.media)} km/l</span></td>
                <td><span class="status-pill ${v.status === 'Em Rota' ? 'status-pendente' : 'status-concluido'}">${v.status}</span></td>
            </tr>
        `;
    }).join('');
}

// ==========================================================================
// 7.1. SEÇÃO CONFERÊNCIA DE COMBUSTÍVEL (CRUZAR POSTO X MOTORISTA COM FILTRO)
// ==========================================================================

function renderizarTabelaCombustivel() {
    const tbodyCombustivel = document.getElementById('tabela-combustivel-body');
    const selectFiltro = document.getElementById('filtro-combustivel-motorista');
    const infoRegistros = document.getElementById('info-registros-combustivel');
    if (!tbodyCombustivel) return;

    const listaAbast = [];
    const motoristasSet = new Set();

    appState.fichas.forEach(f => {
        const motNome = f.motorista || 'Motorista Não Identificado';
        motoristasSet.add(motNome);

        if (f.abastecimentos && Array.isArray(f.abastecimentos)) {
            f.abastecimentos.forEach(ab => {
                listaAbast.push({
                    fichaId: f.id || 'Sem ID',
                    posto: ab.posto || 'Posto Conveniado',
                    nf: ab.nf || '-',
                    data: f.dataSaida || f.data_saida || f.dataEnvio || '-',
                    motorista: motNome,
                    litros: ab.litros || '0',
                    valor: ab.valor || '0,00'
                });
            });
        }
    });

    // Popula o seletor de motoristas preservando o valor atualmente selecionado
    if (selectFiltro) {
        const motoristaAtual = selectFiltro.value || '';
        const motoristasOrdenados = Array.from(motoristasSet).filter(Boolean).sort();

        const htmlOpcoes = ['<option value="">Todos os Motoristas</option>'];
        motoristasOrdenados.forEach(m => {
            const sel = (m === motoristaAtual) ? 'selected' : '';
            htmlOpcoes.push(`<option value="${escapeHtmlAttr(m)}" ${sel}>${m}</option>`);
        });

        const chaveSet = motoristasOrdenados.join('|');
        if (selectFiltro.getAttribute('data-cache-chave') !== chaveSet) {
            selectFiltro.innerHTML = htmlOpcoes.join('');
            selectFiltro.value = motoristaAtual;
            selectFiltro.setAttribute('data-cache-chave', chaveSet);
        }

        if (!selectFiltro.hasAttribute('data-filtro-ativo')) {
            selectFiltro.setAttribute('data-filtro-ativo', 'true');
            selectFiltro.addEventListener('change', () => {
                renderizarTabelaCombustivel();
            });
        }
    }

    const filtroSelecionado = selectFiltro ? (selectFiltro.value || '').trim() : '';
    const abastFiltrados = filtroSelecionado
        ? listaAbast.filter(a => a.motorista.toLowerCase() === filtroSelecionado.toLowerCase())
        : listaAbast;

    if (infoRegistros) {
        infoRegistros.textContent = `${abastFiltrados.length} abastecimento(s) encontrado(s)`;
    }

    if (abastFiltrados.length === 0) {
        const msg = filtroSelecionado
            ? `Nenhum abastecimento encontrado para o motorista "${filtroSelecionado}".`
            : `Nenhum registro de abastecimento para conferência no momento.`;
        tbodyCombustivel.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: #94a3b8; padding: 28px;">
                    ${msg}
                </td>
            </tr>
        `;
        return;
    }

    tbodyCombustivel.innerHTML = abastFiltrados.map(ab => {
        const v = parseValorMoeda(ab.valor);
        const l = parseLitrosAbast(ab.litros);
        const precoL = l > 0 ? (v / l).toFixed(2).replace('.', ',') : '0,00';
        return `
            <tr>
                <td><strong>${ab.posto}</strong></td>
                <td>NF ${ab.nf}</td>
                <td>
                    <a href="relatorio-viagem.html?ficha=${encodeURIComponent(ab.fichaId)}&mode=admin" 
                       class="td-ficha-id" 
                       title="Visualizar Ficha ${ab.fichaId}">
                        ${ab.fichaId}
                    </a>
                </td>
                <td>${ab.data}</td>
                <td>${ab.motorista}</td>
                <td>${ab.litros} L</td>
                <td>R$ ${precoL}</td>
                <td><strong>R$ ${ab.valor}</strong></td>
                <td><span class="status-pill status-concluido">✓ Lançado</span></td>
            </tr>
        `;
    }).join('');
}

// ==========================================================================
// 7.2. ABA ANÁLISES (TABELAS, COMPARAÇÕES E GRÁFICOS A PARTIR DAS FICHAS)
// ==========================================================================

// Instâncias Chart.js da aba (destruídas e recriadas a cada renderização)
const chartsAnalises = {};

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatarNumeroBR(num, casas = 0) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// Valor calculável vira texto; divisão por zero / dado ausente vira "—"
function textoOuTraco(valor, formatar) {
    return (typeof valor === 'number' && isFinite(valor)) ? formatar(valor) : '—';
}

function dividirOuNulo(a, b) {
    return b > 0 ? a / b : null;
}

/**
 * Valores de uma ficha, com as mesmas regras usadas no restante do dashboard.
 * despesas = diesel + ARLA + pedágio + imposto federal + outras (sem a comissão).
 * litros = só diesel (S10 + S500; sem combustível conta como diesel), para a média km/l.
 */
function obterValoresFichaAnalise(f) {
    const abasts = listaAbastecimentos(f);
    let diesel = 0;
    let arla = 0;
    if (abasts.length > 0) {
        abasts.forEach(a => { if (ehArla(a)) arla += valorAbastecimento(a); else diesel += valorAbastecimento(a); });
    } else {
        diesel = parseValorMoeda(f.totalAbastecimento);
    }

    let pedagio = parseValorMoeda(f.totalPedagio);
    if (pedagio === 0 && Array.isArray(f.pedagios) && f.pedagios.length > 0) {
        pedagio = f.pedagios.reduce((acc, p) => acc + parseValorMoeda(p.valor || p || 0), 0);
    }

    const imposto = parseValorMoeda(f.impFederal ?? f.imp_federal);

    // Outras despesas: itens da lista, exceto o Imposto Federal (já contado acima)
    const listaOutras = Array.isArray(f.outrasDespesas) ? f.outrasDespesas : [];
    const outras = listaOutras.reduce((acc, d) => {
        if (!d || normalizarNomePessoa(d.desc) === 'imposto federal') return acc;
        return acc + parseValorMoeda(d.valor);
    }, 0);

    const litros = litrosDieselDaFicha(f);

    const frete = parseValorMoeda(f.totalFrete ?? f.total_frete);
    const comissao = parseValorMoeda(f.vrComissao ?? f.vr_comissao);
    const km = kmTrechosDaFicha(f).total;
    const despesas = diesel + arla + pedagio + imposto + outras;

    return { frete, comissao, diesel, arla, pedagio, imposto, outras, despesas, km, litros, resultado: frete - despesas - comissao };
}

/**
 * Divide a ficha entre as placas para a tabela "Por placa".
 * Sem placa secundária (ou ficha antiga): tudo na principal.
 * Com placa secundária: o KM de cada trecho e os abastecimentos (pela coluna "Placa")
 * vão para a placa certa; receita, comissão, pedágio, imposto e outras ficam na principal.
 */
function partesPorPlacaAnalise({ ficha, v }) {
    // ABC1D23 (motorista) e ABC-1D23 (gestão) são a mesma placa
    const principal = formatarPlacaExibicao(ficha.placas) || 'Placa não informada';
    const secundaria = placaSecundariaDaFicha(ficha);
    if (!secundaria) return [{ placa: principal, v }];

    const km = kmTrechosDaFicha(ficha);
    const comb = { principal: { diesel: 0, arla: 0, litros: 0 }, secundaria: { diesel: 0, arla: 0, litros: 0 } };
    listaAbastecimentos(ficha).forEach(a => {
        const c = comb[a.placa === 'secundaria' ? 'secundaria' : 'principal'];
        if (ehArla(a)) c.arla += valorAbastecimento(a);
        else { c.diesel += valorAbastecimento(a); c.litros += parseLitrosAbast(a.litros); }
    });

    const despesasPrincipal = comb.principal.diesel + comb.principal.arla + v.pedagio + v.imposto + v.outras;
    const despesasSecundaria = comb.secundaria.diesel + comb.secundaria.arla;
    return [
        {
            placa: principal,
            v: { ...v, ...comb.principal, km: km.principal, despesas: despesasPrincipal, resultado: v.frete - despesasPrincipal - v.comissao }
        },
        {
            placa: formatarPlacaExibicao(secundaria),
            v: {
                frete: 0, comissao: 0, pedagio: 0, imposto: 0, outras: 0, ...comb.secundaria,
                km: km.secundaria, despesas: despesasSecundaria, resultado: -despesasSecundaria
            }
        }
    ];
}

function somarValoresAnalise(lista) {
    const total = { fichas: 0, frete: 0, comissao: 0, diesel: 0, arla: 0, pedagio: 0, imposto: 0, outras: 0, despesas: 0, km: 0, litros: 0, resultado: 0 };
    lista.forEach(({ v }) => {
        total.fichas += 1;
        Object.keys(v).forEach(k => { total[k] += v[k]; });
    });
    return total;
}

// Classe do selo de consumo (mesma regra da tabela de fichas)
function classeConsumoDiesel(media) {
    const meta = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
    if (!(media > 0) || !(meta > 0)) return 'diesel-bom';
    if (media < (meta - 0.20)) return 'diesel-alerta';
    if (media < meta) return 'diesel-atencao';
    return 'diesel-bom';
}

function montarTabelaAnalise(cabecalhos, linhas, msgVazio = 'Sem dados para os filtros selecionados.') {
    if (linhas.length === 0) return `<div class="analises-vazio">${msgVazio}</div>`;
    const ths = cabecalhos.map(c => {
        const classes = [c.num ? 'td-num' : '', c.ordem ? 'th-ordenavel' : '', c.ordemAtiva ? `th-ordem-${c.ordemAtiva}` : ''].filter(Boolean);
        const attrs = (classes.length ? ` class="${classes.join(' ')}"` : '') +
            (c.title ? ` title="${escaparHtml(c.title)}"` : '') +
            (c.ordem ? ` data-ordem="${c.ordem}" tabindex="0" aria-sort="${c.ordemAtiva === 'desc' ? 'descending' : c.ordemAtiva === 'asc' ? 'ascending' : 'none'}"` : '');
        return `<th${attrs}>${c.texto}</th>`;
    }).join('');
    return `
        <table class="tabela-fichas">
            <thead><tr>${ths}</tr></thead>
            <tbody>${linhas.join('')}</tbody>
        </table>
    `;
}

function destruirGraficoAnalise(chave) {
    if (chartsAnalises[chave]) {
        chartsAnalises[chave].destroy();
        delete chartsAnalises[chave];
    }
}

// Recria o gráfico (ou esconde a área quando não há dados)
function renderizarGraficoAnalise(chave, canvasId, boxId, config, temDados) {
    destruirGraficoAnalise(chave);
    const canvas = document.getElementById(canvasId);
    const box = document.getElementById(boxId);
    if (!canvas || typeof Chart === 'undefined') return;

    const existente = Chart.getChart(canvas);
    if (existente) existente.destroy();

    if (box) box.style.display = temDados ? '' : 'none';
    if (!temDados) return;

    chartsAnalises[chave] = new Chart(canvas, config);
}

function preencherOpcoesFiltroAnalise(select, valores, rotuloTodos) {
    if (!select) return;
    const selecionado = select.value || '';
    const chave = valores.join('|');
    if (select.getAttribute('data-cache-chave') === chave) return;
    select.innerHTML = `<option value="">${rotuloTodos}</option>` +
        valores.map(v => `<option value="${escaparHtml(v)}">${escaparHtml(v)}</option>`).join('');
    select.value = valores.includes(selecionado) ? selecionado : '';
    select.setAttribute('data-cache-chave', chave);
}

function obterFichasFiltradasAnalise() {
    const dataDe = document.getElementById('analises-data-de')?.value || '';
    const dataAte = document.getElementById('analises-data-ate')?.value || '';
    const motorista = document.getElementById('analises-filtro-motorista')?.value || '';
    const placa = document.getElementById('analises-filtro-placa')?.value || '';
    const status = document.getElementById('analises-filtro-status')?.value || 'aprovado';

    return (appState.fichas || [])
        .filter(f => f && f.id)
        .filter(f => status === 'todas' || f.status === 'aprovado')
        .filter(f => !motorista || (f.motorista || '').trim() === motorista)
        .filter(f => !placa || (f.placas || '').trim() === placa)
        .map(f => ({ ficha: f, data: obterDataFicha(f), v: obterValoresFichaAnalise(f) }))
        .filter(({ data }) => {
            if (!dataDe && !dataAte) return true;
            const temData = /^\d{4}-\d{2}-\d{2}$/.test(data.iso) && data.iso !== '0000-00-00';
            if (!temData) return false;
            if (dataDe && data.iso < dataDe) return false;
            if (dataAte && data.iso > dataAte) return false;
            return true;
        });
}

// Tabela "Por placa": linhas calculadas em renderizarAnalises e ordem escolhida
// no cabeçalho (padrão: Resultado, do maior para o menor)
let linhasTabelaPlacas = [];
const ordemTabelaPlacas = { chave: 'resultado', desc: true };

const VALOR_ORDEM_PLACA = {
    placa: (l) => l.placa,
    fichas: (l) => l.t.fichas,
    km: (l) => l.t.km,
    receita: (l) => l.t.frete,
    custos: (l) => l.custos,
    resultado: (l) => l.t.resultado,
    margem: (l) => l.margem,
    custoKm: (l) => l.custoKm,
    resultadoKm: (l) => l.resultadoKm,
    litros: (l) => l.t.litros,
    media: (l) => l.media,
    diesel: (l) => l.t.diesel,
    arla: (l) => l.t.arla,
    dieselKm: (l) => l.dieselKm
};

function ordenarTabelaPlacas(chave) {
    if (!VALOR_ORDEM_PLACA[chave]) return;
    if (ordemTabelaPlacas.chave === chave) ordemTabelaPlacas.desc = !ordemTabelaPlacas.desc;
    else {
        ordemTabelaPlacas.chave = chave;
        ordemTabelaPlacas.desc = chave !== 'placa'; // texto começa de A a Z; números do maior para o menor
    }
    renderizarTabelaPlacasAnalise();
}

function renderizarTabelaPlacasAnalise() {
    const elTabPlaca = document.getElementById('analises-tabela-placas');
    if (!elTabPlaca) return;
    const meta = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
    const moeda = (n) => formatarMoeda(n);
    const reaisKm = (n) => formatarMoeda(n);
    const { chave, desc } = ordemTabelaPlacas;
    const valor = VALOR_ORDEM_PLACA[chave];

    // Valores ausentes (divisão por zero) ficam sempre no fim
    const linhas = [...linhasTabelaPlacas].sort((a, b) => {
        const va = valor(a), vb = valor(b);
        const na = va === null || va === undefined, nb = vb === null || vb === undefined;
        if (na || nb) return na === nb ? 0 : na ? 1 : -1;
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
        return desc ? -cmp : cmp;
    });

    const col = (texto, ordem, extra = {}) => ({ texto, ordem, num: ordem !== 'placa', ordemAtiva: chave === ordem ? (desc ? 'desc' : 'asc') : '', ...extra });
    const classeResultado = (n) => n > 0 ? 'analises-positivo' : n < 0 ? 'analises-negativo' : '';

    elTabPlaca.innerHTML = montarTabelaAnalise([
        col('Placa', 'placa'), col('Fichas', 'fichas'), col('KM', 'km'),
        col('Receita', 'receita', { title: 'Frete das fichas' }),
        col('Custos', 'custos', { title: 'Diesel + pedágio + imposto + outras + comissão (só o que está na ficha)' }),
        col('Resultado', 'resultado', { title: 'Receita − custos' }),
        col('Margem %', 'margem', { title: 'Resultado ÷ receita' }),
        col('Custo/km', 'custoKm', { title: 'Custos ÷ KM rodados' }),
        col('Resultado/km', 'resultadoKm', { title: 'Resultado ÷ KM rodados' }),
        col('Litros', 'litros'), col('Média km/l', 'media'),
        { texto: 'vs. Meta', num: true },
        col('Diesel', 'diesel'), col('ARLA', 'arla'), col('Diesel/km', 'dieselKm')
    ], linhas.map(({ placa, t, custos, margem, custoKm, resultadoKm, media, dieselKm }) => {
        let vsMeta = '—';
        if (media !== null && meta > 0) {
            const dif = media - meta;
            const pct = (dif / meta) * 100;
            vsMeta = `<span class="diesel-badge ${classeConsumoDiesel(media)}">${dif >= 0 ? '+' : ''}${formatarNumeroBR(pct, 1)}%</span>`;
        }
        return `
            <tr>
                <td><span class="placa-box">${escaparHtml(placa)}</span></td>
                <td class="td-num">${t.fichas}</td>
                <td class="td-num">${t.km > 0 ? `${formatarNumeroBR(t.km, 0)} km` : '—'}</td>
                <td class="td-num">${moeda(t.frete)}</td>
                <td class="td-num">${moeda(custos)}</td>
                <td class="td-num"><strong class="${classeResultado(t.resultado)}">${moeda(t.resultado)}</strong></td>
                <td class="td-num"><span class="${classeResultado(t.resultado)}">${textoOuTraco(margem, n => `${formatarNumeroBR(n * 100, 1)}%`)}</span></td>
                <td class="td-num">${textoOuTraco(custoKm, reaisKm)}</td>
                <td class="td-num"><span class="${classeResultado(t.resultado)}">${textoOuTraco(resultadoKm, reaisKm)}</span></td>
                <td class="td-num">${t.litros > 0 ? `${formatarNumeroBR(t.litros, 2)} L` : '—'}</td>
                <td class="td-num">${textoOuTraco(media, n => `${formatarNumeroBR(n, 2)} km/l`)}</td>
                <td class="td-num">${vsMeta}</td>
                <td class="td-num">${moeda(t.diesel)}</td>
                <td class="td-num">${moeda(t.arla)}</td>
                <td class="td-num">${textoOuTraco(dieselKm, reaisKm)}</td>
            </tr>
        `;
    }));
}

function renderizarAnalises() {
    const secao = document.getElementById('view-analises');
    if (!secao) return;

    // Opções dos filtros a partir de todas as fichas
    const todas = appState.fichas || [];
    preencherOpcoesFiltroAnalise(
        document.getElementById('analises-filtro-motorista'),
        Array.from(new Set(todas.map(f => (f.motorista || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        'Todos'
    );
    preencherOpcoesFiltroAnalise(
        document.getElementById('analises-filtro-placa'),
        Array.from(new Set(todas.map(f => (f.placas || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        'Todas'
    );

    const lista = obterFichasFiltradasAnalise();
    const meta = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;

    const elInfo = document.getElementById('analises-info-registros');
    if (elInfo) elInfo.textContent = `${lista.length} ficha(s) analisada(s)`;
    const elMeta = document.getElementById('analises-meta-diesel');
    if (elMeta) elMeta.textContent = formatarNumeroBR(meta, 2);

    const moeda = (n) => formatarMoeda(n);
    const kmTxt = (n) => `${formatarNumeroBR(n, 0)} km`;
    const kmlTxt = (n) => `${formatarNumeroBR(n, 2)} km/l`;

    // ---------------- 1. Cards de resumo ----------------
    const total = somarValoresAnalise(lista);
    const mediaGeral = dividirOuNulo(total.km, total.litros);
    const elResumo = document.getElementById('analises-resumo');
    if (elResumo) {
        const cards = [
            { classe: 'card-frota-kpi', rotulo: 'Fichas', valor: formatarNumeroBR(total.fichas, 0) },
            { classe: 'card-frota-kpi', rotulo: 'KM rodados', valor: lista.length ? kmTxt(total.km) : '—' },
            { classe: 'card-entrada', rotulo: 'Frete total', valor: moeda(total.frete) },
            { classe: 'card-saida', rotulo: 'Comissão total', valor: moeda(total.comissao) },
            { classe: 'card-saida', rotulo: 'Despesas totais', valor: moeda(total.despesas), nota: 'Diesel + ARLA + pedágio + imposto + outras' },
            { classe: 'card-saida', rotulo: 'ARLA (R$)', valor: moeda(total.arla), nota: 'Entra nos custos, fora da média km/l' },
            {
                classe: 'card-resultado', rotulo: 'Resultado do período', valor: moeda(total.resultado),
                classeValor: total.resultado > 0 ? 'analises-positivo' : total.resultado < 0 ? 'analises-negativo' : '',
                nota: `Margem ${textoOuTraco(dividirOuNulo(total.resultado, total.frete), n => `${formatarNumeroBR(n * 100, 1)}%`)} · frete − despesas − comissão`
            },
            { classe: 'card-frota-kpi', rotulo: 'Média km/l', valor: textoOuTraco(mediaGeral, kmlTxt), nota: `Só diesel (S10 + S500) · Meta: ${formatarNumeroBR(meta, 2)} km/l` }
        ];
        elResumo.innerHTML = cards.map(c => `
            <div class="kpi-card ${c.classe}">
                <span class="kpi-label">${c.rotulo}</span>
                <h3 class="kpi-value${c.classeValor ? ` ${c.classeValor}` : ''}">${c.valor}</h3>
                ${c.nota ? `<span class="kpi-meta-text">${c.nota}</span>` : ''}
            </div>
        `).join('');
    }

    // ---------------- 2. Por motorista ----------------
    const porMotorista = {};
    lista.forEach(item => {
        const nome = (item.ficha.motorista || '').trim() || 'Motorista não identificado';
        (porMotorista[nome] = porMotorista[nome] || []).push(item);
    });
    const motoristas = Object.keys(porMotorista)
        .map(nome => ({ nome, t: somarValoresAnalise(porMotorista[nome]) }))
        .sort((a, b) => b.t.frete - a.t.frete);

    const elTabMot = document.getElementById('analises-tabela-motoristas');
    if (elTabMot) {
        elTabMot.innerHTML = montarTabelaAnalise([
            { texto: 'Motorista' }, { texto: 'Fichas', num: true }, { texto: 'KM', num: true },
            { texto: 'Frete', num: true }, { texto: 'Comissão', num: true }, { texto: 'Diesel', num: true },
            { texto: 'Pedágio', num: true }, { texto: 'Imp. Federal', num: true }, { texto: 'Outras desp.', num: true },
            { texto: 'Média km/l', num: true },
            { texto: 'Custo/km', num: true, title: '(Despesas + comissão) ÷ KM rodados' }
        ], motoristas.map(({ nome, t }) => {
            const media = dividirOuNulo(t.km, t.litros);
            const custoKm = dividirOuNulo(t.despesas + t.comissao, t.km);
            return `
                <tr>
                    <td><strong>${escaparHtml(nome)}</strong></td>
                    <td class="td-num">${t.fichas}</td>
                    <td class="td-num">${t.km > 0 ? kmTxt(t.km) : '—'}</td>
                    <td class="td-num">${moeda(t.frete)}</td>
                    <td class="td-num">${moeda(t.comissao)}</td>
                    <td class="td-num">${moeda(t.diesel)}</td>
                    <td class="td-num">${moeda(t.pedagio)}</td>
                    <td class="td-num">${moeda(t.imposto)}</td>
                    <td class="td-num">${moeda(t.outras)}</td>
                    <td class="td-num">${media !== null ? `<span class="diesel-badge ${classeConsumoDiesel(media)}">${kmlTxt(media)}</span>` : '—'}</td>
                    <td class="td-num">${textoOuTraco(custoKm, n => `R$ ${formatarNumeroBR(n, 2)}`)}</td>
                </tr>
            `;
        }));
    }

    renderizarGraficoAnalise('motoristas', 'chart-analises-motoristas', 'analises-box-chart-motoristas', {
        type: 'bar',
        data: {
            labels: motoristas.map(m => m.nome),
            datasets: [
                { label: 'Frete', data: motoristas.map(m => m.t.frete), backgroundColor: '#10b981', borderRadius: 6 },
                { label: 'Comissão', data: motoristas.map(m => m.t.comissao), backgroundColor: '#8b5cf6', borderRadius: 6 },
                { label: 'Despesas', data: motoristas.map(m => m.t.despesas), backgroundColor: '#ef4444', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11, weight: '500' } } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.y)}` } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (val) => `R$ ${formatarNumeroBR(val, 0)}` } }
            }
        }
    }, motoristas.length > 0);

    // ---------------- 3. Por placa / veículo (lucratividade + consumo) ----------------
    // Com placa secundária a ficha entra nas duas placas (ver partesPorPlacaAnalise)
    const porPlaca = {};
    lista.forEach(item => {
        partesPorPlacaAnalise(item).forEach(parte => {
            (porPlaca[parte.placa] = porPlaca[parte.placa] || []).push(parte);
        });
    });
    linhasTabelaPlacas = Object.keys(porPlaca).map(placa => {
        const t = somarValoresAnalise(porPlaca[placa]);
        // Custos = só o que está na ficha: diesel + pedágio + imposto + outras + comissão
        const custos = t.despesas + t.comissao;
        return {
            placa, t, custos,
            margem: dividirOuNulo(t.resultado, t.frete),
            custoKm: dividirOuNulo(custos, t.km),
            resultadoKm: dividirOuNulo(t.resultado, t.km),
            media: dividirOuNulo(t.km, t.litros),
            dieselKm: dividirOuNulo(t.diesel, t.km)
        };
    });
    renderizarTabelaPlacasAnalise();

    // ---------------- 4. Por operação (Relação de Fretes) ----------------
    const porOperacao = {};
    lista.forEach(({ ficha }) => {
        (Array.isArray(ficha.fretes) ? ficha.fretes : []).forEach(fr => {
            if (!fr) return;
            const nome = formatarNomeCliente(fr.cliente);
            const o = porOperacao[nome] = porOperacao[nome] || { fretes: 0, valor: 0, comissao: 0 };
            o.fretes += 1;
            o.valor += parseValorMoeda(fr.valor);
            o.comissao += parseValorMoeda(fr.comissao);
        });
    });
    const operacoes = Object.keys(porOperacao).map(nome => ({ nome, ...porOperacao[nome] })).sort((a, b) => b.valor - a.valor);
    const elTabOper = document.getElementById('analises-tabela-operacoes');
    if (elTabOper) {
        elTabOper.innerHTML = montarTabelaAnalise([
            { texto: 'Operação' }, { texto: 'Fretes', num: true }, { texto: 'Valor de frete', num: true },
            { texto: 'Comissão', num: true }, { texto: 'Ticket médio', num: true }
        ], operacoes.map(o => `
            <tr>
                <td><strong>${escaparHtml(o.nome)}</strong></td>
                <td class="td-num">${o.fretes}</td>
                <td class="td-num">${moeda(o.valor)}</td>
                <td class="td-num">${moeda(o.comissao)}</td>
                <td class="td-num">${textoOuTraco(dividirOuNulo(o.valor, o.fretes), moeda)}</td>
            </tr>
        `), 'Nenhum frete na Relação de Fretes das fichas filtradas.');
    }

    // ---------------- 5. Evolução mensal ----------------
    const porMes = {};
    let semData = 0;
    lista.forEach(({ data, v }) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data.iso) || data.iso === '0000-00-00') { semData += 1; return; }
        const mes = data.iso.slice(0, 7);
        const m = porMes[mes] = porMes[mes] || { frete: 0, despesas: 0, resultado: 0 };
        m.frete += v.frete;
        m.despesas += v.despesas;
        m.resultado += v.resultado;
    });
    const meses = Object.keys(porMes).sort();
    renderizarGraficoAnalise('mensal', 'chart-analises-mensal', 'analises-box-chart-mensal', {
        type: 'line',
        data: {
            labels: meses.map(m => `${MESES_ABREV[parseInt(m.slice(5, 7), 10) - 1] || m.slice(5, 7)}/${m.slice(0, 4)}`),
            datasets: [
                { label: 'Frete', data: meses.map(m => porMes[m].frete), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', tension: 0.3, pointRadius: 4 },
                { label: 'Despesas', data: meses.map(m => porMes[m].despesas), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.12)', tension: 0.3, pointRadius: 4 },
                { label: 'Resultado', data: meses.map(m => porMes[m].resultado), borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.12)', tension: 0.3, pointRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11, weight: '500' } } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.y)}` } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#f1f5f9' }, ticks: { callback: (val) => `R$ ${formatarNumeroBR(val, 0)}` } }
            }
        }
    }, meses.length > 0);
    const elNotaMensal = document.getElementById('analises-nota-mensal');
    if (elNotaMensal) {
        elNotaMensal.textContent = meses.length === 0
            ? 'Sem dados com data de saída para os filtros selecionados.'
            : (semData > 0 ? `${semData} ficha(s) sem data de saída não entram no gráfico.` : '');
    }

    // ---------------- 6. Composição das despesas ----------------
    const composicao = [
        { nome: 'Diesel', valor: total.diesel, cor: '#f97316' },
        { nome: 'ARLA', valor: total.arla, cor: '#0ea5e9' },
        { nome: 'Pedágio', valor: total.pedagio, cor: '#eab308' },
        { nome: 'Imposto federal', valor: total.imposto, cor: '#3d3d90' },
        { nome: 'Outras despesas', valor: total.outras, cor: '#94a3b8' }
    ];
    renderizarGraficoAnalise('despesas', 'chart-analises-despesas', 'analises-box-chart-despesas', {
        type: 'doughnut',
        data: {
            labels: composicao.map(c => c.nome),
            datasets: [{ data: composicao.map(c => c.valor), backgroundColor: composicao.map(c => c.cor), borderWidth: 3, borderColor: '#ffffff', hoverOffset: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11, weight: '500' } } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatarMoeda(ctx.parsed)}` } }
            }
        }
    }, total.despesas > 0);
    const elTabDesp = document.getElementById('analises-tabela-despesas');
    if (elTabDesp) {
        elTabDesp.innerHTML = total.despesas > 0
            ? montarTabelaAnalise([{ texto: 'Despesa' }, { texto: 'Valor', num: true }, { texto: '% do total', num: true }],
                composicao.map(c => `
                    <tr>
                        <td><strong>${c.nome}</strong></td>
                        <td class="td-num">${moeda(c.valor)}</td>
                        <td class="td-num">${formatarNumeroBR((c.valor / total.despesas) * 100, 1)}%</td>
                    </tr>
                `))
            : '<div class="analises-vazio">Nenhuma despesa lançada nas fichas filtradas.</div>';
    }

    // ---------------- 7. Ranking de rotas ----------------
    const porRota = {};
    const registrarRota = (origem, destino, valor) => {
        const o = String(origem || '').trim();
        const d = String(destino || '').trim();
        if (!o && !d) return;
        const chave = `${normalizarNomePessoa(o)}→${normalizarNomePessoa(d)}`;
        const r = porRota[chave] = porRota[chave] || { origem: o || '—', destino: d || '—', vezes: 0, valor: 0 };
        r.vezes += 1;
        r.valor += valor;
    };
    lista.forEach(({ ficha, v }) => {
        const fretes = Array.isArray(ficha.fretes) ? ficha.fretes.filter(Boolean) : [];
        if (fretes.length > 0) {
            fretes.forEach(fr => registrarRota(fr.origem, fr.destino, parseValorMoeda(fr.valor)));
        } else {
            // Ficha sem Relação de Fretes: usa o trajeto da própria ficha
            registrarRota(ficha.destinoInicial, ficha.destinoFinal, v.frete);
        }
    });
    const rotas = Object.values(porRota).sort((a, b) => (b.vezes - a.vezes) || (b.valor - a.valor)).slice(0, 10);
    const elTabRotas = document.getElementById('analises-tabela-rotas');
    if (elTabRotas) {
        elTabRotas.innerHTML = montarTabelaAnalise([
            { texto: '#', num: true }, { texto: 'Origem → Destino' }, { texto: 'Viagens', num: true }, { texto: 'Frete', num: true }
        ], rotas.map((r, i) => `
            <tr>
                <td class="td-num">${i + 1}</td>
                <td><strong>${escaparHtml(r.origem)}</strong> → <strong>${escaparHtml(r.destino)}</strong></td>
                <td class="td-num">${r.vezes}</td>
                <td class="td-num">${moeda(r.valor)}</td>
            </tr>
        `), 'Nenhuma rota informada nas fichas filtradas.');
    }

    // ---------------- 8. Abastecimentos por posto ----------------
    const porPosto = {};
    lista.forEach(({ ficha }) => {
        (Array.isArray(ficha.abastecimentos) ? ficha.abastecimentos : []).forEach(ab => {
            if (!ab) return;
            const nome = String(ab.posto || '').trim() || 'Posto não informado';
            const chave = normalizarNomePessoa(nome);
            const p = porPosto[chave] = porPosto[chave] || { nome, abastecimentos: 0, litros: 0, valor: 0 };
            p.abastecimentos += 1;
            p.litros += parseLitrosAbast(ab.litros);
            p.valor += parseValorMoeda(ab.valor || ab.total);
        });
    });
    const postos = Object.values(porPosto).sort((a, b) => b.valor - a.valor);
    const elTabPostos = document.getElementById('analises-tabela-postos');
    if (elTabPostos) {
        elTabPostos.innerHTML = montarTabelaAnalise([
            { texto: 'Posto' }, { texto: 'Abast.', num: true }, { texto: 'Litros', num: true },
            { texto: 'Valor', num: true }, { texto: 'Preço médio/L', num: true }
        ], postos.map(p => `
            <tr>
                <td><strong>${escaparHtml(p.nome)}</strong></td>
                <td class="td-num">${p.abastecimentos}</td>
                <td class="td-num">${p.litros > 0 ? `${formatarNumeroBR(p.litros, 2)} L` : '—'}</td>
                <td class="td-num">${moeda(p.valor)}</td>
                <td class="td-num">${textoOuTraco(dividirOuNulo(p.valor, p.litros), n => `R$ ${formatarNumeroBR(n, 3)}`)}</td>
            </tr>
        `), 'Nenhum abastecimento nas fichas filtradas.');
    }

    // ---------------- 9. Por combustível ----------------
    // Ficha antiga sem combustível aparece numa linha à parte (conta como diesel na média)
    const porCombustivel = {
        diesel_s10: { nome: 'Diesel S10', litros: 0, valor: 0, qtd: 0 },
        diesel_s500: { nome: 'Diesel S500', litros: 0, valor: 0, qtd: 0 },
        arla: { nome: 'ARLA', litros: 0, valor: 0, qtd: 0 },
        sem: { nome: 'Sem combustível (fichas antigas, conta como diesel)', litros: 0, valor: 0, qtd: 0 }
    };
    lista.forEach(({ ficha }) => {
        listaAbastecimentos(ficha).forEach(ab => {
            const c = porCombustivel[ROTULOS_COMBUSTIVEL[ab.combustivel] ? ab.combustivel : 'sem'];
            c.qtd += 1;
            c.litros += parseLitrosAbast(ab.litros);
            c.valor += valorAbastecimento(ab);
        });
    });
    const combustiveis = Object.entries(porCombustivel)
        .filter(([chave, c]) => chave !== 'sem' || c.qtd > 0)
        .map(([, c]) => c);
    const elTabComb = document.getElementById('analises-tabela-combustiveis');
    if (elTabComb) {
        elTabComb.innerHTML = montarTabelaAnalise([
            { texto: 'Combustível' }, { texto: 'Litros', num: true },
            { texto: 'Valor', num: true }, { texto: 'Preço médio/L', num: true }
        ], combustiveis.some(c => c.qtd > 0) ? combustiveis.map(c => `
            <tr>
                <td><strong>${escaparHtml(c.nome)}</strong></td>
                <td class="td-num">${c.litros > 0 ? `${formatarNumeroBR(c.litros, 2)} L` : '—'}</td>
                <td class="td-num">${moeda(c.valor)}</td>
                <td class="td-num">${textoOuTraco(dividirOuNulo(c.valor, c.litros), n => `R$ ${formatarNumeroBR(n, 3)}`)}</td>
            </tr>
        `) : [], 'Nenhum abastecimento nas fichas filtradas.');
    }
}

// Só recalcula quando a aba está aberta (evita desenhar gráficos em área oculta)
function renderizarAnalisesSeVisivel() {
    const secao = document.getElementById('view-analises');
    if (secao && secao.classList.contains('active')) renderizarAnalises();
}

// ==========================================================================
// 8. CONTROLE DE NAVEGAÇÃO DE SEÇÕES (SIDEBAR TABS)
// ==========================================================================

function alternarSecao(viewId) {
    if (!viewId) return;

    // Atualiza links da sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        const targetView = link.getAttribute('data-view');
        link.classList.toggle('active', targetView === viewId);
    });

    if (viewId === 'fichas') {
        const moduloFichas = document.getElementById('modulo-fichas-portal');
        const viewDash = document.getElementById('view-dashboard');
        
        document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
        if (viewDash) viewDash.classList.add('active');
        
        if (moduloFichas) {
            setTimeout(() => {
                moduloFichas.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
        return;
    }

    document.querySelectorAll('.admin-section').forEach(sec => {
        const id = sec.id.replace('view-', '');
        sec.classList.toggle('active', id === viewId);
    });

    // Gráficos da aba Análises são desenhados quando a aba fica visível
    if (viewId === 'analises') renderizarAnalises();
    // Aba Motoristas (frota e terceiros) é lida do banco ao abrir
    if (viewId === 'cadastros') carregarAbaMotoristas();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// 9. TOAST DE NOTIFICAÇÃO DO DASHBOARD
// ==========================================================================

let toastTimeout = null;
function exibirToast(mensagem, tipo = 'sucesso') {
    const toast = document.getElementById('admin-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl) return;

    msgEl.textContent = mensagem;

    if (iconEl) {
        if (tipo === 'sucesso') {
            iconEl.textContent = '✓';
            iconEl.style.backgroundColor = '#10b981';
            toast.style.borderLeftColor = '#10b981';
        } else if (tipo === 'erro') {
            iconEl.textContent = '✕';
            iconEl.style.backgroundColor = '#ef4444';
            toast.style.borderLeftColor = '#ef4444';
        } else {
            iconEl.textContent = 'ℹ';
            iconEl.style.backgroundColor = '#3b82f6';
            toast.style.borderLeftColor = '#3b82f6';
        }
    }

    toast.classList.add('show');
    toast.setAttribute('aria-hidden', 'false');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.setAttribute('aria-hidden', 'true');
    }, 4000);
}

// ==========================================================================
// 10. FUNÇÕES AUXILIARES DE FORMATAÇÃO E MOEDA
// ==========================================================================

function parseValorMoeda(str) {
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    if (str === null || str === undefined) return 0;
    const s = String(str).trim();
    if (!s) return 0;
    // Se contém vírgula, segue formatação padrão brasileira (ex: 1.250,50 ou 1250,50)
    if (s.includes(',')) {
        const limpo = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const n = parseFloat(limpo);
        return isNaN(n) ? 0 : n;
    }
    // Formato float puro ou string limpa (ex: 1250.50)
    const limpo = s.replace(/[R$\s]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
}

function formatarMoeda(num) {
    if (typeof num !== 'number' || isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarMoedaSemPrefixo(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarNomeCliente(slug) {
    if (slug === 'shopee') return 'Shopee';
    if (slug === 'mercado_livre') return 'Mercado Livre';
    if (slug === 'alimenticio') return 'Alimentício';
    return slug || 'Cliente';
}

// ==========================================================================
// 10.1. FILTRO DINÂMICO DE MOTORISTAS (SUPABASE + FICHAS LOCAIS)
// ==========================================================================

async function carregarFiltroMotoristas() {
    const selectMotorista = document.getElementById('filtro-motorista-select');
    if (!selectMotorista) return;

    const motoristaSelecionadoAntes = appState.filtroMotorista || 'todos';
    const motoristasSet = new Set();

    // a) Busca dinamicamente no Supabase todos os registros da tabela 'perfis' com role = 'motorista'
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('perfis')
                .select('nome')
                .eq('role', 'motorista');
            if (!error && Array.isArray(data)) {
                data.forEach(p => {
                    if (p.nome && p.nome.trim()) {
                        motoristasSet.add(p.nome.trim());
                    }
                });
            }
        } catch (e) {
            console.warn('Erro ao consultar perfis de motoristas no Supabase:', e);
        }
    }

    // b) Mescla com os motoristas já registrados nas fichas carregadas para não deixar ninguém de fora
    if (Array.isArray(appState.fichas)) {
        appState.fichas.forEach(f => {
            if (f.motorista && f.motorista.trim() && f.motorista !== 'Motorista Não Identificado') {
                motoristasSet.add(f.motorista.trim());
            }
        });
    }

    // c) Remove duplicatas e ordena alfabeticamente
    const listaOrdenada = Array.from(motoristasSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // d) Mantém a opção inicial "Todos os Motoristas"
    selectMotorista.innerHTML = '<option value="todos">Todos os Motoristas</option>';
    listaOrdenada.forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        opt.textContent = nome;
        if (nome.toLowerCase() === motoristaSelecionadoAntes.toLowerCase()) {
            opt.selected = true;
        }
        selectMotorista.appendChild(opt);
    });
}

// Sincronização em Nuvem e Tempo Real com o Supabase
async function sincronizarFichasComSupabase() {
    if (typeof window.buscarFichasSupabase === 'function') {
        try {
            const fichasNuvem = await window.buscarFichasSupabase();
            if (Array.isArray(fichasNuvem)) {
                console.log(`📥 ${fichasNuvem.length} ficha(s) sincronizada(s) do Supabase.`);
                appState.fichas = fichasNuvem;
                salvarFichasNoStorage();
                calcularMetricasDashboard();
                renderizarTabelaFichas();
                atualizarGraficos();
                preencherSecoesSecundarias();
                carregarFiltroMotoristas();
            }
        } catch (e) {
            console.warn('Não foi possível sincronizar com o Supabase de imediato:', e);
        }
    }

    // Ativa escuta em tempo real (Realtime do Supabase)
    if (typeof window.escutarAlteracoesFichasSupabase === 'function') {
        window.escutarAlteracoesFichasSupabase(
            (novaFicha) => {
                const existe = appState.fichas.some(f => f.id === novaFicha.id);
                if (!existe) {
                    appState.fichas.unshift(novaFicha);
                    salvarFichasNoStorage();
                    calcularMetricasDashboard();
                    renderizarTabelaFichas();
                    atualizarGraficos();
                    carregarFiltroMotoristas();
                    exibirToast(`🔔 Nova ficha recebida: ${novaFicha.id} (${novaFicha.motorista})`, 'info');
                }
            },
            (fichaAtualizada) => {
                const idx = appState.fichas.findIndex(f => f.id === fichaAtualizada.id);
                if (idx >= 0) {
                    appState.fichas[idx] = fichaAtualizada;
                    salvarFichasNoStorage();
                    calcularMetricasDashboard();
                    renderizarTabelaFichas();
                    atualizarGraficos();
                    renderizarTabelaAcertos();
                    carregarFiltroMotoristas();
                }
            },
            (idFichaExcluida) => {
                if (!idFichaExcluida) return;
                const idx = appState.fichas.findIndex(f => f.id === idFichaExcluida);
                if (idx >= 0) {
                    appState.fichas.splice(idx, 1);
                    salvarFichasNoStorage();
                    calcularMetricasDashboard();
                    renderizarTabelaFichas();
                    atualizarGraficos();
                    preencherSecoesSecundarias();
                    carregarFiltroMotoristas();
                    exibirToast(`🗑️ Ficha ${idFichaExcluida} removida da gestão em tempo real.`, 'info');
                }
            }
        );
    }

    // Conecta listener realtime no canal do Supabase da tabela 'perfis'
    if (window.supabaseClient) {
        try {
            window.supabaseClient
                .channel('realtime_perfis_filtro_motoristas')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, () => {
                    console.log('⚡ Atualização em perfis de motoristas detectada.');
                    carregarFiltroMotoristas();
                    carregarMotoristasCadastrados();
                })
                .subscribe();
        } catch (e) {
            console.warn('Erro ao conectar realtime de perfis:', e);
        }
    }
}

// ==========================================================================
// 11. EVENT LISTENERS E INICIALIZAÇÃO DO DOM
// ==========================================================================

// Só inicia depois que a sessão de admin/diretoria for validada no servidor (auth.js)
ajbAoAutenticar(['admin', 'diretoria'], 'Login.html#admin', () => {
    window.ajbAuth.vigiarSessao('Login.html#admin');
    preencherUsuarioSidebar();
    // 1. Inicializa o banco de dados e carrega configurações dinâmicas
    inicializarBancoDados();
    carregarConfiguracoes();
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    inicializarGraficos();
    preencherSecoesSecundarias();
    carregarFiltroMotoristas();
    carregarMotoristasCadastrados();
    inicializarAbaMotoristas();

    // Sincroniza com o Supabase e ativa o Realtime
    sincronizarFichasComSupabase();

    // 2. Verifica se há mensagem de toast pendente vinda da aprovação de ficha
    const toastPendente = sessionStorage.getItem('ajborges_toast_mensagem');
    if (toastPendente) {
        exibirToast(toastPendente, 'sucesso');
        sessionStorage.removeItem('ajborges_toast_mensagem');
    }

    // 3. Atualiza data atual no cabeçalho
    const elDataAtual = document.getElementById('current-date-display');
    if (elDataAtual) {
        const hoje = new Date();
        const opcoes = { day: 'numeric', month: 'long', year: 'numeric' };
        elDataAtual.textContent = hoje.toLocaleDateString('pt-BR', opcoes);
    }

    // 4. Navegação por abas da sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const view = link.getAttribute('data-view');
            if (view) {
                e.preventDefault();
                alternarSecao(view);
                history.replaceState(null, '', `#${view}`);

                const sidebar = document.getElementById('admin-sidebar');
                if (sidebar && sidebar.classList.contains('sidebar-aberta')) {
                    sidebar.classList.remove('sidebar-aberta');
                }
            }
        });
    });

    // Lê a hash da URL caso exista (ex: dashboard-admin.html#fichas)
    const currentHash = window.location.hash.replace('#', '').toLowerCase();
    if (currentHash) {
        alternarSecao(currentHash);
    }

    // 5. Botões de filtro da tabela de fichas (Pendentes / Aprovadas / Todas)
    document.querySelectorAll('.tab-ficha-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-ficha-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.filtroStatus = btn.getAttribute('data-status');
            renderizarTabelaFichas();
        });
    });

    // 6. Filtro de motorista na tabela
    const selectMotorista = document.getElementById('filtro-motorista-select');
    if (selectMotorista) {
        selectMotorista.addEventListener('change', (e) => {
            appState.filtroMotorista = e.target.value;
            renderizarTabelaFichas();
        });
    }

    // 6.1 Filtros da aba Acerto com Motoristas
    const selectAcertosMotorista = document.getElementById('filtro-acertos-motorista');
    const inputBuscaAcertos = document.getElementById('busca-acertos-ficha');
    if (selectAcertosMotorista) selectAcertosMotorista.addEventListener('change', renderizarTabelaAcertos);
    if (inputBuscaAcertos) inputBuscaAcertos.addEventListener('input', renderizarTabelaAcertos);

    // 6.2 Filtro de motorista cadastrado na aba Gestão de Frota
    const selectFrotaMotorista = document.getElementById('filtro-frota-motorista');
    if (selectFrotaMotorista) selectFrotaMotorista.addEventListener('change', renderizarTabelaFrota);

    // 6.3 Filtros da aba Análises
    ['analises-data-de', 'analises-data-ate', 'analises-filtro-motorista', 'analises-filtro-placa', 'analises-filtro-status']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', renderizarAnalises);
        });

    // 6.4 Ordenação da tabela "Por placa" pelo cabeçalho
    const tabelaPlacas = document.getElementById('analises-tabela-placas');
    if (tabelaPlacas) {
        tabelaPlacas.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-ordem]');
            if (th) ordenarTabelaPlacas(th.getAttribute('data-ordem'));
        });
        tabelaPlacas.addEventListener('keydown', (e) => {
            const th = e.target.closest('th[data-ordem]');
            if (th && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                ordenarTabelaPlacas(th.getAttribute('data-ordem'));
                tabelaPlacas.querySelector(`th[data-ordem="${th.getAttribute('data-ordem')}"]`)?.focus();
            }
        });
    }

    // 7. Busca global em tempo real
    const inputBusca = document.getElementById('global-search-input');
    const btnClearBusca = document.getElementById('search-clear-btn');

    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            appState.termoBusca = e.target.value;
            if (btnClearBusca) {
                btnClearBusca.style.display = appState.termoBusca ? 'block' : 'none';
            }
            renderizarTabelaFichas();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputBusca.focus();
                inputBusca.select();
            }
        });
    }

    if (btnClearBusca) {
        btnClearBusca.addEventListener('click', () => {
            if (inputBusca) {
                inputBusca.value = '';
                appState.termoBusca = '';
                btnClearBusca.style.display = 'none';
                renderizarTabelaFichas();
                inputBusca.focus();
            }
        });
    }

    // 8. Filtro de período (Mês Atual / Últimos 30 dias / Semana)
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.filtroPeriodo = btn.getAttribute('data-period');
            exibirToast(`Filtro de período: ${btn.textContent}`, 'info');
        });
    });

    // 9. Botão de Atualizar Dados
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            inicializarBancoDados();
            calcularMetricasDashboard();
            renderizarTabelaFichas();
            atualizarGraficos();
            preencherSecoesSecundarias();
            exibirToast('Dados operacionais atualizados em tempo real.', 'sucesso');
        });
    }

    // 9.1 Botão de Limpeza do Banco de Dados Local (Apagar Dados)
    const btnLimparDados = document.getElementById('btn-limpar-dados-armazenados');
    if (btnLimparDados) {
        btnLimparDados.addEventListener('click', () => {
            if (confirm('Tem certeza de que deseja apagar todas as fichas e dados locais salvos? Esta ação não pode ser desfeita.')) {
                localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify([]));
                appState.fichas = [];
                calcularMetricasDashboard();
                renderizarTabelaFichas();
                atualizarGraficos();
                preencherSecoesSecundarias();
                exibirToast('Todas as fichas e dados foram apagados com sucesso.', 'sucesso');
            }
        });
    }

    // 9.2 Botões de Confirmação dos Parâmetros Operacionais (Meta Diesel & Taxa Borges)
    const btnSalvarMeta = document.getElementById('btn-salvar-meta-diesel');
    const btnSalvarTaxa = document.getElementById('btn-salvar-taxa-borges');

    if (btnSalvarMeta) {
        btnSalvarMeta.addEventListener('click', () => {
            confirmarESalvarMetaDiesel();
        });
    }

    if (btnSalvarTaxa) {
        btnSalvarTaxa.addEventListener('click', () => {
            confirmarESalvarTaxaBorges();
        });
    }

    // Permitir confirmar com tecla Enter nos campos de Meta ou Taxa
    const inputConfigMeta = document.getElementById('config-meta-diesel');
    const inputConfigTaxa = document.getElementById('config-taxa-borges');

    if (inputConfigMeta) {
        inputConfigMeta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmarESalvarMetaDiesel();
            }
        });
    }

    if (inputConfigTaxa) {
        inputConfigTaxa.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmarESalvarTaxaBorges();
            }
        });
    }

    // 10. Botão de Logout (Sair)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            fazerLogoutAdmin();
        });
    }

    // 11. Toggle Sidebar no Mobile e Desktop
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('admin-sidebar');

    if (btnMobileMenu && sidebar) {
        btnMobileMenu.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-aberta');
        });
    }

    if (btnToggleSidebar && sidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-aberta');
        });
    }

    // 12. Modal de Resumo Fechar
    const btnFecharModal = document.getElementById('modal-close-btn');
    const btnFecharModalRodape = document.getElementById('btn-modal-fechar');
    const modalOverlay = document.getElementById('modal-resumo-ficha');

    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModalResumo);
    if (btnFecharModalRodape) btnFecharModalRodape.addEventListener('click', fecharModalResumo);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) fecharModalResumo();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharModalResumo();
    });
});

// ==========================================================================
// 12. FUNÇÃO GLOBAL DE LOGOUT ADMINISTRATIVO
// ==========================================================================
function fazerLogoutAdmin() {
    if (confirm('Deseja realmente encerrar a sessão de Administrador?')) {
        // Encerra a sessão no Supabase e apaga os dados de fichas guardados neste navegador
        window.ajbAuth.sair('Login.html#admin');
    }
}
window.fazerLogoutAdmin = fazerLogoutAdmin;


// ==========================================================================
// 13. ABA MOTORISTAS: FROTA (gerenciar-frota) × TERCEIROS E AGREGADOS
//     Frota = perfis com vinculo 'frota' (RPC listar_motoristas_frota).
//     Terceiros = cadastros_agregados, só consulta.
//     Senhas nunca aparecem na tela, no console ou na lista.
// ==========================================================================

const DOMINIO_SEM_EMAIL = '@sem-email.ajborges.com.br';
const TAMANHO_LOTE_IMPORTACAO = 50;

const estadoMotoristas = {
    iniciado: false,
    frota: [],
    terceiros: [],
    cpfsFrota: new Set(),
    cpfsTerceiros: new Set(),
    importacao: [] // linhas da prévia
};

function cpfValidoBR(cpf) {
    const d = somenteDigitos(cpf);
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    const digito = (base, peso) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
}

function formatarCpfCompleto(cpf) {
    const d = somenteDigitos(cpf);
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
}

// 10 ou 11 dígitos; aceita com 55 (DDI) na frente. Devolve só os dígitos ou ''
function limparCelularBR(valor) {
    let d = somenteDigitos(valor);
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? d : '';
}

function formatarCelularBR(valor) {
    const d = somenteDigitos(valor);
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return d;
}

function mascaraCpfDigitando(valor) {
    const d = somenteDigitos(valor).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraCelularDigitando(valor) {
    const d = somenteDigitos(valor).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Mesma regra da edge function gerenciar-frota (senhaPadrao)
function senhaPadraoFrota(cpf) {
    return `${somenteDigitos(cpf).slice(0, 6)}@frota`;
}

function dataHoraBR(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Chama a edge function gerenciar-frota com o token da sessão (Verify JWT ligado)
async function chamarGerenciarFrota(corpo) {
    const c = window.supabaseClient;
    if (!c) return { ok: false, status: 0, dados: { erro: 'Serviço indisponível no momento.' } };
    const { data } = await c.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return { ok: false, status: 401, dados: { erro: 'Sessão expirada. Entre novamente.' } };
    try {
        const resp = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/gerenciar-frota`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(corpo)
        });
        let dados = {};
        try { dados = await resp.json(); } catch (e) { /* resposta sem JSON */ }
        return { ok: resp.ok, status: resp.status, dados };
    } catch (e) {
        return { ok: false, status: 0, dados: { erro: 'Falha de conexão. Tente novamente.' } };
    }
}

// ---------------- Carregamento ----------------

async function carregarAbaMotoristas() {
    const c = window.supabaseClient;
    if (!c) return;
    const [frota, terceiros] = await Promise.all([
        c.rpc('listar_motoristas_frota'),
        c.from('cadastros_agregados')
            .select('id, nome, cpf, celular, status, criado_em, tipologia:dados->>_tipologia')
            .order('criado_em', { ascending: false })
    ]);

    if (frota.error) {
        console.warn('Erro ao carregar a frota:', frota.error.message);
        estadoMotoristas.frota = [];
        const tbody = document.getElementById('mot-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="tabela-empty-state">Não foi possível carregar a frota. Confira se o passo 9 do banco foi aplicado e atualize a página.</td></tr>';
    } else {
        estadoMotoristas.frota = Array.isArray(frota.data) ? frota.data : [];
    }
    if (terceiros.error) {
        console.warn('Erro ao carregar terceiros:', terceiros.error.message);
        estadoMotoristas.terceiros = [];
    } else {
        estadoMotoristas.terceiros = Array.isArray(terceiros.data) ? terceiros.data : [];
    }

    estadoMotoristas.cpfsFrota = new Set(estadoMotoristas.frota.map(m => somenteDigitos(m.cpf)).filter(Boolean));
    estadoMotoristas.cpfsTerceiros = new Set(estadoMotoristas.terceiros.map(t => somenteDigitos(t.cpf)).filter(Boolean));

    if (!frota.error) renderizarFrota();
    renderizarTerceiros();
}

// ---------------- Aba Frota ----------------

function seloSituacaoMotorista(m) {
    if (m.status === 'inativo') return '<span class="status-pill mot-selo-inativo">Inativo</span>';
    if (m.status !== 'aprovado') return `<span class="status-pill mot-selo-inativo">${escaparHtml(m.status)}</span>`;
    return '<span class="status-pill status-concluido">Ativo</span>';
}

function renderizarFrota() {
    const lista = estadoMotoristas.frota;
    // "Válidos (ativos)": todos que não foram desativados
    const validos = lista.filter(m => m.status !== 'inativo');
    const semEmail = lista.filter(m => !m.tem_email);
    const inativos = lista.filter(m => m.status === 'inativo');

    const qtdAba = document.getElementById('mot-aba-frota-qtd');
    if (qtdAba) qtdAba.textContent = lista.length;

    const elKpis = document.getElementById('mot-kpis');
    if (elKpis) {
        const cards = [
            { classe: 'card-frota-kpi', rotulo: 'Motoristas da frota', valor: lista.length },
            { classe: 'card-entrada', rotulo: 'Ativos', valor: validos.length, nota: 'Clique para filtrar', filtro: 'validos' },
            { classe: 'card-frota-kpi', rotulo: 'Sem e-mail', valor: semEmail.length },
            { classe: 'card-resultado', rotulo: 'Inativos', valor: inativos.length, filtro: 'inativo' }
        ];
        elKpis.innerHTML = cards.map(c => `
            <div class="kpi-card ${c.classe}${c.filtro ? ' mot-kpi-clicavel' : ''}"${c.filtro ? ` data-mot-filtro="${c.filtro}" role="button" tabindex="0"` : ''}>
                <span class="kpi-label">${c.rotulo}</span>
                <h3 class="kpi-value">${c.valor}</h3>
                ${c.nota ? `<span class="kpi-meta-text">${c.nota}</span>` : ''}
            </div>
        `).join('');
    }

    const termo = normalizarNomePessoa(document.getElementById('mot-busca')?.value || '');
    const termoDigitos = somenteDigitos(termo);
    const situacao = document.getElementById('mot-filtro-situacao')?.value || '';

    const filtrados = lista.filter(m => {
        if (situacao === 'validos' && m.status === 'inativo') return false;
        if (situacao === 'inativo' && m.status !== 'inativo') return false;
        if (!termo) return true;
        if (normalizarNomePessoa(m.nome).includes(termo)) return true;
        return termoDigitos.length >= 3 &&
            (somenteDigitos(m.cpf).includes(termoDigitos) || somenteDigitos(m.telefone).includes(termoDigitos));
    });

    const info = document.getElementById('mot-info-registros');
    if (info) info.textContent = `${filtrados.length} de ${lista.length} motorista(s)`;

    const tbody = document.getElementById('mot-tbody');
    if (!tbody) return;
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="tabela-empty-state">${lista.length === 0
            ? 'Nenhum motorista da frota cadastrado. Use <strong>Adicionar motorista da frota</strong> ou <strong>Importar planilha</strong>.'
            : 'Nenhum motorista encontrado para a busca ou o filtro.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(m => {
        const id = escaparHtml(m.id);
        const tambemTerceiro = estadoMotoristas.cpfsTerceiros.has(somenteDigitos(m.cpf));
        const inativo = m.status === 'inativo';
        return `
            <tr>
                <td><strong>${escaparHtml(m.nome || 'Sem nome')}</strong>
                    ${tambemTerceiro ? '<span class="mot-selo-duplo" title="Este CPF também tem cadastro de terceiro/agregado">também é terceiro</span>' : ''}</td>
                <td class="mot-nowrap">${escaparHtml(formatarCpfCompleto(m.cpf))}</td>
                <td class="mot-nowrap">${escaparHtml(formatarCelularBR(m.telefone)) || '—'}</td>
                <td>${m.tem_email ? escaparHtml(m.email) : '<span class="mot-texto-cinza">sem e-mail</span>'}</td>
                <td>${seloSituacaoMotorista(m)}</td>
                <td class="mot-nowrap">${m.ultimo_acesso ? escaparHtml(dataHoraBR(m.ultimo_acesso)) : '<span class="mot-texto-cinza">nunca entrou</span>'}</td>
                <td>
                    <div class="table-actions-cell">
                        <button type="button" class="btn-acao-resumo" data-mot-acao="redefinir_senha" data-id="${id}">Redefinir para a senha padrão</button>
                        ${inativo
                            ? `<button type="button" class="btn-acao-aprovar-rapido" data-mot-acao="reativar" data-id="${id}">Reativar</button>`
                            : `<button type="button" class="btn-acao-excluir" data-mot-acao="desativar" data-id="${id}">Desativar</button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function executarAcaoMotorista(acao, id) {
    const m = estadoMotoristas.frota.find(x => x.id === id);
    if (!m) return;
    const nome = m.nome || 'este motorista';
    const perguntas = {
        redefinir_senha: `Redefinir a senha de ${nome}?\n\nA senha volta a ser a padrão: os 6 primeiros dígitos do CPF + @frota. As sessões abertas dele serão encerradas.`,
        desativar: `Desativar ${nome}?\n\nEle deixa de conseguir entrar na ficha de viagem e as sessões abertas são encerradas. Dá para reativar depois.`,
        reativar: `Reativar ${nome}?\n\nEle volta a conseguir entrar na ficha de viagem com a senha atual.`
    };
    if (!perguntas[acao] || !confirm(perguntas[acao])) return;

    const r = await chamarGerenciarFrota({ acao, id });
    if (!r.ok) {
        exibirToast((r.dados && r.dados.erro) || 'Não foi possível concluir a ação.', 'erro');
        return;
    }
    const mensagens = {
        redefinir_senha: 'Senha redefinida para a padrão (6 primeiros dígitos do CPF + @frota).',
        desativar: 'Motorista desativado.',
        reativar: 'Motorista reativado.'
    };
    exibirToast(mensagens[acao], 'sucesso');
    await carregarAbaMotoristas();
}

// ---------------- Aba Terceiros e agregados ----------------

const ROTULOS_STATUS_TERCEIRO = {
    pendente: '<span class="status-pill status-pendente">Pendente</span>',
    analise: '<span class="status-pill status-aguardando-confirmacao">Em análise</span>',
    aprovado: '<span class="status-pill status-concluido">Aprovado</span>',
    recusado: '<span class="status-pill mot-selo-recusado">Recusado</span>'
};

function renderizarTerceiros() {
    const lista = estadoMotoristas.terceiros;
    const qtdAba = document.getElementById('mot-aba-terceiros-qtd');
    if (qtdAba) qtdAba.textContent = lista.length;

    const termo = normalizarNomePessoa(document.getElementById('ter-busca')?.value || '');
    const termoDigitos = somenteDigitos(termo);
    const filtrados = lista.filter(t => {
        if (!termo) return true;
        if (normalizarNomePessoa(t.nome).includes(termo)) return true;
        return termoDigitos.length >= 3 && somenteDigitos(t.cpf).includes(termoDigitos);
    });

    const info = document.getElementById('ter-info-registros');
    if (info) info.textContent = `${filtrados.length} de ${lista.length} cadastro(s)`;

    const tbody = document.getElementById('ter-tbody');
    if (!tbody) return;
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="tabela-empty-state">${lista.length === 0
            ? 'Nenhum cadastro de terceiro ou agregado recebido.'
            : 'Nenhum cadastro encontrado para a busca.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(t => {
        const tambemFrota = estadoMotoristas.cpfsFrota.has(somenteDigitos(t.cpf));
        return `
            <tr>
                <td><strong>${escaparHtml(t.nome || 'Sem nome')}</strong>
                    ${tambemFrota ? '<span class="mot-selo-duplo" title="Este CPF também é de um motorista da frota">também é frota</span>' : ''}</td>
                <td class="mot-nowrap">${escaparHtml(formatarCpfCompleto(t.cpf))}</td>
                <td class="mot-nowrap">${escaparHtml(formatarCelularBR(t.celular)) || '—'}</td>
                <td>${escaparHtml(t.tipologia || '—')}</td>
                <td>${ROTULOS_STATUS_TERCEIRO[t.status] || escaparHtml(t.status)}</td>
                <td class="mot-nowrap">${escaparHtml(dataHoraBR(t.criado_em)) || '—'}</td>
                <td>
                    <div class="table-actions-cell">
                        <a class="btn-acao-conferir" href="Dashboard-cadastro-motorista.html?id=${encodeURIComponent(t.id)}">Abrir no Dashboard de Cadastros</a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ---------------- Modais (abrir/fechar) ----------------

function abrirModalMotoristas(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function fecharModalMotoristas(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (modal.id === 'modal-mot-adicionar') limparFormularioMotorista();
}

// ---------------- Adicionar motorista ----------------

let senhaInicialEditada = false;

function mostrarAlertaMot(id, texto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = texto || '';
    el.hidden = !texto;
}

function limparFormularioMotorista() {
    const form = document.getElementById('mot-add-form');
    if (!form) return;
    form.reset();
    form.hidden = false;
    senhaInicialEditada = false;
    const senha = document.getElementById('mot-add-senha');
    senha.type = 'password';
    document.getElementById('mot-add-olho').textContent = 'Mostrar';
    mostrarAlertaMot('mot-add-alerta', '');
    document.getElementById('mot-add-sucesso').hidden = true;
    document.getElementById('mot-add-salvar').hidden = false;
    document.getElementById('mot-add-outro').hidden = true;
    avaliarSenhaInicial();
}

// Checklist do senha.js só quando a senha não é a padrão
function avaliarSenhaInicial() {
    const cpf = document.getElementById('mot-add-cpf')?.value || '';
    const senha = document.getElementById('mot-add-senha')?.value || '';
    const lista = document.getElementById('mot-add-requisitos');
    if (!lista || !window.ajbSenha) return;
    const ehPadrao = senha !== '' && senha === senhaPadraoFrota(cpf);
    lista.hidden = senha === '' || ehPadrao;
    const r = window.ajbSenha.regras(senha, cpf);
    lista.querySelectorAll('[data-req]').forEach(li => {
        const ok = r[li.getAttribute('data-req')] === true;
        li.classList.toggle('valido', ok);
        li.querySelector('span').textContent = ok ? '✓' : '✕';
    });
}

function preencherSenhaPadrao(forcar) {
    const cpf = document.getElementById('mot-add-cpf')?.value || '';
    const senha = document.getElementById('mot-add-senha');
    if (!senha) return;
    if (forcar) senhaInicialEditada = false;
    if (!senhaInicialEditada) senha.value = somenteDigitos(cpf).length === 11 ? senhaPadraoFrota(cpf) : '';
    avaliarSenhaInicial();
}

async function salvarMotoristaFrota() {
    const nome = document.getElementById('mot-add-nome').value.replace(/\s+/g, ' ').trim();
    const cpf = somenteDigitos(document.getElementById('mot-add-cpf').value);
    const celular = limparCelularBR(document.getElementById('mot-add-celular').value);
    const email = document.getElementById('mot-add-email').value.trim().toLowerCase();
    const senha = document.getElementById('mot-add-senha').value;

    if (!nome) return mostrarAlertaMot('mot-add-alerta', 'Informe o nome completo.');
    if (!cpfValidoBR(cpf)) return mostrarAlertaMot('mot-add-alerta', 'CPF inválido. Confira os números.');
    if (!celular) return mostrarAlertaMot('mot-add-alerta', 'Celular inválido. Use DDD + número.');
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(DOMINIO_SEM_EMAIL))) {
        return mostrarAlertaMot('mot-add-alerta', 'E-mail inválido. Corrija ou deixe em branco.');
    }
    // Em branco = senha padrão
    const ehPadrao = !senha || senha === senhaPadraoFrota(cpf);
    if (!ehPadrao && window.ajbSenha) {
        const problema = window.ajbSenha.erro(senha, cpf);
        if (problema) return mostrarAlertaMot('mot-add-alerta', `Senha fora da regra: ${problema}`);
    }
    mostrarAlertaMot('mot-add-alerta', '');

    const botao = document.getElementById('mot-add-salvar');
    botao.disabled = true;
    botao.textContent = 'Cadastrando...';
    try {
        const corpo = { acao: 'criar', nome, cpf, celular };
        if (email) corpo.email = email;
        if (!ehPadrao) corpo.senha = senha; // a padrão o servidor monta sozinho
        const r = await chamarGerenciarFrota(corpo);
        if (!r.ok) {
            let msg = (r.dados && r.dados.erro) || 'Não foi possível cadastrar o motorista.';
            if (r.status === 409 && /cpf/i.test(msg)) msg = 'CPF já cadastrado.';
            else if (r.status === 409 && /e-mail/i.test(msg)) msg = 'Este e-mail já está em uso.';
            else if (r.status === 400 && /senha/i.test(msg)) msg = `Senha fora da regra: ${msg}`;
            mostrarAlertaMot('mot-add-alerta', msg);
            return;
        }
        // A senha não fica em lugar nenhum da tela
        const form = document.getElementById('mot-add-form');
        form.reset();
        form.hidden = true;
        senhaInicialEditada = false;
        document.getElementById('mot-add-sucesso').hidden = false;
        botao.hidden = true;
        document.getElementById('mot-add-outro').hidden = false;
        await carregarAbaMotoristas();
    } finally {
        botao.disabled = false;
        botao.textContent = 'Cadastrar motorista';
    }
}

// ---------------- Importar planilha (CSV lido só no navegador) ----------------

function normalizarCabecalho(texto) {
    return String(texto || '').replace(/^﻿/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toLowerCase();
}

// Lê CSV com aspas ("a;b" e "" dentro de aspas). Separador: ; ou ,
function lerCsv(texto) {
    const conteudo = texto.replace(/^﻿/, '');
    const primeira = conteudo.split(/\r?\n/, 1)[0] || '';
    const separador = (primeira.split(';').length >= primeira.split(',').length) ? ';' : ',';
    const linhas = [];
    let linha = [], campo = '', aspas = false;
    for (let i = 0; i < conteudo.length; i++) {
        const ch = conteudo[i];
        if (aspas) {
            if (ch === '"' && conteudo[i + 1] === '"') { campo += '"'; i++; }
            else if (ch === '"') aspas = false;
            else campo += ch;
        } else if (ch === '"') aspas = true;
        else if (ch === separador) { linha.push(campo); campo = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && conteudo[i + 1] === '\n') i++;
            linha.push(campo); linhas.push(linha); linha = []; campo = '';
        } else campo += ch;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
}

function montarPreviaImportacao(texto) {
    const linhas = lerCsv(texto);
    if (linhas.length < 2) return { erro: 'A planilha está vazia ou só tem o cabeçalho.' };

    const cab = linhas[0].map(normalizarCabecalho);
    const achar = (...nomes) => cab.findIndex(c => nomes.includes(c));
    const iNome = achar('motorista', 'nome');
    const iCpf = achar('cpf');
    const iContato = achar('contato', 'celular', 'telefone');
    const iTipo = achar('tipo');
    if (iNome < 0 || iCpf < 0 || iContato < 0) {
        return { erro: 'Não achei as colunas necessárias. A primeira linha precisa ter: Motorista (ou Nome), CPF e Contato (ou Celular/Telefone).' };
    }

    const vistos = new Set();
    const itens = [];
    let ignoradas = 0;
    linhas.slice(1).forEach((cols, idx) => {
        const numeroLinha = idx + 2; // linha 1 é o cabeçalho
        if (cols.every(c => !String(c || '').trim())) return; // linha em branco
        if (iTipo >= 0 && normalizarCabecalho(cols[iTipo]) !== 'frota') { ignoradas++; return; }

        const nome = String(cols[iNome] || '').replace(/\s+/g, ' ').trim();
        const cpf = somenteDigitos(cols[iCpf]);
        const celular = limparCelularBR(cols[iContato]);
        let situacao = 'OK';
        if (!cpfValidoBR(cpf)) situacao = 'CPF inválido';
        else if (!nome) situacao = 'Sem nome';
        else if (!celular) situacao = 'Sem celular';
        else if (vistos.has(cpf)) situacao = 'CPF repetido na planilha';
        else if (estadoMotoristas.cpfsFrota.has(cpf)) situacao = 'Já cadastrado';
        if (cpfValidoBR(cpf)) vistos.add(cpf);
        itens.push({ linha: numeroLinha, nome, cpf, celular, celularOriginal: String(cols[iContato] || '').trim(), situacao });
    });
    return { itens, ignoradas, temTipo: iTipo >= 0 };
}

function renderizarPreviaImportacao(previa) {
    const resumo = document.getElementById('mot-imp-resumo');
    const box = document.getElementById('mot-imp-previa');
    const confirmar = document.getElementById('mot-imp-confirmar');
    document.getElementById('mot-imp-resultado').innerHTML = '';
    document.getElementById('mot-imp-progresso').hidden = true;

    if (previa.erro) {
        mostrarAlertaMot('mot-imp-alerta', previa.erro);
        resumo.innerHTML = '';
        box.innerHTML = '';
        confirmar.disabled = true;
        estadoMotoristas.importacao = [];
        return;
    }
    mostrarAlertaMot('mot-imp-alerta', '');
    estadoMotoristas.importacao = previa.itens;

    const conta = {};
    previa.itens.forEach(i => { conta[i.situacao] = (conta[i.situacao] || 0) + 1; });
    const ok = conta.OK || 0;
    const partes = Object.entries(conta).filter(([s]) => s !== 'OK').map(([s, n]) => `${n} ${escaparHtml(s.toLowerCase())}`);
    if (previa.temTipo) partes.push(`${previa.ignoradas} ignorada(s) (não é frota)`);
    resumo.innerHTML = `<strong>${ok}</strong> linha(s) prontas para importar${partes.length ? ` · ${partes.join(' · ')}` : ''}`;

    box.innerHTML = previa.itens.length === 0 ? '<div class="analises-vazio">Nenhuma linha de frota na planilha.</div>' : `
        <table class="tabela-fichas">
            <thead><tr><th>Linha</th><th>Motorista</th><th>CPF</th><th>Celular</th><th>Situação</th></tr></thead>
            <tbody>${previa.itens.map(i => `
                <tr>
                    <td>${i.linha}</td>
                    <td>${escaparHtml(i.nome) || '—'}</td>
                    <td class="mot-nowrap">${escaparHtml(formatarCpfCompleto(i.cpf)) || '—'}</td>
                    <td class="mot-nowrap">${escaparHtml(i.celular ? formatarCelularBR(i.celular) : i.celularOriginal) || '—'}</td>
                    <td><span class="status-pill ${i.situacao === 'OK' ? 'status-concluido' : i.situacao === 'Já cadastrado' ? 'mot-selo-inativo' : 'mot-selo-recusado'}">${escaparHtml(i.situacao)}</span></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    confirmar.disabled = ok === 0;
}

function atualizarProgressoImportacao(feitos, total) {
    const pct = total ? Math.round((feitos / total) * 100) : 0;
    document.getElementById('mot-imp-progresso').hidden = false;
    document.getElementById('mot-imp-progresso-preenchido').style.width = `${pct}%`;
    document.getElementById('mot-imp-progresso-texto').textContent = `${feitos} de ${total} (${pct}%)`;
}

async function confirmarImportacao() {
    const linhasOk = estadoMotoristas.importacao.filter(i => i.situacao === 'OK');
    if (linhasOk.length === 0) return;
    if (!confirm(`Importar ${linhasOk.length} motorista(s) da frota com a senha padrão (6 primeiros dígitos do CPF + @frota)?`)) return;

    const botao = document.getElementById('mot-imp-confirmar');
    const arquivo = document.getElementById('mot-imp-arquivo');
    botao.disabled = true;
    arquivo.disabled = true;
    const total = { criados: 0, pulados: [], erros: [] };
    atualizarProgressoImportacao(0, linhasOk.length);

    for (let i = 0; i < linhasOk.length; i += TAMANHO_LOTE_IMPORTACAO) {
        const lote = linhasOk.slice(i, i + TAMANHO_LOTE_IMPORTACAO);
        const r = await chamarGerenciarFrota({
            acao: 'importar',
            motoristas: lote.map(l => ({ linha: l.linha, nome: l.nome, cpf: l.cpf, celular: l.celular }))
        });
        if (r.ok) {
            total.criados += r.dados.criados || 0;
            total.pulados.push(...(r.dados.pulados || []));
            total.erros.push(...(r.dados.erros || []));
        } else {
            const motivo = (r.dados && r.dados.erro) || 'Falha ao enviar este lote.';
            lote.forEach(l => total.erros.push({ linha: l.linha, cpf_final4: l.cpf.slice(-4), motivo }));
        }
        atualizarProgressoImportacao(Math.min(i + lote.length, linhasOk.length), linhasOk.length);
    }

    const item = (x) => `<li>Linha ${escaparHtml(x.linha)} · CPF final ${escaparHtml(x.cpf_final4)}: ${escaparHtml(x.motivo)}</li>`;
    document.getElementById('mot-imp-resultado').innerHTML = `
        <div class="mot-imp-resultado-box">
            <p><strong>${total.criados}</strong> criado(s) · <strong>${total.pulados.length}</strong> pulado(s) · <strong>${total.erros.length}</strong> com erro</p>
            ${total.pulados.length ? `<h4>Pulados</h4><ul>${total.pulados.map(item).join('')}</ul>` : ''}
            ${total.erros.length ? `<h4>Com erro</h4><ul>${total.erros.map(item).join('')}</ul>` : ''}
        </div>`;
    estadoMotoristas.importacao = [];
    document.getElementById('mot-imp-previa').innerHTML = '';
    document.getElementById('mot-imp-resumo').innerHTML = '';
    arquivo.disabled = false;
    arquivo.value = '';
    document.getElementById('mot-imp-nome-arquivo').textContent = 'Nenhum arquivo escolhido';
    exibirToast(`Importação concluída: ${total.criados} motorista(s) criado(s).`, total.erros.length ? 'info' : 'sucesso');
    await carregarAbaMotoristas();
}

function limparImportacao() {
    estadoMotoristas.importacao = [];
    const arquivo = document.getElementById('mot-imp-arquivo');
    if (arquivo) { arquivo.value = ''; arquivo.disabled = false; }
    document.getElementById('mot-imp-nome-arquivo').textContent = 'Nenhum arquivo escolhido';
    document.getElementById('mot-imp-resumo').innerHTML = '';
    document.getElementById('mot-imp-previa').innerHTML = '';
    document.getElementById('mot-imp-resultado').innerHTML = '';
    document.getElementById('mot-imp-progresso').hidden = true;
    document.getElementById('mot-imp-confirmar').disabled = true;
    mostrarAlertaMot('mot-imp-alerta', '');
}

// ---------------- Ligações ----------------

function inicializarAbaMotoristas() {
    if (estadoMotoristas.iniciado || !document.getElementById('view-cadastros')) return;
    estadoMotoristas.iniciado = true;

    // Abas internas Frota / Terceiros
    document.querySelectorAll('[data-mot-aba]').forEach(btn => {
        btn.addEventListener('click', () => {
            const aba = btn.getAttribute('data-mot-aba');
            document.querySelectorAll('[data-mot-aba]').forEach(b => {
                const ativa = b === btn;
                b.classList.toggle('active', ativa);
                b.setAttribute('aria-selected', ativa ? 'true' : 'false');
            });
            document.getElementById('mot-painel-frota').hidden = aba !== 'frota';
            document.getElementById('mot-painel-terceiros').hidden = aba !== 'terceiros';
        });
    });

    document.getElementById('mot-busca')?.addEventListener('input', renderizarFrota);
    document.getElementById('mot-filtro-situacao')?.addEventListener('change', renderizarFrota);
    document.getElementById('ter-busca')?.addEventListener('input', renderizarTerceiros);

    // Cards clicáveis aplicam o filtro de situação (clicar de novo limpa)
    const aplicarFiltroCard = (card) => {
        const select = document.getElementById('mot-filtro-situacao');
        if (!select) return;
        const filtro = card.getAttribute('data-mot-filtro');
        select.value = select.value === filtro ? '' : filtro;
        renderizarFrota();
    };
    const kpis = document.getElementById('mot-kpis');
    kpis?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-mot-filtro]');
        if (card) aplicarFiltroCard(card);
    });
    kpis?.addEventListener('keydown', (e) => {
        const card = e.target.closest('[data-mot-filtro]');
        if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aplicarFiltroCard(card); }
    });

    document.getElementById('mot-tbody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mot-acao]');
        if (btn) executarAcaoMotorista(btn.getAttribute('data-mot-acao'), btn.getAttribute('data-id'));
    });

    document.getElementById('mot-btn-adicionar')?.addEventListener('click', () => {
        limparFormularioMotorista();
        abrirModalMotoristas('modal-mot-adicionar');
        setTimeout(() => document.getElementById('mot-add-nome')?.focus(), 100);
    });
    document.getElementById('mot-btn-importar')?.addEventListener('click', () => {
        limparImportacao();
        abrirModalMotoristas('modal-mot-importar');
    });

    // Fechar modais (botões, clique fora e Esc)
    ['modal-mot-adicionar', 'modal-mot-importar'].forEach(id => {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-mot-fechar]')) fecharModalMotoristas(modal);
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('#modal-mot-adicionar.active, #modal-mot-importar.active').forEach(fecharModalMotoristas);
    });

    // Formulário de adicionar
    const cpf = document.getElementById('mot-add-cpf');
    const senha = document.getElementById('mot-add-senha');
    cpf?.addEventListener('input', () => {
        cpf.value = mascaraCpfDigitando(cpf.value);
        preencherSenhaPadrao(false);
    });
    const celular = document.getElementById('mot-add-celular');
    celular?.addEventListener('input', () => { celular.value = mascaraCelularDigitando(celular.value); });
    senha?.addEventListener('input', () => {
        senhaInicialEditada = senha.value !== senhaPadraoFrota(cpf.value);
        avaliarSenhaInicial();
    });
    document.getElementById('mot-add-padrao')?.addEventListener('click', () => preencherSenhaPadrao(true));
    document.getElementById('mot-add-olho')?.addEventListener('click', (e) => {
        const mostrar = senha.type === 'password';
        senha.type = mostrar ? 'text' : 'password';
        e.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    });
    document.getElementById('mot-add-salvar')?.addEventListener('click', salvarMotoristaFrota);
    document.getElementById('mot-add-form')?.addEventListener('submit', (e) => { e.preventDefault(); salvarMotoristaFrota(); });
    document.getElementById('mot-add-outro')?.addEventListener('click', () => {
        limparFormularioMotorista();
        document.getElementById('mot-add-nome')?.focus();
    });

    // Importação
    document.getElementById('mot-imp-arquivo')?.addEventListener('change', (e) => {
        const arquivo = e.target.files && e.target.files[0];
        document.getElementById('mot-imp-nome-arquivo').textContent = arquivo ? arquivo.name : 'Nenhum arquivo escolhido';
        if (!arquivo) return;
        if (arquivo.size > 2 * 1024 * 1024) {
            renderizarPreviaImportacao({ erro: 'Arquivo muito grande (máximo 2 MB).' });
            return;
        }
        const leitor = new FileReader();
        leitor.onload = () => renderizarPreviaImportacao(montarPreviaImportacao(String(leitor.result || '')));
        leitor.onerror = () => renderizarPreviaImportacao({ erro: 'Não foi possível ler o arquivo.' });
        leitor.readAsText(arquivo, 'utf-8');
    });
    document.getElementById('mot-imp-confirmar')?.addEventListener('click', confirmarImportacao);
}
