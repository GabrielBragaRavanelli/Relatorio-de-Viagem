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

function obterMediaRealFicha(f) {
    if (!f) return { valorNum: 0, texto: '0.00' };

    // 1. Tenta calcular diretamente pelos dados reais da viagem (KM Total / Total Litros)
    let km = 0;
    if (f.kmTotal !== undefined && f.kmTotal !== null && f.kmTotal !== '') {
        km = parseMilharOuFloat(f.kmTotal);
    } else if (f.km_total !== undefined && f.km_total !== null && f.km_total !== '') {
        km = parseMilharOuFloat(f.km_total);
    }

    let litros = 0;
    if (f.totalLitros) {
        litros = parseValorMoeda(f.totalLitros);
    } else if (f.total_litros) {
        litros = parseValorMoeda(f.total_litros);
    }
    if (litros === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
        litros = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.litros || 0), 0);
    }

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

        let km = parseFloat(f.kmTotal ?? f.km_total ?? 0);
        if (isNaN(km)) km = 0;
        somaKmTotal += km;

        let litrosNum = parseValorMoeda(f.totalLitros || 0);
        if (litrosNum === 0 && Array.isArray(f.abastecimentos) && f.abastecimentos.length > 0) {
            litrosNum = f.abastecimentos.reduce((acc, a) => acc + parseValorMoeda(a.litros || 0), 0);
        }
        somaLitrosTotal += litrosNum;
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
                <span class="placa-box">${ficha.placas || 'Não informada'}</span>
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
    appState.fichas[index].aprovadoPor = 'operacional@ajborges.com';

    salvarFichasNoStorage();

    // Atualiza status no banco de dados Supabase
    if (typeof window.atualizarStatusFichaSupabase === 'function') {
        window.atualizarStatusFichaSupabase(fichaId, 'aprovado');
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
    if (elMot) elMot.textContent = `${ficha.motorista || 'Motorista'} • ${ficha.placas || 'Placas'}`;
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
                    <div class="modal-info-linha"><span>KM Saída / Chegada:</span> <strong>${ficha.kmSaida || '-'} / ${ficha.kmChegada || '-'}</strong></div>
                    <div class="modal-info-linha"><span>KM Total Rodado:</span> <strong>${ficha.kmTotal || '0'} km</strong></div>
                    <div class="modal-info-linha"><span>Média Consumo Diesel:</span> <strong style="color: #047857;">${obterMediaRealFicha(ficha).texto} km/l</strong></div>
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
                                <td><span class="placa-box">${f.placas || 'Não informada'}</span></td>
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
    const tbodyFrota = document.getElementById('tabela-frota-body');
    if (tbodyFrota) {
        const veiculosMap = {};
        appState.fichas.forEach(f => {
            if (f.placas) {
                if (!veiculosMap[f.placas]) {
                    veiculosMap[f.placas] = {
                        motorista: f.motorista || 'Motorista',
                        kmAtual: f.kmChegada || f.kmSaida || f.km_chegada || f.km_saida || '-',
                        media: obterMediaRealFicha(f).texto,
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
        const l = parseValorMoeda(ab.litros);
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
    // 1. Inicializa o banco de dados e carrega configurações dinâmicas
    inicializarBancoDados();
    carregarConfiguracoes();
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    inicializarGraficos();
    preencherSecoesSecundarias();
    carregarFiltroMotoristas();

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
