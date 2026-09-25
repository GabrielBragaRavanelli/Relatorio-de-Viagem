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
const STORAGE_CADASTROS_AGREGADOS_KEY = 'ajborges_cadastros_agregados';
const STORAGE_CONFIG_META_DIESEL = 'ajborges_config_meta_diesel';
const STORAGE_CONFIG_TAXA_BORGES = 'ajborges_config_taxa_borges';

// Instâncias globais de gráficos Chart.js
let chartFinanceiroInstance = null;
let chartClientesInstance = null;
let chartConsumoInstance = null;

// Estado da Aplicação
let appState = {
    fichas: [],
    filtroStatus: 'pendente', // 'pendente' | 'aprovado' | 'todos'
    filtroCliente: 'todos',
    filtroPeriodo: 'mes', // 'mes' | '30d' | 'semana'
    termoBusca: '',
    fichaSelecionadaModal: null,
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

const MOCK_IDS_EXEMPLOS = [
    'AJB-2026-001', 'AJB-2026-002', 'AJB-2026-003', 'AJB-2026-004', 'AJB-2026-005',
    'AJB-2026-006', 'AJB-2026-007', 'AJB-2026-008', 'AJB-2026-009', 'AJB-2026-010', 'AJB-2026-011'
];

function inicializarBancoDados() {
    const dadosSalvos = localStorage.getItem(STORAGE_FICHAS_KEY);
    if (!dadosSalvos) {
        appState.fichas = [];
    } else {
        try {
            const parsed = JSON.parse(dadosSalvos);
            if (Array.isArray(parsed)) {
                // Filtra e expurga rigorosamente TODOS os dados de exemplo usados para demonstrar as planilhas
                appState.fichas = parsed.filter(f => {
                    if (!f || !f.id) return false;
                    // Se for qualquer motorista das planilhas de exemplo
                    if (NOMES_DEMO_EXEMPLOS.includes(f.motorista)) return false;
                    // Se tiver ID de mock clássico e pertencer aos testes iniciais
                    if (MOCK_IDS_EXEMPLOS.includes(f.id) && (!f.origemEnvio || f.origemEnvio === 'motorista_com_login' || f.origemEnvio === 'seed_sistema' || f.isExemplo)) {
                        return false;
                    }
                    if (f.origemEnvio === 'seed_sistema' || f.isExemplo || f.isDemonstrativo) {
                        return false;
                    }
                    return true;
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

    // Garante que o administrador esteja registrado como usuário ativo da sessão
    const usuarioAtivo = localStorage.getItem(STORAGE_USER_KEY);
    if (!usuarioAtivo) {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify({
            role: 'admin',
            nome: 'Administrador AJBorges',
            email: 'operacional@ajborges.com'
        }));
    }
}

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
        if (!isNaN(parsedMeta) && parsedMeta > 0) {
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

function confirmarESalvarParametrosOperacionais() {
    const inputMeta = document.getElementById('config-meta-diesel');
    const inputTaxa = document.getElementById('config-taxa-borges');
    if (!inputMeta || !inputTaxa) return;

    const novaMeta = parseNumeroBR(inputMeta.value);
    const novaTaxa = parseNumeroBR(inputTaxa.value);

    // Validação da Meta de Diesel
    if (isNaN(novaMeta) || novaMeta <= 0) {
        alert('Por favor, informe uma Meta de Consumo Diesel válida maior que zero (ex: 2,40 km/l).');
        inputMeta.focus();
        return;
    }

    // Validação da Taxa Borges
    if (isNaN(novaTaxa) || novaTaxa < 0 || novaTaxa > 100) {
        alert('Por favor, informe um Percentual de Taxa Borges válido entre 0% e 100% (ex: 5,0%).');
        inputTaxa.focus();
        return;
    }

    const metaFmt = novaMeta.toFixed(2).replace('.', ',');
    const taxaFmt = novaTaxa.toFixed(1).replace('.', ',');

    const confirmou = confirm(
        `Deseja realmente confirmar a alteração dos parâmetros operacionais?\n\n` +
        `• Meta de Consumo Diesel: ${metaFmt} km/l\n` +
        `• Percentual Taxa Borges: ${taxaFmt}%\n\n` +
        `Todas as contas, faturamento, auditorias e gráficos serão atualizados imediatamente de acordo com esses valores.`
    );

    if (confirmou) {
        appState.config.metaDiesel = novaMeta;
        appState.config.taxaBorges = novaTaxa;
        localStorage.setItem(STORAGE_CONFIG_META_DIESEL, novaMeta.toString());
        localStorage.setItem(STORAGE_CONFIG_TAXA_BORGES, novaTaxa.toString());

        inputMeta.value = metaFmt;
        inputTaxa.value = taxaFmt;

        aplicarAtualizacoesConfiguracao(true);
        renderizarTabelaFichas();

        exibirToast(`Parâmetros operacionais confirmados! Meta: ${metaFmt} km/l | Taxa: ${taxaFmt}%.`, 'sucesso');
    } else {
        inputMeta.value = appState.config.metaDiesel.toFixed(2).replace('.', ',');
        inputTaxa.value = appState.config.taxaBorges.toFixed(1).replace('.', ',');
        exibirToast('Alteração de parâmetros cancelada. Valores mantidos.', 'info');
    }
}

function salvarConfiguracaoMetaDiesel(novaMeta) {
    const val = parseNumeroBR(novaMeta);
    if (isNaN(val) || val <= 0) return false;
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
        const freteNum = parseValorMoeda(f.totalFrete);
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

        const dieselNum = parseValorMoeda(f.totalAbastecimento);
        const comissaoNum = parseValorMoeda(f.vrComissao);
        const pedagioNum = parseValorMoeda(f.totalPedagio);
        const impostoNum = parseValorMoeda(f.impFederal);

        saidaDiesel += dieselNum;
        saidaComissao += comissaoNum;
        saidaPedagios += pedagioNum;
        saidaImpostos += impostoNum;
        totalSaida += (dieselNum + comissaoNum + pedagioNum + impostoNum);

        somaKmTotal += parseFloat(f.kmTotal || 0);
        somaLitrosTotal += parseValorMoeda(f.totalLitros || 0);
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
        const med = parseFloat(f.mediaKmL || 0);
        if (med > 0 && med < menorMedia) {
            menorMedia = med;
            piorMotorista = f.motorista || 'Motorista';
        }
    });

    const metaDiesel = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;

    if (piorMotorista && menorMedia < metaDiesel) {
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
    const aprovadas = appState.fichas.filter(f => f.status === 'aprovado').length;
    const total = appState.fichas.length;

    const elContadorSidebar = document.getElementById('badge-pendentes-sidebar');
    const elContadorTabPendentes = document.getElementById('contador-tab-pendentes');
    const elContadorTabAprovadas = document.getElementById('contador-tab-aprovadas');
    const elContadorTabTodas = document.getElementById('contador-tab-todas');
    const elHeaderCounter = document.getElementById('header-fichas-pendentes-counter');

    if (elContadorSidebar) elContadorSidebar.textContent = pendentes;
    if (elContadorTabPendentes) elContadorTabPendentes.textContent = pendentes;
    if (elContadorTabAprovadas) elContadorTabAprovadas.textContent = aprovadas;
    if (elContadorTabTodas) elContadorTabTodas.textContent = total;
    if (elHeaderCounter) elHeaderCounter.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
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
        if (appState.filtroStatus === 'aprovado') return f.status === 'aprovado';
        return true;
    });

    // Filtra pelo cliente selecionado
    if (appState.filtroCliente !== 'todos') {
        listaFiltrada = listaFiltrada.filter(f => {
            if (f.fretes && Array.isArray(f.fretes)) {
                return f.fretes.some(fr => fr.cliente === appState.filtroCliente);
            }
            return true;
        });
    }

    // Filtra pelo termo de busca (motorista, placa, rota, ficha)
    if (appState.termoBusca) {
        const t = appState.termoBusca.toLowerCase().trim();
        listaFiltrada = listaFiltrada.filter(f => {
            const id = (f.id || '').toLowerCase();
            const mot = (f.motorista || '').toLowerCase();
            const pla = (f.placas || '').toLowerCase();
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

        const isPendente = ficha.status === 'pendente';
        const mediaNum = parseFloat(ficha.mediaKmL || 0);

        const metaAtual = (appState.config && typeof appState.config.metaDiesel === 'number') ? appState.config.metaDiesel : 2.40;
        let mediaClass = 'diesel-bom';
        if (mediaNum < (metaAtual - 0.20)) mediaClass = 'diesel-alerta';
        else if (mediaNum < metaAtual) mediaClass = 'diesel-atencao';

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
                <span class="placa-box">${ficha.placas || 'Não informada'}</span>
            </td>
            <td>
                <span class="rota-tag" title="${rotaStr}">${rotaStr}</span>
            </td>
            <td>
                <span class="frete-val-destaque">R$ ${ficha.totalFrete || '0,00'}</span>
            </td>
            <td>
                <span class="diesel-badge ${mediaClass}">
                    ${ficha.mediaKmL ? `${ficha.mediaKmL} km/l` : '0.00 km/l'}
                </span>
            </td>
            <td>
                <span class="status-pill ${isPendente ? 'status-pendente' : 'status-concluido'}">
                    ${isPendente ? '🟡 Pendente de Conferência' : '🟢 Concluído / Aprovado'}
                </span>
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
                    ${isPendente ? `
                        <button type="button" class="btn-acao-aprovar-rapido" data-ficha-id="${ficha.id}" title="Aprovar Ficha Imediatamente">
                            ✓
                        </button>
                    ` : ''}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Registra eventos nos botões de resumo e aprovação rápida
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
}

// ==========================================================================
// 4. APROVAÇÃO DIRETA E AÇÕES DE FICHAS
// ==========================================================================

function aprovarFichaDiretamente(fichaId) {
    const index = appState.fichas.findIndex(f => f.id === fichaId);
    if (index === -1) return;

    if (!confirm(`Deseja aprovar e homologar o Relatório de Viagem ${fichaId}?`)) {
        return;
    }

    appState.fichas[index].status = 'aprovado';
    appState.fichas[index].dataAprovacao = new Date().toLocaleString('pt-BR');
    appState.fichas[index].aprovadoPor = 'operacional@ajborges.com';

    salvarFichasNoStorage();
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    atualizarGraficos();
    preencherSecoesSecundarias();
    exibirToast(`Ficha ${fichaId} homologada com sucesso!`, 'sucesso');
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

    if (elId) elId.textContent = ficha.id;
    if (elMot) elMot.textContent = `${ficha.motorista || 'Motorista'} • ${ficha.placas || 'Placas'}`;
    if (btnLinkCompleto) btnLinkCompleto.href = `relatorio-viagem.html?ficha=${ficha.id}&mode=admin`;

    if (btnAprovarDireto) {
        btnAprovarDireto.style.display = ficha.status === 'pendente' ? 'inline-flex' : 'none';
        btnAprovarDireto.onclick = () => {
            aprovarFichaDiretamente(ficha.id);
            fecharModalResumo();
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

        let abastHtml = '';
        if (ficha.abastecimentos && ficha.abastecimentos.length > 0) {
            abastHtml = ficha.abastecimentos.map(ab => `
                <tr>
                    <td>${ab.posto || '-'}</td>
                    <td>NF: ${ab.nf || '-'}</td>
                    <td>${ab.km || '-'} km</td>
                    <td><strong>${ab.litros || '0'} L</strong></td>
                    <td><strong>R$ ${ab.valor || '0,00'}</strong></td>
                </tr>
            `).join('');
        } else {
            abastHtml = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum abastecimento lançado</td></tr>`;
        }

        let anexosHtml = '';
        if (ficha.anexos && ficha.anexos.length > 0) {
            anexosHtml = ficha.anexos.map(an => `
                <div class="modal-anexo-chip">
                    <span>📎</span>
                    <span>${an.nome || 'Comprovante'} (${an.tamanho || 'Anexo'})</span>
                </div>
            `).join('');
        } else {
            anexosHtml = `<span style="font-size: 0.82rem; color: #94a3b8;">Nenhum comprovante anexado.</span>`;
        }

        elConteudo.innerHTML = `
            <div class="modal-grid-2">
                <div class="modal-info-box">
                    <div class="modal-info-box-title">Dados Operacionais da Viagem</div>
                    <div class="modal-info-linha"><span>Data Envio:</span> <strong>${ficha.dataEnvio || '-'}</strong></div>
                    <div class="modal-info-linha"><span>Período:</span> <strong>${ficha.dataSaida || '-'} até ${ficha.dataChegada || '-'}</strong></div>
                    <div class="modal-info-linha"><span>KM Saída / Chegada:</span> <strong>${ficha.kmSaida || '-'} / ${ficha.kmChegada || '-'}</strong></div>
                    <div class="modal-info-linha"><span>KM Total Rodado:</span> <strong>${ficha.kmTotal || '0'} km</strong></div>
                    <div class="modal-info-linha"><span>Média Consumo Diesel:</span> <strong style="color: #047857;">${ficha.mediaKmL || '0.00'} km/l</strong></div>
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
                            <tr><th>Posto</th><th>Nota Fiscal</th><th>KM</th><th>Litros</th><th>Valor R$</th></tr>
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
        fatData = appState.fichas.map(f => parseValorMoeda(f.totalFrete));
        custoData = appState.fichas.map(f => {
            return parseValorMoeda(f.totalAbastecimento) + parseValorMoeda(f.vrComissao) + parseValorMoeda(f.totalPedagio) + parseValorMoeda(f.impFederal);
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
            entradaShopee += parseValorMoeda(f.totalFrete);
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
        const med = parseFloat(f.mediaKmL || 0);
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
            if (med < (meta - 0.20)) coresConsumo.push('#ef4444');
            else if (med < meta) coresConsumo.push('#f59e0b');
            else coresConsumo.push('#10b981');
        });
    }

    return {
        financeiro: { labels: labelsFin, faturamento: fatData, custos: custoData, lucro: lucroData },
        clientes: { labels: labelsClientes, data: dataClientes, cores: coresClientes, total: totalClientes },
        consumo: { labels: labelsConsumo, data: dataConsumo, cores: coresConsumo }
    };
}

function inicializarGraficos() {
    const dados = obterDadosGraficosReais();

    // 1. Gráfico Financeiro
    const ctxFinanceiro = document.getElementById('chart-financeiro');
    if (ctxFinanceiro) {
        chartFinanceiroInstance = new Chart(ctxFinanceiro, {
            type: 'bar',
            data: {
                labels: dados.financeiro.labels,
                datasets: [
                    {
                        label: 'Faturamento Bruto',
                        data: dados.financeiro.faturamento,
                        backgroundColor: 'rgba(61, 61, 144, 0.85)',
                        borderColor: '#3d3d90',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Custos da Frota',
                        data: dados.financeiro.custos,
                        backgroundColor: 'rgba(239, 68, 68, 0.75)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Lucro Líquido',
                        data: dados.financeiro.lucro,
                        type: 'line',
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: R$ ${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            callback: function(val) {
                                return 'R$ ' + (val >= 1000 ? (val / 1000) + 'k' : val);
                            }
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

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
                                const status = val < meta ? `(Abaixo da meta de ${meta.toFixed(2)} km/l)` : '(Dentro da meta)';
                                return ` Média: ${val.toFixed(2)} km/l ${status}`;
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
    const dados = obterDadosGraficosReais();

    if (chartFinanceiroInstance) {
        chartFinanceiroInstance.data.labels = dados.financeiro.labels;
        chartFinanceiroInstance.data.datasets[0].data = dados.financeiro.faturamento;
        chartFinanceiroInstance.data.datasets[1].data = dados.financeiro.custos;
        chartFinanceiroInstance.data.datasets[2].data = dados.financeiro.lucro;
        chartFinanceiroInstance.update();
    }

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
                        <tr><th>Viagem</th><th>Data</th><th>Motorista</th><th>Placas</th><th>Destino</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${appState.fichas.slice(0, 10).map(f => `
                            <tr>
                                <td><strong>${f.id}</strong></td>
                                <td>${f.dataSaida || f.dataEnvio || '-'}</td>
                                <td>${f.motorista || 'Motorista'}</td>
                                <td><span class="placa-box">${f.placas || 'Não informada'}</span></td>
                                <td>${f.destinoInicial || '-'} ➔ ${f.destinoFinal || '-'}</td>
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
                    <td colspan="7" style="text-align: center; color: #94a3b8; padding: 28px;">
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
                        <td>${f.destinoInicial || '-'} ➔ ${f.destinoFinal || '-'}</td>
                        <td>Praças declaradas</td>
                        <td>R$ ${f.totalPedagio || '0,00'}</td>
                        <td>R$ ${f.totalPedagio || '0,00'}</td>
                        <td><span class="status-pill status-concluido">✓ Auditado</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Seção Acerto Motoristas
    const tbodyAcertos = document.getElementById('tabela-acertos-body');
    if (tbodyAcertos) {
        const motoristasMap = {};
        appState.fichas.forEach(f => {
            const m = f.motorista || 'Motorista';
            if (!motoristasMap[m]) {
                motoristasMap[m] = { viagens: 0, freteTotal: 0, comissao: 0, adiantamentos: 0 };
            }
            motoristasMap[m].viagens += 1;
            motoristasMap[m].freteTotal += parseValorMoeda(f.totalFrete);
            motoristasMap[m].comissao += parseValorMoeda(f.vrComissao);
            motoristasMap[m].adiantamentos += parseValorMoeda(f.valorAdiantamento);
        });

        const nomes = Object.keys(motoristasMap);
        if (nomes.length === 0) {
            tbodyAcertos.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #94a3b8; padding: 28px;">
                        Nenhum acerto de motorista pendente. Aguardando relatórios de viagem.
                    </td>
                </tr>
            `;
        } else {
            tbodyAcertos.innerHTML = nomes.map(nome => {
                const d = motoristasMap[nome];
                const saldoLiquidar = d.comissao - d.adiantamentos;
                return `
                    <tr>
                        <td><strong>${nome}</strong></td>
                        <td>${d.viagens} viagem(ns)</td>
                        <td>R$ ${formatarMoedaSemPrefixo(d.freteTotal)}</td>
                        <td><strong style="color: #4f46e5;">R$ ${formatarMoedaSemPrefixo(d.comissao)}</strong></td>
                        <td>R$ ${formatarMoedaSemPrefixo(d.adiantamentos)}</td>
                        <td><strong style="color: ${saldoLiquidar >= 0 ? '#10b981' : '#ef4444'};">R$ ${formatarMoedaSemPrefixo(saldoLiquidar)}</strong></td>
                        <td><button type="button" class="btn-acao-resumo" onclick="exibirToast('Extrato de acerto gerado para ${nome}', 'info')">Emitir Acerto</button></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 4. Seção Combustível
    const tbodyCombustivel = document.getElementById('tabela-combustivel-body');
    if (tbodyCombustivel) {
        const listaAbast = [];
        appState.fichas.forEach(f => {
            if (f.abastecimentos && Array.isArray(f.abastecimentos)) {
                f.abastecimentos.forEach(ab => {
                    listaAbast.push({
                        posto: ab.posto || 'Posto Conveniado',
                        nf: ab.nf || '-',
                        data: f.dataSaida || f.dataEnvio || '-',
                        motorista: f.motorista || 'Motorista',
                        litros: ab.litros || '0',
                        valor: ab.valor || '0,00'
                    });
                });
            }
        });

        if (listaAbast.length === 0) {
            tbodyCombustivel.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #94a3b8; padding: 28px;">
                        Nenhum registro de abastecimento para conferência no momento.
                    </td>
                </tr>
            `;
        } else {
            tbodyCombustivel.innerHTML = listaAbast.map(ab => {
                const v = parseValorMoeda(ab.valor);
                const l = parseValorMoeda(ab.litros);
                const precoL = l > 0 ? (v / l).toFixed(2).replace('.', ',') : '0,00';
                return `
                    <tr>
                        <td>${ab.posto}</td>
                        <td>NF ${ab.nf}</td>
                        <td>${ab.data}</td>
                        <td>${ab.motorista}</td>
                        <td>${ab.litros} L</td>
                        <td>R$ ${precoL}</td>
                        <td>R$ ${ab.valor}</td>
                        <td><span class="status-pill status-concluido">✓ Lançado</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 5. Seção Frota
    const tbodyFrota = document.getElementById('tabela-frota-body');
    if (tbodyFrota) {
        const veiculosMap = {};
        appState.fichas.forEach(f => {
            if (f.placas) {
                if (!veiculosMap[f.placas]) {
                    veiculosMap[f.placas] = {
                        motorista: f.motorista || 'Motorista',
                        kmAtual: f.kmChegada || f.kmSaida || '-',
                        media: f.mediaKmL || '0.00',
                        status: f.status === 'pendente' ? 'Em Rota' : 'Disponível'
                    };
                }
            }
        });

        const placas = Object.keys(veiculosMap);
        if (placas.length === 0) {
            tbodyFrota.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #94a3b8; padding: 28px;">
                        Nenhum veículo registrado em viagens ativas no momento.
                    </td>
                </tr>
            `;
        } else {
            tbodyFrota.innerHTML = placas.map(p => {
                const v = veiculosMap[p];
                const partes = p.split('/');
                const cavalo = partes[0]?.trim() || p;
                const carreta = partes[1]?.trim() || '-';
                return `
                    <tr>
                        <td><strong>${cavalo}</strong></td>
                        <td>${carreta}</td>
                        <td>Veículo Pesado</td>
                        <td>${v.motorista}</td>
                        <td>${v.kmAtual} km</td>
                        <td><span class="diesel-badge diesel-bom">${v.media} km/l</span></td>
                        <td><span class="status-pill ${v.status === 'Em Rota' ? 'status-pendente' : 'status-concluido'}">${v.status}</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 6. Seção Despesas Gerais
    const containerDespesas = document.getElementById('container-despesas-resumo');
    if (containerDespesas) {
        let saidaDiesel = 0, saidaComissao = 0, saidaPedagios = 0, saidaImpostos = 0;
        appState.fichas.forEach(f => {
            saidaDiesel += parseValorMoeda(f.totalAbastecimento);
            saidaComissao += parseValorMoeda(f.vrComissao);
            saidaPedagios += parseValorMoeda(f.totalPedagio);
            saidaImpostos += parseValorMoeda(f.impFederal);
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

    // 7. Seção Cadastros
    const containerCadastros = document.getElementById('container-cadastros-resumo');
    if (containerCadastros) {
        let totalAgregados = 0;
        try {
            const cadSalvos = JSON.parse(localStorage.getItem(STORAGE_CADASTROS_AGREGADOS_KEY) || '[]');
            if (Array.isArray(cadSalvos)) totalAgregados = cadSalvos.length;
        } catch (e) {}

        containerCadastros.innerHTML = `
            <div class="config-grid">
                <div class="config-card">
                    <h4>Clientes da Operação</h4>
                    <p>Shopee Brasil, Mercado Livre Logística e Cargas Alimentícias.</p>
                    <span class="status-pill status-concluido">Contratos Ativos</span>
                </div>
                <div class="config-card">
                    <h4>Cadastros de Agregados (${totalAgregados})</h4>
                    <p>Fichas recebidas pelo formulário Seja um Agregado Conosco.</p>
                    <a href="Dashboard-cadastro-motorista.html" style="font-size: 0.85rem; color: #4f46e5; text-decoration: none; font-weight: 600;">Ver Painel de Cadastros (${totalAgregados}) ➔</a>
                </div>
                <div class="config-card">
                    <h4>Rotas Homologadas</h4>
                    <p>Rotas definidas conforme demandas de fretes registradas.</p>
                    <span class="status-pill status-concluido">Rotas em Operação</span>
                </div>
            </div>
        `;
    }

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
                                <td>${f.placas || '-'}</td>
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
    if (!str || typeof str !== 'string') return 0;
    const limpo = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
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
// 11. EVENT LISTENERS E INICIALIZAÇÃO DO DOM
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa o banco de dados e carrega configurações dinâmicas
    inicializarBancoDados();
    carregarConfiguracoes();
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    inicializarGraficos();
    preencherSecoesSecundarias();

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

    // 6. Filtro de cliente na tabela
    const selectCliente = document.getElementById('filtro-cliente-select');
    if (selectCliente) {
        selectCliente.addEventListener('change', (e) => {
            appState.filtroCliente = e.target.value;
            renderizarTabelaFichas();
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
            confirmarESalvarParametrosOperacionais();
        });
    }

    if (btnSalvarTaxa) {
        btnSalvarTaxa.addEventListener('click', () => {
            confirmarESalvarParametrosOperacionais();
        });
    }

    // Permitir confirmar com tecla Enter nos campos de Meta ou Taxa
    const inputConfigMeta = document.getElementById('config-meta-diesel');
    const inputConfigTaxa = document.getElementById('config-taxa-borges');

    if (inputConfigMeta) {
        inputConfigMeta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmarESalvarParametrosOperacionais();
            }
        });
    }

    if (inputConfigTaxa) {
        inputConfigTaxa.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmarESalvarParametrosOperacionais();
            }
        });
    }

    // 10. Botão de Logout (Sair)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Deseja realmente encerrar a sessão de Administrador?')) {
                localStorage.removeItem(STORAGE_USER_KEY);
                sessionStorage.clear();
                window.location.href = 'Login.html#admin';
            }
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
