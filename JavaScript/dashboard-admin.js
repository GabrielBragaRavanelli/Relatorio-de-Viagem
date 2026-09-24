/**
 * ==========================================================================
 * AJBorges Transportes - Dashboard Administrativo
 * Gestão Operacional, Inteligência de Dados (BI) e Ciclo de Vida de Fichas
 * ==========================================================================
 */

const STORAGE_FICHAS_KEY = 'ajborges_fichas_viagem';
const STORAGE_USER_KEY = 'ajborges_usuario_ativo';

// Dados Iniciais Realistas de Exemplo (Seed Data da AJBorges)
const SEED_FICHAS = [
    {
        id: "AJB-2026-001",
        protocolo: "AJB-2026-001",
        dataEnvio: "23/09/2026 18:40",
        dataSaida: "20/09/2026",
        dataChegada: "23/09/2026",
        motoristaId: "MOT-102",
        motorista: "Marcos Antônio Silva",
        origemEnvio: "motorista_com_login",
        placas: "MHU-9157 / BRA-2E19",
        destinoInicial: "Marília - SP",
        destinoFinal: "São Paulo - SP",
        kmSaida: "1569440",
        kmChegada: "1573580",
        kmTotal: "4140",
        valorAdiantamento: "2.500,00",
        freteOrigem: "8.900,00",
        retorno1: "5.400,00",
        retorno2: "",
        retorno3: "",
        totalFrete: "14.300,00",
        vrComissao: "1.573,00",
        fretes: [
            { data: "20/09/2026", cliente: "mercado_livre", origem: "Marília/SP", destino: "Cajamar/SP", valor: "8.900,00", comissao: "400,00", descarga: "0,00" },
            { data: "22/09/2026", cliente: "shopee", origem: "São Paulo/SP", destino: "Bauru/SP", valor: "5.400,00", comissao: "594,00", descarga: "0,00" }
        ],
        abastecimentos: [
            { posto: "Posto Graal Marília", nf: "84920", km: "1569450", valor: "3.850,00", litros: "650,00" },
            { posto: "Posto Sakamoto Guarulhos", nf: "99214", km: "1571400", valor: "4.200,00", litros: "700,00" },
            { posto: "Posto Castelo Branco Bauru", nf: "10452", km: "1573200", valor: "3.480,00", litros: "580,00" }
        ],
        totalAbastecimento: "11.530,00",
        totalLitros: "1.930,00",
        mediaKmL: "2.15",
        pedagios: ["420,00", "380,00", "0,00"],
        totalPedagio: "800,00",
        impFederal: "450,00",
        outrasDespesas: [
            { desc: "Imposto Federal", valor: "450,00" },
            { desc: "Borracharia Pneu Dianteiro", valor: "180,00" }
        ],
        totalDespesas: "12.960,00",
        resultadoViagem: "1.340,00",
        saldoComissao: "-927,00",
        anexos: [
            { nome: "NF_Abastecimento_Graal_84920.pdf", tamanho: "412 KB", tipo: "pdf" },
            { nome: "Comprovante_Pedagio_SemParar.pdf", tamanho: "218 KB", tipo: "pdf" }
        ],
        status: "pendente",
        observacoesMotorista: "Pneu dianteiro reparado em trânsito com recibo anexo. Consumo afetado por congestionamento na serra."
    },
    {
        id: "AJB-2026-002",
        protocolo: "AJB-2026-002",
        dataEnvio: "24/09/2026 09:15",
        dataSaida: "21/09/2026",
        dataChegada: "24/09/2026",
        motoristaId: "MOT-104",
        motorista: "Carlos Eduardo Ferreira",
        origemEnvio: "motorista_com_login",
        placas: "GHR-4512 / QWE-9871",
        destinoInicial: "Curitiba - PR",
        destinoFinal: "Santos - SP",
        kmSaida: "890200",
        kmChegada: "893950",
        kmTotal: "3750",
        valorAdiantamento: "2.800,00",
        freteOrigem: "11.200,00",
        retorno1: "6.800,00",
        retorno2: "",
        retorno3: "",
        totalFrete: "18.000,00",
        vrComissao: "1.980,00",
        fretes: [
            { data: "21/09/2026", cliente: "alimenticio", origem: "Curitiba/PR", destino: "São Paulo/SP", valor: "11.200,00", comissao: "1.232,00", descarga: "150,00" },
            { data: "23/09/2026", cliente: "shopee", origem: "São Paulo/SP", destino: "Santos/SP", valor: "6.800,00", comissao: "748,00", descarga: "0,00" }
        ],
        abastecimentos: [
            { posto: "Posto Shell Registro", nf: "55120", km: "891400", valor: "4.500,00", litros: "750,00" },
            { posto: "Posto Ipiranga Cubatão", nf: "88145", km: "893200", valor: "4.650,00", litros: "780,00" }
        ],
        totalAbastecimento: "9.150,00",
        totalLitros: "1.530,00",
        mediaKmL: "2.45",
        pedagios: ["580,00", "420,00", "0,00"],
        totalPedagio: "1.000,00",
        impFederal: "520,00",
        outrasDespesas: [
            { desc: "Imposto Federal", valor: "520,00" },
            { desc: "Estacionamento Pátio Santos", valor: "120,00" }
        ],
        totalDespesas: "10.790,00",
        resultadoViagem: "7.210,00",
        saldoComissao: "-820,00",
        anexos: [
            { nome: "CTe_Alimenticio_Curitiba.pdf", tamanho: "520 KB", tipo: "pdf" },
            { nome: "NF_Combustivel_Registro.pdf", tamanho: "310 KB", tipo: "pdf" }
        ],
        status: "pendente",
        observacoesMotorista: "Viagem realizada sem intercorrências, aguardando liberação do adiantamento restante."
    },
    {
        id: "AJB-2026-003",
        protocolo: "AJB-2026-003",
        dataEnvio: "24/09/2026 10:50",
        dataSaida: "22/09/2026",
        dataChegada: "24/09/2026",
        motoristaId: "anonimo",
        motorista: "Jean Gomes de Oliveira",
        origemEnvio: "motorista_sem_login",
        placas: "JKL-7820 / MNO-3341",
        destinoInicial: "Campinas - SP",
        destinoFinal: "Belo Horizonte - MG",
        kmSaida: "1124500",
        kmChegada: "1127600",
        kmTotal: "3100",
        valorAdiantamento: "2.200,00",
        freteOrigem: "9.500,00",
        retorno1: "5.800,00",
        retorno2: "",
        retorno3: "",
        totalFrete: "15.300,00",
        vrComissao: "1.683,00",
        fretes: [
            { data: "22/09/2026", cliente: "mercado_livre", origem: "Campinas/SP", destino: "Extrema/MG", valor: "9.500,00", comissao: "400,00", descarga: "0,00" },
            { data: "23/09/2026", cliente: "shopee", origem: "Extrema/MG", destino: "Betim/MG", valor: "5.800,00", comissao: "638,00", descarga: "0,00" }
        ],
        abastecimentos: [
            { posto: "Posto Fernandão Pouso Alegre", nf: "77189", km: "1125600", valor: "4.100,00", litros: "680,00" },
            { posto: "Posto Gauchão Oliveira", nf: "33912", km: "1127100", valor: "4.020,00", litros: "670,00" }
        ],
        totalAbastecimento: "8.120,00",
        totalLitros: "1.350,00",
        mediaKmL: "2.30",
        pedagios: ["490,00", "390,00", "0,00"],
        totalPedagio: "880,00",
        impFederal: "480,00",
        outrasDespesas: [
            { desc: "Imposto Federal", valor: "480,00" }
        ],
        totalDespesas: "9.480,00",
        resultadoViagem: "5.820,00",
        saldoComissao: "-517,00",
        anexos: [
            { nome: "Cupom_Fiscal_Fernandao.jpg", tamanho: "1.2 MB", tipo: "img" }
        ],
        status: "pendente",
        observacoesMotorista: "Envio direto realizado pelo celular na chegada em Betim."
    },
    // Fichas já Aprovadas e Concluídas pela Gestão
    {
        id: "AJB-2026-004",
        protocolo: "AJB-2026-004",
        dataEnvio: "18/09/2026 14:10",
        dataSaida: "14/09/2026",
        dataChegada: "18/09/2026",
        motoristaId: "MOT-105",
        motorista: "Paulo Rogério Mendes",
        origemEnvio: "motorista_com_login",
        placas: "RTY-1122 / POI-3344",
        destinoInicial: "São Paulo - SP",
        destinoFinal: "Rio de Janeiro - RJ",
        kmSaida: "650100",
        kmChegada: "654120",
        kmTotal: "4020",
        valorAdiantamento: "2.400,00",
        freteOrigem: "9.200,00",
        retorno1: "6.100,00",
        totalFrete: "15.300,00",
        vrComissao: "1.683,00",
        totalAbastecimento: "9.450,00",
        totalLitros: "1.595,00",
        mediaKmL: "2.52",
        totalPedagio: "1.350,00",
        impFederal: "550,00",
        totalDespesas: "11.350,00",
        resultadoViagem: "3.950,00",
        saldoComissao: "-717,00",
        status: "aprovado",
        dataAprovacao: "19/09/2026 10:30",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-005",
        protocolo: "AJB-2026-005",
        dataEnvio: "17/09/2026 16:30",
        dataSaida: "13/09/2026",
        dataChegada: "17/09/2026",
        motoristaId: "MOT-106",
        motorista: "Ricardo Mendes Barreto",
        origemEnvio: "motorista_com_login",
        placas: "BNM-8899 / ZXC-5566",
        destinoInicial: "Bauru - SP",
        destinoFinal: "Uberlândia - MG",
        kmSaida: "920400",
        kmChegada: "924300",
        kmTotal: "3900",
        valorAdiantamento: "2.500,00",
        freteOrigem: "8.400,00",
        retorno1: "5.600,00",
        totalFrete: "14.000,00",
        vrComissao: "1.540,00",
        totalAbastecimento: "8.750,00",
        totalLitros: "1.511,00",
        mediaKmL: "2.58",
        totalPedagio: "1.100,00",
        impFederal: "500,00",
        totalDespesas: "10.350,00",
        resultadoViagem: "3.650,00",
        saldoComissao: "-960,00",
        status: "aprovado",
        dataAprovacao: "18/09/2026 09:15",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-006",
        protocolo: "AJB-2026-006",
        dataEnvio: "15/09/2026 11:20",
        dataSaida: "10/09/2026",
        dataChegada: "15/09/2026",
        motoristaId: "MOT-107",
        motorista: "Fernando Alves Lima",
        origemEnvio: "motorista_com_login",
        placas: "DFG-3456 / CVB-7890",
        destinoInicial: "Marília - SP",
        destinoFinal: "Goiânia - GO",
        kmSaida: "1340100",
        kmChegada: "1344600",
        kmTotal: "4500",
        valorAdiantamento: "2.800,00",
        freteOrigem: "10.500,00",
        retorno1: "6.200,00",
        totalFrete: "16.700,00",
        vrComissao: "1.837,00",
        totalAbastecimento: "9.900,00",
        totalLitros: "1.717,00",
        mediaKmL: "2.62",
        totalPedagio: "1.450,00",
        impFederal: "600,00",
        totalDespesas: "11.950,00",
        resultadoViagem: "4.750,00",
        saldoComissao: "-963,00",
        status: "aprovado",
        dataAprovacao: "16/09/2026 14:00",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-007",
        protocolo: "AJB-2026-007",
        dataEnvio: "12/09/2026 09:40",
        dataSaida: "08/09/2026",
        dataChegada: "12/09/2026",
        motoristaId: "MOT-102",
        motorista: "Marcos Antônio Silva",
        origemEnvio: "motorista_com_login",
        placas: "MHU-9157 / BRA-2E19",
        destinoInicial: "Marília - SP",
        destinoFinal: "São Paulo - SP",
        kmSaida: "1565200",
        kmChegada: "1569440",
        kmTotal: "4240",
        valorAdiantamento: "2.600,00",
        freteOrigem: "8.800,00",
        retorno1: "5.300,00",
        totalFrete: "14.100,00",
        vrComissao: "1.551,00",
        totalAbastecimento: "9.300,00",
        totalLitros: "1.820,00",
        mediaKmL: "2.33",
        totalPedagio: "1.250,00",
        impFederal: "510,00",
        totalDespesas: "11.060,00",
        resultadoViagem: "3.040,00",
        saldoComissao: "-1.049,00",
        status: "aprovado",
        dataAprovacao: "13/09/2026 11:00",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-008",
        protocolo: "AJB-2026-008",
        dataEnvio: "10/09/2026 17:15",
        dataSaida: "06/09/2026",
        dataChegada: "10/09/2026",
        motoristaId: "MOT-104",
        motorista: "Carlos Eduardo Ferreira",
        origemEnvio: "motorista_com_login",
        placas: "GHR-4512 / QWE-9871",
        destinoInicial: "Curitiba - PR",
        destinoFinal: "Santos - SP",
        kmSaida: "886400",
        kmChegada: "890200",
        kmTotal: "3800",
        valorAdiantamento: "2.700,00",
        freteOrigem: "10.800,00",
        retorno1: "6.400,00",
        totalFrete: "17.200,00",
        vrComissao: "1.892,00",
        totalAbastecimento: "9.100,00",
        totalLitros: "1.550,00",
        mediaKmL: "2.45",
        totalPedagio: "1.320,00",
        impFederal: "580,00",
        totalDespesas: "11.000,00",
        resultadoViagem: "6.200,00",
        saldoComissao: "-808,00",
        status: "aprovado",
        dataAprovacao: "11/09/2026 16:30",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-009",
        protocolo: "AJB-2026-009",
        dataEnvio: "07/09/2026 13:40",
        dataSaida: "03/09/2026",
        dataChegada: "07/09/2026",
        motoristaId: "MOT-108",
        motorista: "Valdemir Siqueira",
        origemEnvio: "motorista_com_login",
        placas: "KJU-9081 / PLM-2468",
        destinoInicial: "Campinas - SP",
        destinoFinal: "Porto Alegre - RS",
        kmSaida: "780100",
        kmChegada: "784900",
        kmTotal: "4800",
        valorAdiantamento: "3.000,00",
        freteOrigem: "12.000,00",
        retorno1: "7.100,00",
        totalFrete: "19.100,00",
        vrComissao: "2.101,00",
        totalAbastecimento: "10.400,00",
        totalLitros: "1.980,00",
        mediaKmL: "2.42",
        totalPedagio: "1.650,00",
        impFederal: "680,00",
        totalDespesas: "12.730,00",
        resultadoViagem: "6.370,00",
        saldoComissao: "-899,00",
        status: "aprovado",
        dataAprovacao: "08/09/2026 10:00",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-010",
        protocolo: "AJB-2026-010",
        dataEnvio: "04/09/2026 15:50",
        dataSaida: "01/09/2026",
        dataChegada: "04/09/2026",
        motoristaId: "MOT-105",
        motorista: "Paulo Rogério Mendes",
        origemEnvio: "motorista_com_login",
        placas: "RTY-1122 / POI-3344",
        destinoInicial: "São Paulo - SP",
        destinoFinal: "Belo Horizonte - MG",
        kmSaida: "646200",
        kmChegada: "650100",
        kmTotal: "3900",
        valorAdiantamento: "2.400,00",
        freteOrigem: "8.500,00",
        retorno1: "5.200,00",
        totalFrete: "13.700,00",
        vrComissao: "1.507,00",
        totalAbastecimento: "8.600,00",
        totalLitros: "1.540,00",
        mediaKmL: "2.53",
        totalPedagio: "1.050,00",
        impFederal: "480,00",
        totalDespesas: "10.130,00",
        resultadoViagem: "3.570,00",
        saldoComissao: "-893,00",
        status: "aprovado",
        dataAprovacao: "05/09/2026 09:30",
        aprovadoPor: "operacional@ajborges.com"
    },
    {
        id: "AJB-2026-011",
        protocolo: "AJB-2026-011",
        dataEnvio: "02/09/2026 18:20",
        dataSaida: "29/08/2026",
        dataChegada: "02/09/2026",
        motoristaId: "MOT-106",
        motorista: "Ricardo Mendes Barreto",
        origemEnvio: "motorista_com_login",
        placas: "BNM-8899 / ZXC-5566",
        destinoInicial: "Bauru - SP",
        destinoFinal: "São José do Rio Preto - SP",
        kmSaida: "917100",
        kmChegada: "920400",
        kmTotal: "3300",
        valorAdiantamento: "2.100,00",
        freteOrigem: "7.900,00",
        retorno1: "4.600,00",
        totalFrete: "12.500,00",
        vrComissao: "1.375,00",
        totalAbastecimento: "7.400,00",
        totalLitros: "1.310,00",
        mediaKmL: "2.52",
        totalPedagio: "850,00",
        impFederal: "420,00",
        totalDespesas: "8.670,00",
        resultadoViagem: "3.830,00",
        saldoComissao: "-725,00",
        status: "aprovado",
        dataAprovacao: "03/09/2026 14:10",
        aprovadoPor: "operacional@ajborges.com"
    }
];

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
    fichaSelecionadaModal: null
};

// ==========================================================================
// INICIALIZAÇÃO DO BANCO DE DADOS LOCAL
// ==========================================================================

function inicializarBancoDados() {
    const dadosSalvos = localStorage.getItem(STORAGE_FICHAS_KEY);
    if (!dadosSalvos) {
        localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(SEED_FICHAS));
        appState.fichas = SEED_FICHAS;
    } else {
        try {
            appState.fichas = JSON.parse(dadosSalvos);
            if (!Array.isArray(appState.fichas) || appState.fichas.length === 0) {
                localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(SEED_FICHAS));
                appState.fichas = SEED_FICHAS;
            }
        } catch (e) {
            console.error('Erro ao ler banco de dados local:', e);
            localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(SEED_FICHAS));
            appState.fichas = SEED_FICHAS;
        }
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

// ==========================================================================
// CÁLCULOS E ATUALIZAÇÃO DOS KPIS FINANCEIROS
// ==========================================================================

function calcularMetricasDashboard() {
    // Fichas aprovadas compõem o faturamento oficial consolidado;
    // Fichas pendentes entram na previsão operacional
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

    // Iteração sobre todas as fichas para consolidar totais
    appState.fichas.forEach(f => {
        const freteNum = parseValorMoeda(f.totalFrete);
        totalEntrada += freteNum;

        // Distribuição estimada por cliente
        if (f.fretes && Array.isArray(f.fretes)) {
            f.fretes.forEach(item => {
                const v = parseValorMoeda(item.valor);
                if (item.cliente === 'shopee') entradaShopee += v;
                else if (item.cliente === 'mercado_livre') entradaML += v;
                else entradaAlimenticio += v;
            });
        } else {
            // Estimativa proporcional caso a ficha não tenha detalhes
            entradaShopee += freteNum * 0.408;
            entradaML += freteNum * 0.371;
            entradaAlimenticio += freteNum * 0.221;
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
    const mediaGeralFrota = somaLitrosTotal > 0 ? (somaKmTotal / somaLitrosTotal) : 2.38;

    // Atualiza elementos no DOM
    const elTotalEntrada = document.getElementById('kpi-total-entrada');
    const elEntradaShopee = document.getElementById('kpi-entrada-shopee');
    const elEntradaMl = document.getElementById('kpi-entrada-ml');
    const elEntradaAli = document.getElementById('kpi-entrada-ali');

    const elTotalSaida = document.getElementById('kpi-total-saida');
    const elSaidaDiesel = document.getElementById('kpi-saida-diesel');
    const elSaidaComissao = document.getElementById('kpi-saida-comissao');
    const elSaidaPedagio = document.getElementById('kpi-saida-pedagio');
    const elSaidaImpostos = document.getElementById('kpi-saida-impostos');

    const elResultadoLiquido = document.getElementById('kpi-resultado-liquido');
    const elMargemLucro = document.getElementById('kpi-margem-lucro');
    const elMediaConsumo = document.getElementById('kpi-media-consumo-geral');

    if (elTotalEntrada) elTotalEntrada.textContent = formatarMoeda(totalEntrada);
    if (elEntradaShopee) elEntradaShopee.textContent = formatarMoeda(entradaShopee);
    if (elEntradaMl) elEntradaMl.textContent = formatarMoeda(entradaML);
    if (elEntradaAli) elEntradaAli.textContent = formatarMoeda(entradaAlimenticio);

    if (elTotalSaida) elTotalSaida.textContent = formatarMoeda(totalSaida);
    if (elSaidaDiesel) elSaidaDiesel.textContent = formatarMoeda(saidaDiesel);
    if (elSaidaComissao) elSaidaComissao.textContent = formatarMoeda(saidaComissao);
    if (elSaidaPedagio) elSaidaPedagio.textContent = formatarMoeda(saidaPedagios);
    if (elSaidaImpostos) elSaidaImpostos.textContent = formatarMoeda(saidaImpostos);

    if (elResultadoLiquido) elResultadoLiquido.textContent = formatarMoeda(resultadoLiquido);
    if (elMargemLucro) elMargemLucro.textContent = `${margemLiquida.toFixed(1)}%`;
    if (elMediaConsumo) elMediaConsumo.textContent = `${mediaGeralFrota.toFixed(2)} km/l`;

    // Atualiza contadores
    atualizarContadoresStatus();
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

// ==========================================================================
// RENDERIZAÇÃO DA TABELA DO PORTAL DO MOTORISTA
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
        const tipoTexto = appState.filtroStatus === 'pendente' ? 'pendente(s)' : 
                          appState.filtroStatus === 'aprovado' ? 'aprovada(s)' : 'registrada(s)';
        elInfoRegistros.textContent = `Exibindo ${listaFiltrada.length} ficha(s) ${tipoTexto}`;
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

        let mediaClass = 'diesel-bom';
        if (mediaNum < 2.20) mediaClass = 'diesel-alerta';
        else if (mediaNum < 2.40) mediaClass = 'diesel-atencao';

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
                <span class="td-data-envio">${ficha.dataEnvio || ficha.dataSaida || '24/09/2026'}</span>
            </td>
            <td>
                <div class="driver-cell">
                    <span class="driver-name">${ficha.motorista || 'Motorista Não Identificado'}</span>
                    ${origemEnvioBadge}
                </div>
            </td>
            <td>
                <span class="placa-box">${ficha.placas || 'MHU-9157'}</span>
            </td>
            <td>
                <span class="rota-tag" title="${rotaStr}">${rotaStr}</span>
            </td>
            <td>
                <span class="frete-val-destaque">R$ ${ficha.totalFrete || '0,00'}</span>
            </td>
            <td>
                <span class="diesel-badge ${mediaClass}">
                    ${ficha.mediaKmL ? `${ficha.mediaKmL} km/l` : '2.38 km/l'}
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
// APROVAÇÃO DIRETA E AÇÕES DE FICHAS
// ==========================================================================

function aprovarFichaDiretamente(fichaId) {
    const index = appState.fichas.findIndex(f => f.id === fichaId);
    if (index === -1) return;

    if (!confirm(`Deseja aprovar e concluir o Relatório de Viagem ${fichaId}?`)) {
        return;
    }

    appState.fichas[index].status = 'aprovado';
    appState.fichas[index].dataAprovacao = new Date().toLocaleString('pt-BR');
    appState.fichas[index].aprovadoPor = 'operacional@ajborges.com';

    salvarFichasNoStorage();
    calcularMetricasDashboard();
    renderizarTabelaFichas();
    atualizarGraficos();
    exibirToast(`Ficha ${fichaId} aprovada e concluída com sucesso!`, 'sucesso');
}

// ==========================================================================
// MODAL DE RESUMO RÁPIDO DA FICHA
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

    // Monta o corpo detalhado de conferência
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
                    <div class="modal-info-linha"><span>KM Total Rodado:</span> <strong>${ficha.kmTotal || '-'} km</strong></div>
                    <div class="modal-info-linha"><span>Média Consumo Diesel:</span> <strong style="color: #047857;">${ficha.mediaKmL || '2.38'} km/l</strong></div>
                </div>
                <div class="modal-info-box">
                    <div class="modal-info-box-title">Fechamento Financeiro</div>
                    <div class="modal-info-linha"><span>Total Frete Bruto:</span> <strong style="color: #047857;">R$ ${ficha.totalFrete || '0,00'}</strong></div>
                    <div class="modal-info-linha"><span>Total Diesel:</span> <strong>R$ ${ficha.totalAbastecimento || '0,00'}</strong></div>
                    <div class="modal-info-linha"><span>Pedágios + Imposto:</span> <strong>R$ ${parseValorMoeda(ficha.totalPedagio) + parseValorMoeda(ficha.impFederal)}</strong></div>
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
// GRÁFICOS DE BI (CHART.JS)
// ==========================================================================

function inicializarGraficos() {
    // 1. Gráfico Financeiro: Faturamento vs Custos vs Lucro
    const ctxFinanceiro = document.getElementById('chart-financeiro');
    if (ctxFinanceiro) {
        chartFinanceiroInstance = new Chart(ctxFinanceiro, {
            type: 'bar',
            data: {
                labels: ['Maio/26', 'Junho/26', 'Julho/26', 'Agosto/26', 'Setembro/26 (Atual)'],
                datasets: [
                    {
                        label: 'Faturamento Bruto',
                        data: [118000, 126500, 134000, 138900, 142500],
                        backgroundColor: 'rgba(61, 61, 144, 0.85)',
                        borderColor: '#3d3d90',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Custos da Frota',
                        data: [74200, 78900, 83100, 85600, 88420],
                        backgroundColor: 'rgba(239, 68, 68, 0.75)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Lucro Líquido',
                        data: [43800, 47600, 50900, 53300, 54080],
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
                                return `${context.dataset.label}: R$ ${context.parsed.y.toLocaleString('pt-BR')},00`;
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
                                return 'R$ ' + (val / 1000) + 'k';
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

    // 2. Gráfico Donut: Rendimento por Cliente
    const ctxClientes = document.getElementById('chart-clientes');
    if (ctxClientes) {
        chartClientesInstance = new Chart(ctxClientes, {
            type: 'doughnut',
            data: {
                labels: ['Shopee (40.8%)', 'Mercado Livre (37.1%)', 'Alimentício (22.1%)'],
                datasets: [{
                    data: [58200, 52800, 31500],
                    backgroundColor: [
                        '#f97316', // Laranja Shopee
                        '#eab308', // Amarelo Mercado Livre
                        '#3d3d90'  // Azul AJBorges Alimentício
                    ],
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
                                return ` ${context.label}: R$ ${context.parsed.toLocaleString('pt-BR')},00`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Gráfico Horizontal: Consumo de Diesel por Motorista (km/l)
    const ctxConsumo = document.getElementById('chart-consumo-motoristas');
    if (ctxConsumo) {
        chartConsumoInstance = new Chart(ctxConsumo, {
            type: 'bar',
            data: {
                labels: [
                    'Marcos Silva (Alerta de Consumo)',
                    'Jean Gomes',
                    'Valdemir Siqueira',
                    'Carlos Eduardo',
                    'Paulo Rogério',
                    'Ricardo Mendes',
                    'Fernando Alves'
                ],
                datasets: [{
                    label: 'Média de Consumo (km/l)',
                    data: [2.15, 2.30, 2.42, 2.45, 2.52, 2.58, 2.62],
                    backgroundColor: [
                        '#ef4444', // Vermelho (Alerta: mais gasta diesel)
                        '#f59e0b', // Amarelo
                        '#10b981', // Verde
                        '#10b981',
                        '#10b981',
                        '#10b981',
                        '#059669'  // Verde escuro destaque
                    ],
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
                                const status = val < 2.40 ? '(Abaixo da meta de 2.40 km/l)' : '(Dentro da meta)';
                                return ` Média: ${val.toFixed(2)} km/l ${status}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 1.8,
                        max: 3.0,
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
    if (chartFinanceiroInstance) chartFinanceiroInstance.update();
    if (chartClientesInstance) chartClientesInstance.update();
    if (chartConsumoInstance) chartConsumoInstance.update();
}

// ==========================================================================
// RENDERIZAÇÃO DAS SEÇÕES SECUNDÁRIAS (SUB-VISÕES DO MENU)
// ==========================================================================

function preencherSecoesSecundarias() {
    // 1. Seção Viagens Resumo
    const containerViagens = document.getElementById('container-viagens-resumo');
    if (containerViagens) {
        containerViagens.innerHTML = `
            <table class="tabela-fichas">
                <thead>
                    <tr><th>Viagem</th><th>Data</th><th>Motorista</th><th>Placas</th><th>Destino</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${appState.fichas.slice(0, 6).map(f => `
                        <tr>
                            <td><strong>${f.id}</strong></td>
                            <td>${f.dataSaida || '20/09/2026'}</td>
                            <td>${f.motorista}</td>
                            <td><span class="placa-box">${f.placas}</span></td>
                            <td>${f.destinoInicial} ➔ ${f.destinoFinal || 'SP'}</td>
                            <td><span class="status-pill ${f.status === 'pendente' ? 'status-pendente' : 'status-concluido'}">${f.status === 'pendente' ? 'Em Conferência' : 'Concluído'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // 2. Seção Pedágios
    const tbodyPedagios = document.getElementById('tabela-pedagios-body');
    if (tbodyPedagios) {
        tbodyPedagios.innerHTML = appState.fichas.map(f => {
            const valFicha = parseValorMoeda(f.totalPedagio || '800,00');
            const extratoTag = valFicha > 0 ? (valFicha - (Math.random() * 20)).toFixed(2).replace('.', ',') : '0,00';
            return `
                <tr>
                    <td><strong>${f.id}</strong></td>
                    <td>${f.motorista}</td>
                    <td>${f.destinoInicial} ➔ ${f.destinoFinal || 'SP'}</td>
                    <td>Praça 1, Praça 2, Retorno</td>
                    <td>R$ ${f.totalPedagio || '800,00'}</td>
                    <td>R$ ${extratoTag}</td>
                    <td><span class="status-pill status-concluido">✓ Conciliado</span></td>
                </tr>
            `;
        }).join('');
    }

    // 3. Seção Acerto Motoristas
    const tbodyAcertos = document.getElementById('tabela-acertos-body');
    if (tbodyAcertos) {
        // Agrupa por motorista
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

        tbodyAcertos.innerHTML = Object.keys(motoristasMap).map(nome => {
            const d = motoristasMap[nome];
            const saldoLiquidar = d.comissao - d.adiantamentos;
            return `
                <tr>
                    <td><strong>${nome}</strong></td>
                    <td>${d.viagens} viagens</td>
                    <td>R$ ${formatarMoedaSemPrefixo(d.freteTotal)}</td>
                    <td><strong style="color: #4f46e5;">R$ ${formatarMoedaSemPrefixo(d.comissao)}</strong></td>
                    <td>R$ ${formatarMoedaSemPrefixo(d.adiantamentos)}</td>
                    <td><strong style="color: ${saldoLiquidar >= 0 ? '#10b981' : '#ef4444'};">R$ ${formatarMoedaSemPrefixo(saldoLiquidar)}</strong></td>
                    <td><button type="button" class="btn-acao-resumo" onclick="exibirToast('Extrato de acerto gerado para ${nome}', 'info')">Emitir Acerto</button></td>
                </tr>
            `;
        }).join('');
    }

    // 4. Seção Combustível
    const tbodyCombustivel = document.getElementById('tabela-combustivel-body');
    if (tbodyCombustivel) {
        tbodyCombustivel.innerHTML = `
            <tr><td>Posto Graal Marília</td><td>NF 84920</td><td>20/09/2026</td><td>Marcos Silva</td><td>650 L</td><td>R$ 5,92</td><td>R$ 3.850,00</td><td><span class="status-pill status-concluido">✓ Aprovado</span></td></tr>
            <tr><td>Posto Sakamoto Guarulhos</td><td>NF 99214</td><td>21/09/2026</td><td>Marcos Silva</td><td>700 L</td><td>R$ 6,00</td><td>R$ 4.200,00</td><td><span class="status-pill status-concluido">✓ Aprovado</span></td></tr>
            <tr><td>Posto Shell Registro</td><td>NF 55120</td><td>21/09/2026</td><td>Carlos Eduardo</td><td>750 L</td><td>R$ 6,00</td><td>R$ 4.500,00</td><td><span class="status-pill status-concluido">✓ Aprovado</span></td></tr>
            <tr><td>Posto Fernandão Pouso Alegre</td><td>NF 77189</td><td>22/09/2026</td><td>Jean Gomes</td><td>680 L</td><td>R$ 6,02</td><td>R$ 4.100,00</td><td><span class="status-pill status-concluido">✓ Aprovado</span></td></tr>
        `;
    }

    // 5. Seção Frota
    const tbodyFrota = document.getElementById('tabela-frota-body');
    if (tbodyFrota) {
        tbodyFrota.innerHTML = `
            <tr><td><strong>MHU-9157</strong></td><td>BRA-2E19</td><td>Scania R450 6x2</td><td>Marcos Silva</td><td>1.573.580 km</td><td><span class="diesel-badge diesel-alerta">2.15 km/l</span></td><td><span class="status-pill status-pendente">Em Rota</span></td></tr>
            <tr><td><strong>GHR-4512</strong></td><td>QWE-9871</td><td>Volvo FH 540 6x4</td><td>Carlos Eduardo</td><td>893.950 km</td><td><span class="diesel-badge diesel-bom">2.45 km/l</span></td><td><span class="status-pill status-concluido">Disponível</span></td></tr>
            <tr><td><strong>JKL-7820</strong></td><td>MNO-3341</td><td>DAF XF 480 6x2</td><td>Jean Gomes</td><td>1.127.600 km</td><td><span class="diesel-badge diesel-atencao">2.30 km/l</span></td><td><span class="status-pill status-pendente">Em Rota</span></td></tr>
            <tr><td><strong>RTY-1122</strong></td><td>POI-3344</td><td>Mercedes Actros 2651</td><td>Paulo Rogério</td><td>654.120 km</td><td><span class="diesel-badge diesel-bom">2.52 km/l</span></td><td><span class="status-pill status-concluido">Disponível</span></td></tr>
            <tr><td><strong>BNM-8899</strong></td><td>ZXC-5566</td><td>Scania R440 6x2</td><td>Ricardo Mendes</td><td>924.300 km</td><td><span class="diesel-badge diesel-bom">2.58 km/l</span></td><td><span class="status-pill status-concluido">Disponível</span></td></tr>
        `;
    }

    // 6. Seção Despesas Gerais
    const containerDespesas = document.getElementById('container-despesas-resumo');
    if (containerDespesas) {
        containerDespesas.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Diesel &amp; Postos</span>
                    <h3 class="kpi-value">R$ 49.380,00</h3>
                    <span class="kpi-meta-text">55.8% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Diárias e Comissões</span>
                    <h3 class="kpi-value">R$ 18.240,00</h3>
                    <span class="kpi-meta-text">20.6% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Pedágios em Rodovias</span>
                    <h3 class="kpi-value">R$ 12.150,00</h3>
                    <span class="kpi-meta-text">13.7% do custo total</span>
                </div>
                <div class="kpi-card card-saida">
                    <span class="kpi-label">Impostos &amp; Outras</span>
                    <h3 class="kpi-value">R$ 8.650,00</h3>
                    <span class="kpi-meta-text">9.8% do custo total</span>
                </div>
            </div>
        `;
    }

    // 7. Seção Cadastros
    const containerCadastros = document.getElementById('container-cadastros-resumo');
    if (containerCadastros) {
        containerCadastros.innerHTML = `
            <div class="config-grid">
                <div class="config-card">
                    <h4>Clientes Ativos (3)</h4>
                    <p>Shopee Brasil, Mercado Livre Logística e Cargas Alimentícias.</p>
                    <span class="status-pill status-concluido">Contratos Ativos</span>
                </div>
                <div class="config-card">
                    <h4>Motoristas na Frota (7)</h4>
                    <p>Cadastro com CNH, exame toxicológico e ficha multi-cadastro completa.</p>
                    <a href="FichaMultiCadastro.html" style="font-size: 0.82rem; color: #4f46e5; text-decoration: none; font-weight: 600;">+ Adicionar Motorista / PF / PJ</a>
                </div>
                <div class="config-card">
                    <h4>Rotas Principais (5)</h4>
                    <p>SP ➔ RJ, SP ➔ PR, SP ➔ MG, Interior SP ➔ Cajamar, Marília ➔ Santos.</p>
                    <span class="status-pill status-concluido">Rotas Homologadas</span>
                </div>
            </div>
        `;
    }

    // 8. Seção Planejamento
    const containerPlanejamento = document.getElementById('container-planejamento-resumo');
    if (containerPlanejamento) {
        containerPlanejamento.innerHTML = `
            <div class="modal-info-box" style="margin-bottom: 16px;">
                <h4 style="margin-bottom: 8px;">Escala da Próxima Semana (28/09 a 04/10)</h4>
                <p style="font-size: 0.85rem; color: #475569;">Planejamento de carregamentos programados nos centros de distribuição Cajamar (ML), Barueri (Shopee) e Granja Xereta (Marília).</p>
            </div>
            <table class="tabela-fichas">
                <thead><tr><th>Dia</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Veículo Alocado</th><th>Motorista</th></tr></thead>
                <tbody>
                    <tr><td>Segunda</td><td>Mercado Livre</td><td>Cajamar/SP</td><td>Curitiba/PR</td><td>Scania R450</td><td>Marcos Silva</td></tr>
                    <tr><td>Terça</td><td>Shopee</td><td>Barueri/SP</td><td>Belo Horizonte/MG</td><td>Volvo FH 540</td><td>Carlos Eduardo</td></tr>
                    <tr><td>Quarta</td><td>Alimentício</td><td>Marília/SP</td><td>Santos/SP</td><td>DAF XF 480</td><td>Jean Gomes</td></tr>
                </tbody>
            </table>
        `;
    }
}

// ==========================================================================
// CONTROLE DE NAVEGAÇÃO DE SEÇÕES (SIDEBAR TABS)
// ==========================================================================

function alternarSecao(viewId) {
    if (!viewId) return;

    // Atualiza links da sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        const targetView = link.getAttribute('data-view');
        link.classList.toggle('active', targetView === viewId);
    });

    // Se a aba for 'fichas', rola diretamente para o módulo de fichas no Dashboard
    // ou exibe a visão dedicada
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

    // Oculta todas e exibe a selecionada
    document.querySelectorAll('.admin-section').forEach(sec => {
        const id = sec.id.replace('view-', '');
        sec.classList.toggle('active', id === viewId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// TOAST DE NOTIFICAÇÃO DO DASHBOARD
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
// FUNÇÕES AUXILIARES DE FORMATAÇÃO E MOEDA
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
// EVENT LISTENERS E INICIALIZAÇÃO DO DOM
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa o banco de dados e calcula métricas
    inicializarBancoDados();
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
            e.preventDefault();
            const view = link.getAttribute('data-view');
            alternarSecao(view);
            history.replaceState(null, '', `#${view}`);

            // Fecha menu no mobile se aberto
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar && sidebar.classList.contains('sidebar-aberta')) {
                sidebar.classList.remove('sidebar-aberta');
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

        // Atalho Ctrl+K ou Command+K para focar na busca
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
            exibirToast(`Filtro atualizado para: ${btn.textContent}`, 'info');
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
            exibirToast('Dados operacionais atualizados em tempo real.', 'sucesso');
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

    // 13. Botão de Restaurar Dados Demo nas Configurações
    const btnResetDemo = document.getElementById('btn-reset-demo-data');
    if (btnResetDemo) {
        btnResetDemo.addEventListener('click', () => {
            if (confirm('Restaurar o banco de dados demonstrativo da AJBorges com as 11 fichas iniciais?')) {
                localStorage.setItem(STORAGE_FICHAS_KEY, JSON.stringify(SEED_FICHAS));
                appState.fichas = SEED_FICHAS;
                calcularMetricasDashboard();
                renderizarTabelaFichas();
                atualizarGraficos();
                exibirToast('Dados restaurados com sucesso!', 'sucesso');
            }
        });
    }
});
