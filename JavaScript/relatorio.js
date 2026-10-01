// ==========================================
// AJBorges - Script do Relatório de Viagem
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do Formulário
    const form = document.getElementById('form-relatorio');
    const inputMotorista = document.getElementById('motorista');
    const inputPlacas = document.getElementById('placas');
    const inputDataSaida = document.getElementById('data-saida');
    const inputDataChegada = document.getElementById('data-chegada');
    const inputKmSaida = document.getElementById('km-saida');
    const inputKmChegada = document.getElementById('km-chegada');
    const inputKmTotal = document.getElementById('km-total');
    const inputDestinoInicial = document.getElementById('destino-inicial');
    const inputDestinoFinal = document.getElementById('destino-final');
    const inputAdiantamento = document.getElementById('valor-adiantamento');

    // Sub-bloco de Fretes
    const inputFreteOrigem = document.getElementById('frete-origem');
    const inputRetorno1 = document.getElementById('retorno-1');
    const inputRetorno2 = document.getElementById('retorno-2');
    const inputRetorno3 = document.getElementById('retorno-3');
    const inputTotalFrete = document.getElementById('total-frete');
    const inputVrComissao = document.getElementById('vr-comissao');

    // Elementos de Acionamento e Ficha do Formulário Unificado
    const btnIniciarRelatorio = document.getElementById('btn-iniciar-relatorio');
    const secaoFormularioUnificado = document.getElementById('secao-formulario-ml');
    const statusTextoIniciar = document.getElementById('status-texto-iniciar');
    const numeroFichaDisplay = document.getElementById('numero-ficha-display');
    const STORAGE_FICHA_KEY = 'ajborges_numero_ficha_relatorio';

    // Cards de Indicadores da Viagem
    const mlIndicadorMedia = document.getElementById('ml-indicador-media-combustivel');
    const mlCalcBaseKm = document.getElementById('ml-calc-base-km');
    const mlCalcBaseLitros = document.getElementById('ml-calc-base-litros');
    const mlIndicadorDespesa = document.getElementById('ml-indicador-despesa-total');
    const mlIndicadorResultado = document.getElementById('ml-indicador-resultado-viagem');
    const mlIndicadorSaldoComissao = document.getElementById('ml-indicador-saldo-comissao');

    // Toast
    const toast = document.getElementById('toast-notificacao');

    // ------------------------------------------
    // 0. Identificador Sequencial da Ficha (AJB-2026-XXX)
    // ------------------------------------------
    const STORAGE_CENTRAL_FICHAS = 'ajborges_fichas_viagem';
    const STORAGE_USER_ACTIVE = 'ajborges_usuario_ativo';

    // Limpeza de exemplo mockado no armazenamento e input
    try {
        const uAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        if (uAtivoStr) {
            const uAtivo = JSON.parse(uAtivoStr);
            if (uAtivo && uAtivo.nome === 'Carlos Eduardo Ferreira') {
                uAtivo.nome = '';
                localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(uAtivo));
            }
        }
    } catch (e) { }
    if (inputMotorista && inputMotorista.value === 'Carlos Eduardo Ferreira') {
        inputMotorista.value = '';
    }

    // Helper global para checagem de permissão de Gestão/Admin
    function verificarPermissaoAdmin() {
        const urlParams = new URLSearchParams(window.location.search);
        const modeUrl = urlParams.get('mode');
        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivo = null;
        if (usuarioAtivoStr) {
            try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
        }
        return (modeUrl === 'admin') || (usuarioAtivo && (usuarioAtivo.role === 'admin' || usuarioAtivo.role === 'diretoria') && modeUrl !== 'motorista');
    }

    function obterProximoNumeroFicha() {
        const dadosCentrais = localStorage.getItem(STORAGE_CENTRAL_FICHAS);
        let maxNum = 0;
        if (dadosCentrais) {
            try {
                const lista = JSON.parse(dadosCentrais);
                if (Array.isArray(lista)) {
                    lista.forEach(item => {
                        if (item.id && typeof item.id === 'string') {
                            const match = item.id.match(/\d+$/);
                            if (match) {
                                const val = parseInt(match[0], 10);
                                if (val > maxNum) maxNum = val;
                            }
                        }
                    });
                }
            } catch (e) { }
        }
        const salvoLocal = parseInt(localStorage.getItem(STORAGE_FICHA_KEY), 10);
        if (!isNaN(salvoLocal) && salvoLocal > maxNum) {
            maxNum = salvoLocal;
        }
        return maxNum > 0 ? (maxNum + 1) : 1;
    }

    function formatarNumeroFicha(num) {
        if (typeof num === 'string' && num.startsWith('AJB-')) return num;
        const n = parseInt(num, 10) || 1;
        return `AJB-2026-${String(n).padStart(3, '0')}`;
    }

    let fichaNumeroAtual = formatarNumeroFicha(obterProximoNumeroFicha());

    function atualizarDisplayNumeroFicha(idPersonalizado = null) {
        if (idPersonalizado) {
            fichaNumeroAtual = idPersonalizado;
        }
        if (numeroFichaDisplay) {
            numeroFichaDisplay.textContent = fichaNumeroAtual;
        }
    }

    atualizarDisplayNumeroFicha();

    // ------------------------------------------
    // 0.1. Acionamento do Card do Formulário Oficial
    // ------------------------------------------
    function toggleFormularioUnificado(abrir = null, rolagemSuave = true) {
        if (!secaoFormularioUnificado) return;
        const estaOculto = secaoFormularioUnificado.classList.contains('oculto');
        const deveAbrir = abrir !== null ? abrir : estaOculto;

        if (deveAbrir) {
            secaoFormularioUnificado.classList.remove('oculto');
            if (btnIniciarRelatorio) {
                btnIniciarRelatorio.classList.add('ativo');
                btnIniciarRelatorio.setAttribute('aria-expanded', 'true');
            }
            if (statusTextoIniciar) {
                statusTextoIniciar.textContent = 'Formulário Aberto';
            }
            if (rolagemSuave) {
                secaoFormularioUnificado.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            secaoFormularioUnificado.classList.add('oculto');
            if (btnIniciarRelatorio) {
                btnIniciarRelatorio.classList.remove('ativo');
                btnIniciarRelatorio.setAttribute('aria-expanded', 'false');
            }
            if (statusTextoIniciar) {
                statusTextoIniciar.textContent = 'Clique para Abrir';
            }
        }
    }

    if (btnIniciarRelatorio) {
        btnIniciarRelatorio.addEventListener('click', (e) => {
            e.preventDefault();
            toggleFormularioUnificado();
        });
    }

    // ------------------------------------------
    // 1. Formatação de Placas (Maiúsculas e Hífen)
    // ------------------------------------------
    if (inputPlacas && inputPlacas.tagName === 'INPUT') {
        inputPlacas.addEventListener('input', (e) => {
            let valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (valor.length > 3 && !valor.includes('-') && /^[A-Z]{3}[0-9]/.test(valor)) {
                // Formato padrão antigo AAA-9999 ou Mercosul AAA9A99
                if (/^[A-Z]{3}[0-9]{4}$/.test(valor)) {
                    valor = valor.substring(0, 3) + '-' + valor.substring(3);
                }
            }
            e.target.value = valor.substring(0, 8);
        });
    }

    // ------------------------------------------
    // 2. Bloqueio de Hífen / Negativos no KM
    // ------------------------------------------
    // ------------------------------------------
    // 2. Máscara de Milhar (Ponto) para KM e NF
    // ------------------------------------------
    function formatarMilhar(strOuNum) {
        if (strOuNum === null || strOuNum === undefined || strOuNum === '') return '';
        const digitos = strOuNum.toString().replace(/\D/g, '');
        if (!digitos) return '';
        return parseInt(digitos, 10).toLocaleString('pt-BR');
    }

    function parseMilhar(strOuNum) {
        if (!strOuNum) return 0;
        const digitos = strOuNum.toString().replace(/\D/g, '');
        if (!digitos) return 0;
        return parseInt(digitos, 10);
    }

    function aplicarMascaraMilhar(input, callback) {
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            // Proíbe hífen/menos (-), Expoente (e, E), mais (+) e teclas impróprias
            if (e.key === '-' || e.key === 'Minus' || e.code === 'NumpadSubtract' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                e.preventDefault();
            }
        });

        input.addEventListener('input', (e) => {
            const digitos = e.target.value.replace(/\D/g, '');
            if (!digitos) {
                e.target.value = '';
            } else {
                e.target.value = parseInt(digitos, 10).toLocaleString('pt-BR');
            }
            if (callback) callback();
        });

        input.addEventListener('paste', (e) => {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData) {
                e.preventDefault();
                const limpo = pasteData.replace(/\D/g, '');
                if (limpo) {
                    e.target.value = parseInt(limpo, 10).toLocaleString('pt-BR');
                } else {
                    e.target.value = '';
                }
                if (callback) callback();
            }
        });
    }

    // Aplica máscara de milhar aos campos de KM do cabeçalho
    aplicarMascaraMilhar(inputKmSaida, () => {
        calcularKmTotal();
        if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
    });
    aplicarMascaraMilhar(inputKmChegada, () => {
        calcularKmTotal();
        if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
    });

    // ------------------------------------------
    // 2.1. Máscara de Data Inteligente (DD/MM/AAAA) e Sincronização com Calendário
    // ------------------------------------------
    function normalizarDataExibicao(val) {
        if (!val) return '';
        const str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-');
            return `${d}/${m}/${y}`;
        }
        return str;
    }

    function aplicarMascaraDataComPicker(inputTexto, pickerNativo, btnCalendario, callback) {
        if (!inputTexto) return;

        function sincronizarComPickerNativo() {
            if (!pickerNativo) return;
            const val = inputTexto.value.trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                const [d, m, y] = val.split('/');
                pickerNativo.value = `${y}-${m}-${d}`;
            }
        }

        function abrirSeletorNativo() {
            if (!pickerNativo) return;
            if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.classList.contains('campo-bloqueado-gestao') || inputTexto.closest('.campo-bloqueado-gestao')) {
                return;
            }
            sincronizarComPickerNativo();
            if (typeof pickerNativo.showPicker === 'function') {
                try {
                    pickerNativo.showPicker();
                } catch (err) {
                    pickerNativo.click();
                }
            } else {
                pickerNativo.click();
            }
        }

        if (pickerNativo) {
            pickerNativo.addEventListener('change', () => {
                if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.closest('.campo-bloqueado-gestao')) {
                    return;
                }
                if (pickerNativo.value) {
                    const partes = pickerNativo.value.split('-');
                    if (partes.length === 3) {
                        inputTexto.value = `${partes[2]}/${partes[1]}/${partes[0]}`;
                        inputTexto.dispatchEvent(new Event('input', { bubbles: true }));
                        if (callback) callback();
                    }
                }
            });
        }

        if (btnCalendario) {
            btnCalendario.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.closest('.campo-bloqueado-gestao')) {
                    return;
                }
                abrirSeletorNativo();
            });
        }

        inputTexto.addEventListener('dblclick', (e) => {
            if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.closest('.campo-bloqueado-gestao')) {
                e.preventDefault();
                return;
            }
            abrirSeletorNativo();
        });

        inputTexto.addEventListener('keydown', (e) => {
            if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.closest('.campo-bloqueado-gestao')) {
                e.preventDefault();
                return;
            }
            if (e.ctrlKey || e.altKey || e.metaKey || [
                'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'
            ].includes(e.key)) {
                return;
            }

            if (e.key === 'Backspace') {
                const val = inputTexto.value;
                const selStart = inputTexto.selectionStart;
                const selEnd = inputTexto.selectionEnd;
                if (selStart === selEnd && (selStart === 3 || selStart === 6) && val[selStart - 1] === '/') {
                    e.preventDefault();
                    const novoVal = val.slice(0, selStart - 2) + val.slice(selStart);
                    inputTexto.value = novoVal;
                    inputTexto.setSelectionRange(selStart - 2, selStart - 2);
                    inputTexto.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                return;
            }

            if (e.key === '/') {
                return;
            }

            if (!/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });

        inputTexto.addEventListener('input', (e) => {
            let digitos = inputTexto.value.replace(/\D/g, '').slice(0, 8);
            let formatado = '';

            if (digitos.length > 0) {
                if (digitos.length < 2) {
                    formatado = digitos;
                } else if (digitos.length === 2) {
                    formatado = (e.inputType === 'deleteContentBackward') ? digitos : digitos + '/';
                } else if (digitos.length < 4) {
                    formatado = digitos.slice(0, 2) + '/' + digitos.slice(2);
                } else if (digitos.length === 4) {
                    formatado = digitos.slice(0, 2) + '/' + digitos.slice(2, 4);
                    if (e.inputType !== 'deleteContentBackward') {
                        formatado += '/';
                    }
                } else {
                    formatado = digitos.slice(0, 2) + '/' + digitos.slice(2, 4) + '/' + digitos.slice(4);
                }
            }

            inputTexto.value = formatado;

            if (pickerNativo && digitos.length === 8) {
                const d = digitos.slice(0, 2);
                const m = digitos.slice(2, 4);
                const y = digitos.slice(4, 8);
                pickerNativo.value = `${y}-${m}-${d}`;
            }

            if (callback) callback();
        });

        inputTexto.addEventListener('paste', (e) => {
            e.preventDefault();
            const texto = (e.clipboardData || window.clipboardData).getData('text') || '';
            const digitos = texto.replace(/\D/g, '').slice(0, 8);
            if (!digitos) return;

            let formatado = '';
            if (digitos.length <= 2) {
                formatado = digitos;
            } else if (digitos.length <= 4) {
                formatado = digitos.slice(0, 2) + '/' + digitos.slice(2);
            } else {
                formatado = digitos.slice(0, 2) + '/' + digitos.slice(2, 4) + '/' + digitos.slice(4);
            }
            inputTexto.value = formatado;

            if (pickerNativo && digitos.length === 8) {
                const d = digitos.slice(0, 2);
                const m = digitos.slice(2, 4);
                const y = digitos.slice(4, 8);
                pickerNativo.value = `${y}-${m}-${d}`;
            }

            inputTexto.dispatchEvent(new Event('input', { bubbles: true }));
            if (callback) callback();
        });
    }

    // Aplica máscara e sincronização com calendário às datas do cabeçalho
    const btnPickerDataSaida = inputDataSaida && inputDataSaida.parentElement ? inputDataSaida.parentElement.querySelector('.btn-picker-data') : null;
    const pickerNativoDataSaida = document.getElementById('data-saida-picker');
    aplicarMascaraDataComPicker(inputDataSaida, pickerNativoDataSaida, btnPickerDataSaida, () => {
        if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
    });

    const btnPickerDataChegada = inputDataChegada && inputDataChegada.parentElement ? inputDataChegada.parentElement.querySelector('.btn-picker-data') : null;
    const pickerNativoDataChegada = document.getElementById('data-chegada-picker');
    aplicarMascaraDataComPicker(inputDataChegada, pickerNativoDataChegada, btnPickerDataChegada, () => {
        if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
    });

    // ------------------------------------------
    // 3. Validação de Destino (Proíbe Números e Caracteres Especiais)
    // ------------------------------------------
    function aplicarValidacaoDestino(input) {
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || [
                'Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'
            ].includes(e.key)) {
                return;
            }

            if (/[0-9%$#@!&*()+=[\]{};:?^~|<>`\\\/_"]/.test(e.key) || /[^a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s\-]/.test(e.key)) {
                e.preventDefault();
            }
        });

        input.addEventListener('input', (e) => {
            const valorLimpo = e.target.value.replace(/[^A-Za-zÀ-ÿ\s\-]/g, '');
            if (e.target.value !== valorLimpo) {
                e.target.value = valorLimpo;
            }
        });

        input.addEventListener('paste', (e) => {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData && /[^A-Za-zÀ-ÿ\s\-]/.test(pasteData)) {
                e.preventDefault();
                const limpo = pasteData.replace(/[^A-Za-zÀ-ÿ\s\-]/g, '');
                document.execCommand('insertText', false, limpo);
            }
        });
    }

    aplicarValidacaoDestino(inputDestinoInicial);
    aplicarValidacaoDestino(inputDestinoFinal);

    // ------------------------------------------
    // 4. Cálculo Automático do KM Total
    // ------------------------------------------
    function calcularKmTotal() {
        if (!inputKmSaida || !inputKmChegada || !inputKmTotal) return;

        const valSaida = inputKmSaida.value.replace(/\D/g, '');
        const valChegada = inputKmChegada.value.replace(/\D/g, '');

        if (!valSaida || !valChegada) {
            inputKmTotal.value = '';
            return;
        }

        const kmSaida = parseInt(valSaida, 10);
        const kmChegada = parseInt(valChegada, 10);

        if (!isNaN(kmSaida) && !isNaN(kmChegada)) {
            if (kmChegada >= kmSaida) {
                const total = kmChegada - kmSaida;
                inputKmTotal.value = formatarMilhar(total);
            } else {
                inputKmTotal.value = '';
            }
        } else {
            inputKmTotal.value = '';
        }

        if (typeof calcularIndicadoresViagemMl === 'function') {
            calcularIndicadoresViagemMl();
        }
    }

    // ------------------------------------------
    // 5. Formatação e Cálculo Monetário (R$) e Litros
    // ------------------------------------------
    function parseMoeda(str) {
        if (!str) return 0;
        const apenasDigitos = str.toString().replace(/\D/g, '');
        if (!apenasDigitos) return 0;
        return parseFloat(apenasDigitos) / 100;
    }

    // Formato com prefixo R$ (usado em Cards de Indicadores)
    function formatarMoeda(valor) {
        if (isNaN(valor) || valor === null) return 'R$ 0,00';
        return 'R$ ' + formatarMoedaSemPrefixo(valor);
    }

    // Formato numérico puro '2.596,37' (usado nos inputs com span 'R$' externo para evitar sobreposição)
    function formatarMoedaSemPrefixo(valor) {
        if (isNaN(valor) || valor === null) return '0,00';
        return valor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function aplicarMascaraMoeda(input, callback) {
        if (!input) return;

        input.addEventListener('input', (e) => {
            let digitos = e.target.value.replace(/\D/g, '');
            if (!digitos) {
                e.target.value = '';
                if (callback) callback();
                return;
            }

            const valorNumerico = parseFloat(digitos) / 100;
            e.target.value = formatarMoedaSemPrefixo(valorNumerico);
            if (callback) callback();
        });

        input.addEventListener('blur', (e) => {
            if (e.target.value.trim() !== '') {
                const valorNumerico = parseMoeda(e.target.value);
                e.target.value = formatarMoedaSemPrefixo(valorNumerico);
                if (callback) callback();
            }
        });
    }

    function parseDecimal(str) {
        if (!str) return 0;
        const s = str.toString().trim().replace(/\./g, '').replace(',', '.');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function formatarDecimal(num, casas = 2) {
        if (isNaN(num) || num === null) return (0).toFixed(casas).replace('.', ',');
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        });
    }

    // Formatação de Litros: números inteiros (ex: 500 -> 500) ou decimais (ex: 1802.336 -> 1.802,336).
    function formatarLitros(num) {
        if (isNaN(num) || num === null || num === undefined || num === 0) return '0';
        if (Number.isInteger(num)) {
            return num.toLocaleString('pt-BR');
        }
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        });
    }

    function parseLitros(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        if (!s) return 0;

        // Se contém vírgula e ponto (ex: "1.802,336" ou "1,802.336")
        if (s.includes(',') && s.includes('.')) {
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            if (lastComma > lastDot) {
                // Padrão brasileiro: milhar com ponto, decimal com vírgula (ex: 1.802,336)
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // Padrão americano: milhar com vírgula, decimal com ponto (ex: 1,802.336)
                s = s.replace(/,/g, '');
            }
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        }

        // Se contém vírgula (ex: "1802,336" ou "500,5")
        if (s.includes(',')) {
            const partes = s.split(',');
            const intPart = partes[0].replace(/\D/g, '');
            const decPart = partes.slice(1).join('').replace(/\D/g, '');
            const n = parseFloat((intPart || '0') + '.' + decPart);
            return isNaN(n) ? 0 : n;
        }

        // Se contém múltiplos pontos (ex: "1.802.336") - comum se foi formatado como milhar
        const partesPonto = s.split('.');
        if (partesPonto.length > 2) {
            const digitos = s.replace(/\D/g, '');
            if (digitos.length >= 4) {
                // Últimos 3 dígitos são os mililitros/decimais (ex: 1802336 -> 1802.336)
                const intPart = digitos.substring(0, digitos.length - 3);
                const decPart = digitos.substring(digitos.length - 3);
                const n = parseFloat(intPart + '.' + decPart);
                return isNaN(n) ? 0 : n;
            } else {
                const n = parseFloat(digitos);
                return isNaN(n) ? 0 : n;
            }
        }

        // Se contém um único ponto (ex: "1802.336" ou "1.500" ou "500.5")
        if (partesPonto.length === 2) {
            const antes = partesPonto[0].replace(/\D/g, '');
            const depois = partesPonto[1].replace(/\D/g, '');
            // Se tem mais de 3 dígitos antes do ponto (ex: 1802.336), ou casas decimais != 3, é decimal
            if (antes.length >= 4 || depois.length !== 3) {
                const n = parseFloat((antes || '0') + '.' + depois);
                return isNaN(n) ? 0 : n;
            }
            // Se tem <= 3 dígitos antes e exatamente 3 depois (ex: "1.500")
            const n = parseFloat(antes + depois);
            return isNaN(n) ? 0 : n;
        }

        // Somente dígitos numéricos sem separador
        const digitos = s.replace(/\D/g, '');
        if (!digitos) return 0;
        const numInt = parseInt(digitos, 10);
        // Se o valor for muito grande sem separador (ex: 1802336 Litros), os últimos 3 dígitos são ml
        if (digitos.length >= 6 && numInt > 10000) {
            const intPart = digitos.substring(0, digitos.length - 3);
            const decPart = digitos.substring(digitos.length - 3);
            return parseFloat(intPart + '.' + decPart);
        }
        return numInt;
    }

    function formatarTextoLitros(val) {
        if (!val) return '';
        const num = parseLitros(val);
        if (num === 0) return '';
        return formatarLitros(num);
    }

    function aplicarMascaraLitros(input, callback) {
        if (!input) return;

        // Ao focar, desformata mantendo a precisão correta
        input.addEventListener('focus', (e) => {
            if (e.target.value) {
                if (e.target.value.includes(',')) {
                    const partes = e.target.value.split(',');
                    e.target.value = partes[0].replace(/\./g, '') + ',' + partes[1];
                } else if (e.target.value.includes('.')) {
                    const valNum = parseLitros(e.target.value);
                    if (Number.isInteger(valNum)) {
                        e.target.value = valNum.toString();
                    } else {
                        e.target.value = valNum.toString().replace('.', ',');
                    }
                }
            }
        });

        // Durante a digitação: aceita dígitos e converte ponto em vírgula para manter padrão decimal pt-BR
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9,\.]/g, '');
            const partes = val.split(/[,.]/);
            if (partes.length > 2) {
                val = partes[0] + ',' + partes.slice(1).join('').substring(0, 3);
            } else if (partes.length === 2) {
                val = partes[0] + ',' + partes[1].substring(0, 3);
            }
            e.target.value = val;
            if (callback) callback();
        });

        // Ao perder o foco (blur): formata com separador de milhar e decimais corretos
        input.addEventListener('blur', (e) => {
            if (e.target.value && e.target.value.trim() !== '') {
                e.target.value = formatarTextoLitros(e.target.value);
            }
            if (callback) callback();
        });
    }

    // Aplica máscara nos campos monetários de frete e adiantamento
    const camposMoedaTopo = [
        inputAdiantamento,
        inputFreteOrigem,
        inputRetorno1,
        inputRetorno2,
        inputRetorno3
    ];

    camposMoedaTopo.forEach(campo => {
        if (campo) {
            aplicarMascaraMoeda(campo, () => {
                if (typeof calcularIndicadoresViagemMl === 'function') {
                    calcularIndicadoresViagemMl();
                }
                if (typeof salvarProgressoMl === 'function') {
                    salvarProgressoMl();
                }
            });
        }
    });



    // ------------------------------------------
    // 6. Utilitários Gerais
    // ------------------------------------------

    function formatarTamanhoArquivo(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const tamanhos = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + tamanhos[i];
    }

    // ------------------------------------------
    // 10. Exibição de Toast / Notificações
    // ------------------------------------------
    function exibirToast(mensagem, tipo = 'sucesso') {
        if (!toast) return;

        const msgElem = toast.querySelector('.toast-mensagem');
        if (msgElem) msgElem.textContent = mensagem;

        toast.className = `toast toast-${tipo} toast-visivel`;

        setTimeout(() => {
            toast.className = 'toast';
        }, 3500);
    }



    // ==========================================
    // 7. MÓDULO OPERACIONAL: RELATÓRIO DE VIAGEM UNIFICADO
    // ==========================================
    const STORAGE_ML_KEY = 'ajborges_relatorio_viagem_ml_draft';

    // 15.1. Relação de Fretes ML (8 Linhas)
    const inputsValorFreteMl = [];
    const inputsComissaoFreteMl = [];
    const inputsDescargaFreteMl = [];
    const selectsClienteFreteMl = [];
    const inputTotalRelacaoFrete = document.getElementById('ml-total-relacao-frete');
    const inputTotalRelacaoComissao = document.getElementById('ml-total-relacao-comissao');
    const inputTotalRelacaoDescarga = document.getElementById('ml-total-relacao-descarga');

    function atualizarLinhaFreteMl(index, acaoDisparadaPorSelect = false) {
        const selectCli = document.querySelector(`select[name="cliente_frete_ml_${index}"]`);
        const inputValFrete = document.querySelector(`input[name="valor_frete_ml_${index}"]`);
        const inputComissao = document.querySelector(`input[name="comissao_frete_ml_${index}"]`);
        const inputDescarga = document.querySelector(`input[name="descarga_frete_ml_${index}"]`);

        if (!selectCli || !inputValFrete || !inputComissao) return;

        const tipoOperacao = selectCli.value;
        const isGestao = verificarPermissaoAdmin();

        // 1. VALOR FRETE: Trancado para o motorista (Definido pela Gestão)
        if (isGestao) {
            inputValFrete.removeAttribute('readonly');
            inputValFrete.removeAttribute('tabindex');
            inputValFrete.classList.remove('campo-bloqueado-gestao');
        } else {
            inputValFrete.setAttribute('readonly', 'true');
            inputValFrete.setAttribute('tabindex', '-1');
            inputValFrete.classList.add('campo-bloqueado-gestao');
        }

        // 2. DESCARGA: Trancada para o motorista (Definida pela Gestão)
        if (inputDescarga) {
            if (isGestao) {
                inputDescarga.removeAttribute('readonly');
                inputDescarga.removeAttribute('tabindex');
                inputDescarga.classList.remove('campo-bloqueado-gestao');
            } else {
                inputDescarga.setAttribute('readonly', 'true');
                inputDescarga.setAttribute('tabindex', '-1');
                inputDescarga.classList.add('campo-bloqueado-gestao');
            }
        }

        // 3. COMISSÃO: Cálculo automático ou fixo, trancada para o motorista
        if (tipoOperacao === 'mercado_livre') {
            inputComissao.value = '400,00';
            inputComissao.dataset.editadoManual = '';
        } else if (tipoOperacao === 'shopee') {
            inputComissao.dataset.editadoManual = '';
            const valorNum = parseMoeda(inputValFrete.value);
            if (valorNum > 0) {
                const comissao11 = valorNum * 0.11;
                inputComissao.value = formatarMoedaSemPrefixo(comissao11);
            } else {
                inputComissao.value = '';
            }
        } else if (tipoOperacao === 'alimenticio') {
            inputComissao.dataset.editadoManual = '';
            if (acaoDisparadaPorSelect && isGestao) {
                inputComissao.value = '';
            }
        } else {
            inputComissao.dataset.editadoManual = '';
            if (acaoDisparadaPorSelect && isGestao) {
                inputValFrete.value = '';
            }
            inputComissao.value = '';
        }

        if (isGestao) {
            if (tipoOperacao === 'alimenticio' || tipoOperacao === '') {
                inputComissao.removeAttribute('readonly');
                inputComissao.removeAttribute('tabindex');
                inputComissao.classList.remove('campo-bloqueado-gestao');
            } else {
                inputComissao.setAttribute('readonly', 'true');
            }
        } else {
            inputComissao.setAttribute('readonly', 'true');
            inputComissao.setAttribute('tabindex', '-1');
            inputComissao.classList.add('campo-bloqueado-gestao');
        }
    }

    for (let i = 1; i <= 8; i++) {
        const inputValFrete = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const inputComissao = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
        const inputDescarga = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);
        const selectCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
        const inputDataFrete = document.querySelector(`input[name="data_frete_ml_${i}"]`);
        const inputOrigemFrete = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
        const inputDestinoFrete = document.querySelector(`input[name="destino_frete_ml_${i}"]`);

        if (selectCli) {
            selectsClienteFreteMl.push(selectCli);
            selectCli.addEventListener('change', () => {
                atualizarLinhaFreteMl(i, true);
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }

        if (inputValFrete) {
            inputsValorFreteMl.push(inputValFrete);
            aplicarMascaraMoeda(inputValFrete, () => {
                atualizarLinhaFreteMl(i, false);
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }

        if (inputComissao) {
            inputsComissaoFreteMl.push(inputComissao);
            aplicarMascaraMoeda(inputComissao, () => {
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }

        if (inputDescarga) {
            inputsDescargaFreteMl.push(inputDescarga);
            aplicarMascaraMoeda(inputDescarga, () => {
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }

        if (inputDataFrete) {
            const btnPickerData = inputDataFrete.parentElement ? inputDataFrete.parentElement.querySelector('.btn-picker-data') : null;
            const pickerNativo = inputDataFrete.parentElement ? inputDataFrete.parentElement.querySelector('.input-picker-data-nativo') : null;
            aplicarMascaraDataComPicker(inputDataFrete, pickerNativo, btnPickerData, () => {
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }
        if (inputOrigemFrete) {
            inputOrigemFrete.addEventListener('input', () => {
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }
        if (inputDestinoFrete) {
            inputDestinoFrete.addEventListener('input', () => {
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }

        // Botão inline na coluna de numeração para apagar a linha específica
        const btnLimparInline = document.querySelector(`.btn-limpar-linha-inline[data-linha="${i}"]`);
        if (btnLimparInline) {
            btnLimparInline.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof limparLinhaFrete === 'function') {
                    limparLinhaFrete(i);
                }
            });
        }
    }

    function calcularTotaisFreteMl() {
        let somaFrete = 0;
        let somaComissao = 0;
        let somaDescarga = 0;

        inputsValorFreteMl.forEach(input => {
            somaFrete += parseMoeda(input.value);
        });

        inputsComissaoFreteMl.forEach(input => {
            somaComissao += parseMoeda(input.value);
        });

        inputsDescargaFreteMl.forEach(input => {
            somaDescarga += parseMoeda(input.value);
        });

        if (inputTotalRelacaoFrete) {
            inputTotalRelacaoFrete.value = formatarMoedaSemPrefixo(somaFrete);
        }

        if (inputTotalRelacaoComissao) {
            inputTotalRelacaoComissao.value = formatarMoedaSemPrefixo(somaComissao);
        }

        if (inputTotalRelacaoDescarga) {
            inputTotalRelacaoDescarga.value = formatarMoedaSemPrefixo(somaDescarga);
        }

        // Sincroniza automaticamente a soma total de comissões com o campo "VR COMISSÃO" do cabeçalho
        if (inputVrComissao) {
            inputVrComissao.value = somaComissao > 0 ? formatarMoedaSemPrefixo(somaComissao) : '';
        }

        // Sincroniza automaticamente com o campo "TOTAL FRETE" do cabeçalho
        if (inputTotalFrete) {
            inputTotalFrete.value = somaFrete > 0 ? formatarMoedaSemPrefixo(somaFrete) : '';
        }

        return { frete: somaFrete, comissao: somaComissao, descarga: somaDescarga };
    }

    // 15.2. Abastecimento ML (10 Linhas - Sem Média)
    const inputsValorAbastMl = [];
    const inputsLitrosAbastMl = [];
    const inputTotalValorCombustivelMl = document.getElementById('ml-total-valor-combustivel');
    const inputTotalLitrosCombustivelMl = document.getElementById('ml-total-litros-combustivel');

    for (let i = 1; i <= 10; i++) {
        const inputPosto = document.querySelector(`[name="posto_ml_${i}"]`);
        const inputNf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const inputKm = document.querySelector(`input[name="km_ml_${i}"]`);
        const inputValor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const inputLitros = document.querySelector(`input[name="litros_ml_${i}"]`);

        if (inputPosto) {
            ['input', 'change'].forEach(ev => {
                inputPosto.addEventListener(ev, () => {
                    salvarProgressoMl();
                    if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                        atualizarListaLinhasAbastPreenchidasPopover();
                    }
                });
            });
        }

        if (inputNf) {
            aplicarMascaraMilhar(inputNf, () => {
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            });
        }

        if (inputKm) {
            aplicarMascaraMilhar(inputKm, () => {
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            });
        }

        if (inputValor) {
            inputsValorAbastMl.push(inputValor);
            aplicarMascaraMoeda(inputValor, () => {
                calcularTotaisAbastecimentoMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            });
        }

        if (inputLitros) {
            inputsLitrosAbastMl.push(inputLitros);
            aplicarMascaraLitros(inputLitros, () => {
                calcularTotaisAbastecimentoMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            });
        }

        // Botão inline na coluna de numeração para apagar a linha específica de abastecimento
        const btnLimparInline = document.querySelector(`.btn-limpar-linha-inline[data-linha-abast="${i}"]`);
        if (btnLimparInline) {
            btnLimparInline.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof limparLinhaAbast === 'function') {
                    limparLinhaAbast(i);
                }
            });
        }
    }

    function calcularTotaisAbastecimentoMl() {
        let somaValor = 0;
        let somaLitros = 0;

        inputsValorAbastMl.forEach(input => {
            somaValor += parseMoeda(input.value);
        });

        inputsLitrosAbastMl.forEach(input => {
            somaLitros += parseLitros(input.value);
        });

        if (inputTotalValorCombustivelMl) {
            inputTotalValorCombustivelMl.value = formatarMoedaSemPrefixo(somaValor);
        }

        if (inputTotalLitrosCombustivelMl) {
            inputTotalLitrosCombustivelMl.value = formatarLitros(somaLitros);
        }

        return { valor: somaValor, litros: somaLitros };
    }

    // 15.3. Pedágios e Outras Despesas ML (Idêntico ao Relatório Padrão)
    const inputsPedagioMl = [
        document.getElementById('ml-pedagio-1'),
        document.getElementById('ml-pedagio-2'),
        document.getElementById('ml-pedagio-3')
    ];

    inputsPedagioMl.forEach(input => {
        if (input) {
            aplicarMascaraMoeda(input, () => {
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }
    });

    function calcularTotalPedagioMl() {
        let total = 0;
        inputsPedagioMl.forEach(input => {
            if (input && input.value) {
                total += parseMoeda(input.value);
            }
        });

        const totalPedagioEl = document.getElementById('ml-total-pedagio');
        if (totalPedagioEl) {
            totalPedagioEl.value = formatarDecimal(total, 2);
        }
        return total;
    }

    const inputMlImpFederal = document.getElementById('ml-imp-federal-valor');
    const inputMlDespesaValor2 = document.getElementById('ml-despesa-valor-2');
    const inputMlDespesaValor3 = document.getElementById('ml-despesa-valor-3');

    const inputsOutrasDespesasValorMl = [
        inputMlImpFederal,
        inputMlDespesaValor2,
        inputMlDespesaValor3
    ];

    inputsOutrasDespesasValorMl.forEach(input => {
        if (input) {
            aplicarMascaraMoeda(input, () => {
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }
    });

    const inputMlDespesaDesc2 = document.getElementById('ml-despesa-desc-2');
    const inputMlDespesaDesc3 = document.getElementById('ml-despesa-desc-3');
    if (inputMlDespesaDesc2) inputMlDespesaDesc2.addEventListener('input', salvarProgressoMl);
    if (inputMlDespesaDesc3) inputMlDespesaDesc3.addEventListener('input', salvarProgressoMl);

    function calcularTotalOutrasDespesasMl() {
        let total = 0;
        inputsOutrasDespesasValorMl.forEach(input => {
            if (input && input.value) {
                total += parseMoeda(input.value);
            }
        });

        const totalOutrasEl = document.getElementById('ml-total-outras-despesas');
        if (totalOutrasEl) {
            totalOutrasEl.value = formatarDecimal(total, 2);
        }
        return total;
    }

    function calcularTotaisDespesasMl() {
        const totalPedagio = calcularTotalPedagioMl();
        const totalOutras = calcularTotalOutrasDespesasMl();

        return {
            pedagio: totalPedagio,
            outras: totalOutras,
            totalGeralDespesas: totalPedagio + totalOutras
        };
    }

    // 15.4. Cards de Indicadores da Viagem
    function calcularIndicadoresViagemMl() {
        const kmTotalNum = parseMilhar(inputKmTotal ? inputKmTotal.value : 0);
        const totaisCombustivel = calcularTotaisAbastecimentoMl();
        const totaisDespesas = calcularTotaisDespesasMl();
        const totalFreteRelacao = calcularTotaisFreteMl();

        // 1. Média de Combustível (KM Total / Total Litros)
        if (mlIndicadorMedia) {
            if (totaisCombustivel.litros > 0 && kmTotalNum > 0) {
                const mediaGeral = kmTotalNum / totaisCombustivel.litros;
                if (isFinite(mediaGeral) && !isNaN(mediaGeral)) {
                    mlIndicadorMedia.innerHTML = `${formatarDecimal(mediaGeral, 2)} <span class="indicador-unidade">km/l</span>`;
                } else {
                    mlIndicadorMedia.innerHTML = `0,00 <span class="indicador-unidade">km/l</span>`;
                }
            } else {
                mlIndicadorMedia.innerHTML = `0,00 <span class="indicador-unidade">km/l</span>`;
            }
        }
        if (mlCalcBaseKm) mlCalcBaseKm.textContent = kmTotalNum > 0 ? formatarMilhar(kmTotalNum) : '0';
        if (mlCalcBaseLitros) mlCalcBaseLitros.textContent = formatarLitros(totaisCombustivel.litros);

        // 2. Despesa Total = Combustível + Impostos/Pedágios + Outras Despesas + Vr Comissão + Descarga
        const vrComissaoNum = parseMoeda(inputVrComissao ? inputVrComissao.value : '');
        const totalDescargaNum = totalFreteRelacao && totalFreteRelacao.descarga ? totalFreteRelacao.descarga : 0;

        const despesaTotalCalculada = totaisCombustivel.valor +
            totaisDespesas.totalGeralDespesas +
            vrComissaoNum +
            totalDescargaNum;

        if (mlIndicadorDespesa) {
            mlIndicadorDespesa.textContent = formatarMoeda(despesaTotalCalculada);
        }

        // 3. Resultado da Viagem = Total Frete - Despesa Total
        let totalFreteFinal = parseMoeda(inputTotalFrete ? inputTotalFrete.value : '');
        if (totalFreteFinal === 0 && totalFreteRelacao && totalFreteRelacao.frete > 0) {
            totalFreteFinal = totalFreteRelacao.frete;
        }

        const resultadoViagemCalculado = totalFreteFinal - despesaTotalCalculada;
        if (mlIndicadorResultado) {
            if (resultadoViagemCalculado < 0) {
                mlIndicadorResultado.textContent = '- R$ ' + formatarMoedaSemPrefixo(Math.abs(resultadoViagemCalculado));
                mlIndicadorResultado.style.color = '#b91c1c';
            } else {
                mlIndicadorResultado.textContent = formatarMoeda(resultadoViagemCalculado);
                mlIndicadorResultado.style.color = '#065f46';
            }
        }

        // 4. Saldo de Comissão = VR Comissão - Valor do Adiantamento
        const adiantamentoNum = parseMoeda(inputAdiantamento ? inputAdiantamento.value : '');
        const saldoComissao = vrComissaoNum - adiantamentoNum;

        if (mlIndicadorSaldoComissao) {
            if (saldoComissao < 0) {
                mlIndicadorSaldoComissao.textContent = '- R$ ' + formatarMoedaSemPrefixo(Math.abs(saldoComissao));
                mlIndicadorSaldoComissao.style.color = '#b91c1c';
            } else {
                mlIndicadorSaldoComissao.textContent = formatarMoeda(saldoComissao);
                mlIndicadorSaldoComissao.style.color = '';
            }
        }
    }

    // 15.6. Upload de Comprovantes ML
    const dropzoneMl = document.getElementById('dropzone-comprovantes-ml');
    const inputFileMl = document.getElementById('input-arquivos-despesas-ml');
    const listaPreviewMl = document.getElementById('lista-anexos-preview-ml');
    const contadorAnexosMl = document.getElementById('contador-anexos-ml');
    let arquivosComprovantesMl = [];

    function renderizarListaAnexosMl() {
        if (!listaPreviewMl) return;
        listaPreviewMl.innerHTML = '';

        arquivosComprovantesMl.forEach((arq, index) => {
            const item = document.createElement('div');
            item.className = 'item-anexo-card';
            const ehPdf = arq.name.toLowerCase().endsWith('.pdf');
            const iconeSvg = ehPdf ?
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></circle><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

            item.innerHTML = `
                <div class="item-anexo-info">
                    ${iconeSvg}
                    <div class="item-anexo-detalhes">
                        <div class="item-anexo-nome" title="${arq.name}">${arq.name}</div>
                        <div class="item-anexo-tamanho">${formatarTamanhoArquivo(arq.size)}</div>
                    </div>
                </div>
                <button type="button" class="btn-remover-anexo" data-index="${index}" title="Remover anexo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            listaPreviewMl.appendChild(item);
        });

        if (contadorAnexosMl) {
            contadorAnexosMl.textContent = `${arquivosComprovantesMl.length} arquivo(s)`;
        }

        listaPreviewMl.querySelectorAll('.btn-remover-anexo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                arquivosComprovantesMl.splice(idx, 1);
                renderizarListaAnexosMl();
                salvarProgressoMl();
            });
        });
    }

    if (dropzoneMl && inputFileMl) {
        dropzoneMl.addEventListener('click', () => inputFileMl.click());

        inputFileMl.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                adicionarArquivosMl(e.target.files);
                inputFileMl.value = '';
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzoneMl.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneMl.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzoneMl.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneMl.classList.remove('dragover');
            });
        });

        dropzoneMl.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                adicionarArquivosMl(e.dataTransfer.files);
            }
        });
    }

    function adicionarArquivosMl(novosArquivos) {
        let adicionados = 0;
        for (let i = 0; i < novosArquivos.length; i++) {
            const file = novosArquivos[i];
            if (file.size > 15 * 1024 * 1024) {
                exibirToast(`Arquivo "${file.name}" excede 15MB.`, 'erro');
                continue;
            }
            arquivosComprovantesMl.push({
                name: file.name,
                size: file.size,
                type: file.type
            });
            adicionados++;
        }

        if (adicionados > 0) {
            renderizarListaAnexosMl();
            salvarProgressoMl();
            exibirToast(`${adicionados} arquivo(s) anexado(s) com sucesso!`, 'sucesso');
        }
    }

    // 15.7. Lixeiras e Limpeza do Formulário ML
    const btnLixeiraFretesMl = document.getElementById('btn-lixeira-fretes-ml');
    const popoverLimparFretesMl = document.getElementById('popover-limpar-fretes-ml');
    const fecharPopoverFretesMl = document.getElementById('fechar-popover-fretes-ml');
    const popoverListaLinhasPreenchidas = document.getElementById('popover-lista-linhas-preenchidas');
    const btnLimparFretesMlTodas = document.getElementById('btn-limpar-fretes-ml-todas');

    const btnLixeiraAbastMl = document.getElementById('btn-lixeira-abast-ml');
    const popoverLimparAbastMl = document.getElementById('popover-limpar-abast-ml');
    const fecharPopoverAbastMl = document.getElementById('fechar-popover-abast-ml');
    const popoverListaLinhasAbastPreenchidas = document.getElementById('popover-lista-linhas-abast-preenchidas');
    const btnLimparAbastMlTodas = document.getElementById('btn-limpar-abast-ml-todas');

    const btnLixeiraDespesasMl = document.getElementById('btn-lixeira-despesas-ml');
    const popoverLimparDespesasMl = document.getElementById('popover-limpar-despesas-ml');
    const fecharPopoverDespesasMl = document.getElementById('fechar-popover-despesas-ml');
    const btnLimparApenasPedagiosMl = document.getElementById('btn-limpar-apenas-pedagios-ml');
    const btnLimparApenasOutrasDespesasMl = document.getElementById('btn-limpar-apenas-outras-despesas-ml');
    const btnLimparTodasDespesasPedagiosMl = document.getElementById('btn-limpar-todas-despesas-pedagios-ml');

    // Popover Fretes ML
    if (btnLixeiraFretesMl && popoverLimparFretesMl) {
        btnLixeiraFretesMl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverLimparAbastMl) popoverLimparAbastMl.classList.add('oculto');
            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            atualizarListaLinhasPreenchidasPopover();
            popoverLimparFretesMl.classList.toggle('oculto');
        });
    }
    if (fecharPopoverFretesMl && popoverLimparFretesMl) {
        fecharPopoverFretesMl.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverLimparFretesMl.classList.add('oculto');
        });
    }

    // Popover Abastecimento ML
    if (btnLixeiraAbastMl && popoverLimparAbastMl) {
        btnLixeiraAbastMl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverLimparFretesMl) popoverLimparFretesMl.classList.add('oculto');
            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            atualizarListaLinhasAbastPreenchidasPopover();
            popoverLimparAbastMl.classList.toggle('oculto');
        });
    }
    if (fecharPopoverAbastMl && popoverLimparAbastMl) {
        fecharPopoverAbastMl.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverLimparAbastMl.classList.add('oculto');
        });
    }

    // Popover Despesas ML
    if (btnLixeiraDespesasMl && popoverLimparDespesasMl) {
        btnLixeiraDespesasMl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverLimparFretesMl) popoverLimparFretesMl.classList.add('oculto');
            if (popoverLimparAbastMl) popoverLimparAbastMl.classList.add('oculto');
            popoverLimparDespesasMl.classList.toggle('oculto');
        });
    }
    if (fecharPopoverDespesasMl && popoverLimparDespesasMl) {
        fecharPopoverDespesasMl.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverLimparDespesasMl.classList.add('oculto');
        });
    }

    // Fechar popovers ML ao clicar fora
    document.addEventListener('click', (e) => {
        if (popoverLimparFretesMl && !popoverLimparFretesMl.contains(e.target) && e.target !== btnLixeiraFretesMl && !btnLixeiraFretesMl?.contains(e.target)) {
            popoverLimparFretesMl.classList.add('oculto');
        }
        if (popoverLimparAbastMl && !popoverLimparAbastMl.contains(e.target) && e.target !== btnLixeiraAbastMl && !btnLixeiraAbastMl?.contains(e.target)) {
            popoverLimparAbastMl.classList.add('oculto');
        }
        if (popoverLimparDespesasMl && !popoverLimparDespesasMl.contains(e.target) && e.target !== btnLixeiraDespesasMl && !btnLixeiraDespesasMl?.contains(e.target)) {
            popoverLimparDespesasMl.classList.add('oculto');
        }
    });

    // ------------------------------------------
    // Ações de Limpeza de Fretes (Individual e Coletiva)
    // ------------------------------------------
    function verificarLinhaFretePreenchida(i) {
        const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
        const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
        const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

        return !!((dt && dt.value.trim() !== '') ||
            (selCli && selCli.value.trim() !== '') ||
            (og && og.value.trim() !== '') ||
            (dst && dst.value.trim() !== '') ||
            (vl && vl.value.trim() !== '') ||
            (com && com.value.trim() !== '') ||
            (desc && desc.value.trim() !== ''));
    }

    function obterResumoLinhaFrete(i) {
        const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
        const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

        const partes = [];
        if (selCli && selCli.value) {
            const rotulosOp = {
                'alimenticio': 'Alimentício',
                'shopee': 'Shopee',
                'mercado_livre': 'Mercado Livre'
            };
            partes.push(rotulosOp[selCli.value] || selCli.value);
        }
        if (dst && dst.value.trim()) {
            partes.push(dst.value.trim());
        }
        if (vl && vl.value.trim()) {
            partes.push(`Frete R$ ${vl.value.trim()}`);
        } else if (dt && dt.value.trim()) {
            partes.push(dt.value.trim());
        }
        if (desc && desc.value.trim()) {
            partes.push(`Descarga R$ ${desc.value.trim()}`);
        }

        if (partes.length === 0) {
            return `Linha ${i}`;
        }
        return partes.join(' • ');
    }

    function limparLinhaFrete(i) {
        const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
        const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
        const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);
        const pickerNativo = dt && dt.parentElement ? dt.parentElement.querySelector('.input-picker-data-nativo') : null;

        if (dt) dt.value = '';
        if (pickerNativo) pickerNativo.value = '';
        if (selCli) selCli.value = '';
        if (og) og.value = '';
        if (dst) dst.value = '';
        if (vl) {
            vl.value = '';
            vl.removeAttribute('readonly');
        }
        if (com) {
            com.value = '';
            com.setAttribute('readonly', 'true');
            com.dataset.editadoManual = '';
        }
        if (desc) desc.value = '';

        calcularTotaisFreteMl();
        calcularIndicadoresViagemMl();
        salvarProgressoMl();
        atualizarListaLinhasPreenchidasPopover();
        exibirToast(`Linha ${i} da Relação de Fretes apagada com sucesso!`, 'info');
    }

    function atualizarListaLinhasPreenchidasPopover() {
        const container = document.getElementById('popover-lista-linhas-preenchidas');
        if (!container) return;

        container.innerHTML = '';
        let totalPreenchidas = 0;

        for (let i = 1; i <= 8; i++) {
            if (verificarLinhaFretePreenchida(i)) {
                totalPreenchidas++;
                const resumo = obterResumoLinhaFrete(i);

                const itemBtn = document.createElement('button');
                itemBtn.type = 'button';
                itemBtn.className = 'btn-apagar-linha-especifica';
                itemBtn.title = `Clique para apagar os dados da Linha ${i}`;
                itemBtn.innerHTML = `
                    <span class="badge-num-linha">L${i}</span>
                    <span class="detalhe-linha" title="${resumo}">${resumo}</span>
                    <span class="btn-apagar-icone-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Apagar</span>
                    </span>
                `;

                itemBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    limparLinhaFrete(i);
                });

                container.appendChild(itemBtn);
            }
        }

        if (totalPreenchidas === 0) {
            container.innerHTML = '<span class="texto-sem-linhas-preenchidas">Nenhuma linha preenchida</span>';
        }
    }

    if (btnLimparFretesMlTodas) {
        btnLimparFretesMlTodas.addEventListener('click', () => {
            for (let i = 1; i <= 8; i++) {
                const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
                const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);
                const pickerNativo = dt && dt.parentElement ? dt.parentElement.querySelector('.input-picker-data-nativo') : null;

                if (dt) dt.value = '';
                if (pickerNativo) pickerNativo.value = '';
                if (selCli) selCli.value = '';
                if (og) og.value = '';
                if (dst) dst.value = '';
                if (vl) {
                    vl.value = '';
                    vl.removeAttribute('readonly');
                }
                if (com) {
                    com.value = '';
                    com.setAttribute('readonly', 'true');
                    com.dataset.editadoManual = '';
                }
                if (desc) desc.value = '';
            }
            if (popoverLimparFretesMl) popoverLimparFretesMl.classList.add('oculto');
            calcularTotaisFreteMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            atualizarListaLinhasPreenchidasPopover();
            exibirToast('Todas as 8 linhas de frete foram limpas!', 'sucesso');
        });
    }

    // Ações de Limpeza de Abastecimento ML
    function verificarLinhaAbastPreenchida(i) {
        const posto = document.querySelector(`[name="posto_ml_${i}"]`);
        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const km = document.querySelector(`input[name="km_ml_${i}"]`);
        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

        return !!((posto && posto.value.trim() !== '') ||
            (nf && nf.value.trim() !== '') ||
            (km && km.value.trim() !== '') ||
            (valor && valor.value.trim() !== '') ||
            (litros && litros.value.trim() !== ''));
    }

    function obterResumoLinhaAbast(i) {
        const posto = document.querySelector(`[name="posto_ml_${i}"]`);
        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

        const partes = [];
        if (posto && posto.value.trim()) {
            partes.push(posto.value.trim());
        }
        if (nf && nf.value.trim()) {
            partes.push(`NF ${nf.value.trim()}`);
        }
        if (valor && valor.value.trim()) {
            partes.push(`R$ ${valor.value.trim()}`);
        }
        if (litros && litros.value.trim()) {
            partes.push(`${litros.value.trim()} L`);
        }

        if (partes.length === 0) {
            return `Linha ${i}`;
        }
        return partes.join(' • ');
    }

    function limparLinhaAbast(i) {
        const posto = document.querySelector(`[name="posto_ml_${i}"]`);
        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const km = document.querySelector(`input[name="km_ml_${i}"]`);
        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

        if (posto) posto.value = '';
        if (nf) nf.value = '';
        if (km) km.value = '';
        if (valor) valor.value = '';
        if (litros) litros.value = '';

        calcularTotaisAbastecimentoMl();
        calcularIndicadoresViagemMl();
        salvarProgressoMl();
        atualizarListaLinhasAbastPreenchidasPopover();
        exibirToast(`Linha ${i} do Abastecimento apagada com sucesso!`, 'info');
    }

    function atualizarListaLinhasAbastPreenchidasPopover() {
        const container = document.getElementById('popover-lista-linhas-abast-preenchidas');
        if (!container) return;

        container.innerHTML = '';
        let totalPreenchidas = 0;

        for (let i = 1; i <= 10; i++) {
            if (verificarLinhaAbastPreenchida(i)) {
                totalPreenchidas++;
                const resumo = obterResumoLinhaAbast(i);

                const itemBtn = document.createElement('button');
                itemBtn.type = 'button';
                itemBtn.className = 'btn-apagar-linha-especifica';
                itemBtn.title = `Clique para apagar os dados da Linha ${i}`;
                itemBtn.innerHTML = `
                    <span class="badge-num-linha">L${i}</span>
                    <span class="detalhe-linha" title="${resumo}">${resumo}</span>
                    <span class="btn-apagar-icone-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Apagar</span>
                    </span>
                `;

                itemBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    limparLinhaAbast(i);
                });

                container.appendChild(itemBtn);
            }
        }

        if (totalPreenchidas === 0) {
            container.innerHTML = '<span class="texto-sem-linhas-preenchidas">Nenhuma linha preenchida</span>';
        }
    }

    if (btnLimparAbastMlTodas) {
        btnLimparAbastMlTodas.addEventListener('click', () => {
            for (let i = 1; i <= 10; i++) {
                const posto = document.querySelector(`[name="posto_ml_${i}"]`);
                const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                const km = document.querySelector(`input[name="km_ml_${i}"]`);
                const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                if (posto) posto.value = '';
                if (nf) nf.value = '';
                if (km) km.value = '';
                if (valor) valor.value = '';
                if (litros) litros.value = '';
            }
            if (popoverLimparAbastMl) popoverLimparAbastMl.classList.add('oculto');
            calcularTotaisAbastecimentoMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            atualizarListaLinhasAbastPreenchidasPopover();
            exibirToast('Todas as 10 linhas de abastecimento ML foram limpas!', 'sucesso');
        });
    }

    // Ações de Limpeza de Despesas e Pedágios ML
    if (btnLimparApenasPedagiosMl) {
        btnLimparApenasPedagiosMl.addEventListener('click', () => {
            inputsPedagioMl.forEach(input => {
                if (input) input.value = '';
            });

            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            calcularTotaisDespesasMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Campos de pedágio ML limpos!', 'sucesso');
        });
    }

    if (btnLimparApenasOutrasDespesasMl) {
        btnLimparApenasOutrasDespesasMl.addEventListener('click', () => {
            if (inputMlDespesaDesc2) inputMlDespesaDesc2.value = '';
            if (inputMlDespesaValor2) inputMlDespesaValor2.value = '';
            if (inputMlDespesaDesc3) inputMlDespesaDesc3.value = '';
            if (inputMlDespesaValor3) inputMlDespesaValor3.value = '';

            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            calcularTotaisDespesasMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Campos de outras despesas ML limpos (mantido Imposto Federal)!', 'sucesso');
        });
    }

    if (btnLimparTodasDespesasPedagiosMl) {
        btnLimparTodasDespesasPedagiosMl.addEventListener('click', () => {
            inputsPedagioMl.forEach(input => {
                if (input) input.value = '';
            });
            if (inputMlImpFederal) inputMlImpFederal.value = '';
            if (inputMlDespesaDesc2) inputMlDespesaDesc2.value = '';
            if (inputMlDespesaValor2) inputMlDespesaValor2.value = '';
            if (inputMlDespesaDesc3) inputMlDespesaDesc3.value = '';
            if (inputMlDespesaValor3) inputMlDespesaValor3.value = '';

            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            calcularTotaisDespesasMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Pedágios e outras despesas ML foram totalmente limpos!', 'sucesso');
        });
    }

    // 15.8. Persistência de Dados (Salvar e Restaurar Rascunho)
    function salvarProgressoMl() {
        try {
            const cabecalho = {
                motorista: inputMotorista?.value || '',
                placas: inputPlacas?.value || '',
                dataSaida: inputDataSaida?.value || '',
                dataChegada: inputDataChegada?.value || '',
                kmSaida: inputKmSaida?.value || '',
                kmChegada: inputKmChegada?.value || '',
                kmTotal: inputKmTotal?.value || '',
                destinoInicial: inputDestinoInicial?.value || '',
                destinoFinal: inputDestinoFinal?.value || '',
                valorAdiantamento: inputAdiantamento?.value || '',
                freteOrigem: inputFreteOrigem?.value || '',
                retorno1: inputRetorno1?.value || '',
                retorno2: inputRetorno2?.value || '',
                retorno3: inputRetorno3?.value || '',
                totalFrete: inputTotalFrete?.value || '',
                vrComissao: inputVrComissao?.value || ''
            };

            const fretesMl = [];
            for (let i = 1; i <= 8; i++) {
                fretesMl.push({
                    data: document.querySelector(`input[name="data_frete_ml_${i}"]`)?.value || '',
                    cliente: document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '',
                    origem: document.querySelector(`input[name="origem_frete_ml_${i}"]`)?.value || '',
                    destino: document.querySelector(`input[name="destino_frete_ml_${i}"]`)?.value || '',
                    valor: document.querySelector(`input[name="valor_frete_ml_${i}"]`)?.value || '',
                    comissao: document.querySelector(`input[name="comissao_frete_ml_${i}"]`)?.value || '',
                    descarga: document.querySelector(`input[name="descarga_frete_ml_${i}"]`)?.value || ''
                });
            }

            const abastecimentosMl = [];
            for (let i = 1; i <= 10; i++) {
                abastecimentosMl.push({
                    posto: document.querySelector(`[name="posto_ml_${i}"]`)?.value || '',
                    nf: document.querySelector(`input[name="nf_ml_${i}"]`)?.value || '',
                    km: document.querySelector(`input[name="km_ml_${i}"]`)?.value || '',
                    valor: document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '',
                    litros: document.querySelector(`input[name="litros_ml_${i}"]`)?.value || ''
                });
            }

            const outrasDespesasMl = [
                { desc: 'Imposto Federal', valor: inputMlImpFederal?.value || '' },
                { desc: inputMlDespesaDesc2?.value || '', valor: inputMlDespesaValor2?.value || '' },
                { desc: inputMlDespesaDesc3?.value || '', valor: inputMlDespesaValor3?.value || '' }
            ];

            const dadosMl = {
                cabecalho,
                fretes: fretesMl,
                abastecimentos: abastecimentosMl,
                pedagios: [
                    document.getElementById('ml-pedagio-1')?.value || '',
                    document.getElementById('ml-pedagio-2')?.value || '',
                    document.getElementById('ml-pedagio-3')?.value || ''
                ],
                impFederal: inputMlImpFederal?.value || '',
                outrasDespesas: outrasDespesasMl,
                anexos: arquivosComprovantesMl
            };

            localStorage.setItem(STORAGE_ML_KEY, JSON.stringify(dadosMl));
        } catch (e) {
            console.error('Erro ao salvar progresso:', e);
        }
    }

    function carregarProgressoMl() {
        try {
            const salvo = localStorage.getItem(STORAGE_ML_KEY);
            if (salvo) {
                const dados = JSON.parse(salvo);

                // Restaurar cabeçalho
                if (dados.cabecalho) {
                    if (inputMotorista && dados.cabecalho.motorista) {
                        let opt = Array.from(inputMotorista.options).find(o => o.value.toUpperCase() === dados.cabecalho.motorista.toUpperCase());
                        if (!opt) {
                            const o = document.createElement('option');
                            o.value = dados.cabecalho.motorista;
                            o.textContent = dados.cabecalho.motorista;
                            inputMotorista.appendChild(o);
                        }
                        inputMotorista.value = dados.cabecalho.motorista;
                    }
                    if (inputPlacas && dados.cabecalho.placas) {
                        let opt = Array.from(inputPlacas.options).find(o => o.value.toUpperCase() === dados.cabecalho.placas.toUpperCase());
                        if (!opt) {
                            const o = document.createElement('option');
                            o.value = dados.cabecalho.placas;
                            o.textContent = dados.cabecalho.placas;
                            inputPlacas.appendChild(o);
                        }
                        inputPlacas.value = dados.cabecalho.placas;
                    }
                    if (inputDataSaida && dados.cabecalho.dataSaida) inputDataSaida.value = normalizarDataExibicao(dados.cabecalho.dataSaida);
                    if (inputDataChegada && dados.cabecalho.dataChegada) inputDataChegada.value = normalizarDataExibicao(dados.cabecalho.dataChegada);
                    if (inputKmSaida && dados.cabecalho.kmSaida) inputKmSaida.value = dados.cabecalho.kmSaida;
                    if (inputKmChegada && dados.cabecalho.kmChegada) inputKmChegada.value = dados.cabecalho.kmChegada;
                    if (inputKmTotal && dados.cabecalho.kmTotal) inputKmTotal.value = dados.cabecalho.kmTotal;
                    if (inputDestinoInicial && dados.cabecalho.destinoInicial) inputDestinoInicial.value = dados.cabecalho.destinoInicial;
                    if (inputDestinoFinal && dados.cabecalho.destinoFinal) inputDestinoFinal.value = dados.cabecalho.destinoFinal;
                    if (inputAdiantamento && dados.cabecalho.valorAdiantamento) inputAdiantamento.value = dados.cabecalho.valorAdiantamento;
                    if (inputFreteOrigem && dados.cabecalho.freteOrigem) inputFreteOrigem.value = dados.cabecalho.freteOrigem;
                    if (inputRetorno1 && dados.cabecalho.retorno1) inputRetorno1.value = dados.cabecalho.retorno1;
                    if (inputRetorno2 && dados.cabecalho.retorno2) inputRetorno2.value = dados.cabecalho.retorno2;
                    if (inputRetorno3 && dados.cabecalho.retorno3) inputRetorno3.value = dados.cabecalho.retorno3;
                    if (inputTotalFrete && dados.cabecalho.totalFrete) inputTotalFrete.value = dados.cabecalho.totalFrete;
                    if (inputVrComissao && dados.cabecalho.vrComissao) inputVrComissao.value = dados.cabecalho.vrComissao;
                }

                // Restaurar fretes
                let temFretePreenchido = false;
                if (Array.isArray(dados.fretes)) {
                    dados.fretes.forEach((f, idx) => {
                        const i = idx + 1;
                        const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                        const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                        const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                        const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
                        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

                        if (dt && f.data) dt.value = normalizarDataExibicao(f.data);
                        if (selCli && f.cliente !== undefined) selCli.value = f.cliente;
                        if (og && f.origem) og.value = f.origem;
                        if (dst && f.destino) dst.value = f.destino;
                        if (desc && f.descarga) desc.value = f.descarga;

                        if (f.cliente || f.valor || f.origem || f.destino || f.descarga) {
                            temFretePreenchido = true;
                        }

                        if (f.cliente === 'mercado_livre') {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com) {
                                com.setAttribute('readonly', 'true');
                                com.dataset.editadoManual = '';
                                com.value = '400,00';
                            }
                        } else if (f.cliente === 'shopee') {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com) {
                                com.setAttribute('readonly', 'true');
                                com.dataset.editadoManual = '';
                                if (f.comissao) {
                                    com.value = f.comissao;
                                } else if (vl && vl.value) {
                                    const vNum = parseMoeda(vl.value);
                                    com.value = vNum > 0 ? formatarMoedaSemPrefixo(vNum * 0.11) : '';
                                }
                            }
                        } else if (f.cliente === 'alimenticio') {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com) {
                                com.removeAttribute('readonly');
                                com.dataset.editadoManual = '';
                                if (f.comissao) com.value = f.comissao;
                            }
                        } else {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com) {
                                com.setAttribute('readonly', 'true');
                                com.dataset.editadoManual = '';
                                if (f.comissao) com.value = f.comissao;
                            }
                        }
                    });
                }

                // Restaurar abastecimento
                let temAbastPreenchido = false;
                if (Array.isArray(dados.abastecimentos)) {
                    dados.abastecimentos.forEach((ab, idx) => {
                        const i = idx + 1;
                        const posto = document.querySelector(`[name="posto_ml_${i}"]`);
                        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                        const km = document.querySelector(`input[name="km_ml_${i}"]`);
                        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                        if (posto && ab.posto) {
                            let opt = Array.from(posto.options).find(o => o.value.toUpperCase() === ab.posto.toUpperCase());
                            if (!opt) {
                                const o = document.createElement('option');
                                o.value = ab.posto;
                                o.textContent = ab.posto;
                                posto.appendChild(o);
                            }
                            posto.value = ab.posto;
                            temAbastPreenchido = true;
                        }
                        if (nf && ab.nf) { nf.value = ab.nf; temAbastPreenchido = true; }
                        if (km && ab.km) { km.value = ab.km; temAbastPreenchido = true; }
                        if (valor && ab.valor) { valor.value = ab.valor; temAbastPreenchido = true; }
                        if (litros && ab.litros) { litros.value = ab.litros; temAbastPreenchido = true; }
                    });
                }

                // Restaurar Pedágios ML
                let temDespesaPreenchida = false;
                if (Array.isArray(dados.pedagios)) {
                    if (inputsPedagioMl[0] && dados.pedagios[0]) { inputsPedagioMl[0].value = dados.pedagios[0]; temDespesaPreenchida = true; }
                    if (inputsPedagioMl[1] && dados.pedagios[1]) { inputsPedagioMl[1].value = dados.pedagios[1]; temDespesaPreenchida = true; }
                    if (inputsPedagioMl[2] && dados.pedagios[2]) { inputsPedagioMl[2].value = dados.pedagios[2]; temDespesaPreenchida = true; }
                }

                // Restaurar Imposto Federal ML
                if (inputMlImpFederal && dados.impFederal) {
                    inputMlImpFederal.value = dados.impFederal;
                    temDespesaPreenchida = true;
                }

                // Restaurar Outras Despesas ML
                if (Array.isArray(dados.outrasDespesas)) {
                    if (dados.outrasDespesas[0] && inputMlImpFederal && dados.outrasDespesas[0].valor) {
                        inputMlImpFederal.value = dados.outrasDespesas[0].valor;
                        temDespesaPreenchida = true;
                    }
                    if (dados.outrasDespesas[1]) {
                        if (inputMlDespesaDesc2 && dados.outrasDespesas[1].desc) inputMlDespesaDesc2.value = dados.outrasDespesas[1].desc;
                        if (inputMlDespesaValor2 && dados.outrasDespesas[1].valor) { inputMlDespesaValor2.value = dados.outrasDespesas[1].valor; temDespesaPreenchida = true; }
                    }
                    if (dados.outrasDespesas[2]) {
                        if (inputMlDespesaDesc3 && dados.outrasDespesas[2].desc) inputMlDespesaDesc3.value = dados.outrasDespesas[2].desc;
                        if (inputMlDespesaValor3 && dados.outrasDespesas[2].valor) { inputMlDespesaValor3.value = dados.outrasDespesas[2].valor; temDespesaPreenchida = true; }
                    }
                }

                // Restaurar Anexos
                if (Array.isArray(dados.anexos)) {
                    arquivosComprovantesMl = dados.anexos;
                    renderizarListaAnexosMl();
                }

                calcularKmTotal();
                calcularTotaisFreteMl();
                calcularTotaisAbastecimentoMl();
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }

                // Se houver dados lançados nas seções operacionais, expande o formulário
                if (temFretePreenchido || temAbastPreenchido || temDespesaPreenchida) {
                    toggleFormularioUnificado(true, false);
                }
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho:', e);
        }
    }

    // Botões de ação do Formulário
    const btnSalvarRascunhoMl = document.getElementById('btn-salvar-rascunho-ml');
    if (btnSalvarRascunhoMl) {
        btnSalvarRascunhoMl.addEventListener('click', () => {
            salvarProgressoMl();
            exibirToast('Rascunho do Relatório de Viagem salvo com sucesso!', 'sucesso');
        });
    }

    // =========================================================================
    // CICLO DE VIDA DO RELATÓRIO DE VIAGEM (MOTORISTA <-> GESTÃO / ADMIN)
    // =========================================================================

    function coletarFretesAtuais() {
        const fretes = [];
        for (let i = 1; i <= 8; i++) {
            const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`)?.value || '';
            const cli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '';
            const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`)?.value || '';
            const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`)?.value || '';
            const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`)?.value || '';
            const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`)?.value || '';
            const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`)?.value || '';

            if (dt || cli || og || dst || vl || com) {
                fretes.push({ data: dt, cliente: cli, origem: og, destino: dst, valor: vl, comissao: com, descarga: desc });
            }
        }
        return fretes;
    }

    function coletarAbastecimentosAtuais() {
        const abasts = [];
        for (let i = 1; i <= 10; i++) {
            const posto = document.querySelector(`[name="posto_ml_${i}"]`)?.value || '';
            const nf = document.querySelector(`input[name="nf_ml_${i}"]`)?.value || '';
            const km = document.querySelector(`input[name="km_ml_${i}"]`)?.value || '';
            const valor = document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '';
            const litros = document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '';

            if (posto || nf || km || valor || litros) {
                abasts.push({ posto, nf, km, valor, litros });
            }
        }
        return abasts;
    }

    function coletarOutrasDespesasAtuais() {
        return [
            { desc: 'Imposto Federal', valor: inputMlImpFederal?.value || '' },
            { desc: inputMlDespesaDesc2?.value || '', valor: inputMlDespesaValor2?.value || '' },
            { desc: inputMlDespesaDesc3?.value || '', valor: inputMlDespesaValor3?.value || '' }
        ];
    }

    function carregarFichaEmCampos(ficha) {
        if (!ficha) return;

        // Cabeçalho
        if (inputMotorista && ficha.motorista) {
            let opt = Array.from(inputMotorista.options).find(o => o.value.toUpperCase() === ficha.motorista.toUpperCase());
            if (!opt) {
                const o = document.createElement('option');
                o.value = ficha.motorista;
                o.textContent = ficha.motorista;
                inputMotorista.appendChild(o);
            }
            inputMotorista.value = ficha.motorista;
        }
        if (inputPlacas && ficha.placas) {
            let opt = Array.from(inputPlacas.options).find(o => o.value.toUpperCase() === ficha.placas.toUpperCase());
            if (!opt) {
                const o = document.createElement('option');
                o.value = ficha.placas;
                o.textContent = ficha.placas;
                inputPlacas.appendChild(o);
            }
            inputPlacas.value = ficha.placas;
        }
        if (inputDataSaida && ficha.dataSaida) inputDataSaida.value = normalizarDataExibicao(ficha.dataSaida);
        if (inputDataChegada && ficha.dataChegada) inputDataChegada.value = normalizarDataExibicao(ficha.dataChegada);
        if (inputKmSaida && ficha.kmSaida) inputKmSaida.value = ficha.kmSaida;
        if (inputKmChegada && ficha.kmChegada) inputKmChegada.value = ficha.kmChegada;
        if (inputKmTotal && ficha.kmTotal) inputKmTotal.value = ficha.kmTotal;
        if (inputDestinoInicial && ficha.destinoInicial) inputDestinoInicial.value = ficha.destinoInicial;
        if (inputDestinoFinal && ficha.destinoFinal) inputDestinoFinal.value = ficha.destinoFinal;
        if (inputAdiantamento && ficha.valorAdiantamento) inputAdiantamento.value = ficha.valorAdiantamento;
        if (inputFreteOrigem && ficha.freteOrigem) inputFreteOrigem.value = ficha.freteOrigem;
        if (inputRetorno1 && ficha.retorno1) inputRetorno1.value = ficha.retorno1;
        if (inputRetorno2 && ficha.retorno2) inputRetorno2.value = ficha.retorno2;
        if (inputRetorno3 && ficha.retorno3) inputRetorno3.value = ficha.retorno3;
        if (inputTotalFrete && ficha.totalFrete) inputTotalFrete.value = ficha.totalFrete;
        if (inputVrComissao && ficha.vrComissao) inputVrComissao.value = ficha.vrComissao;

        // Fretes Operacionais
        if (Array.isArray(ficha.fretes)) {
            ficha.fretes.forEach((f, idx) => {
                const i = idx + 1;
                const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
                const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

                if (dt && f.data) dt.value = normalizarDataExibicao(f.data);
                if (selCli && f.cliente) selCli.value = f.cliente;
                if (og && f.origem) og.value = f.origem;
                if (dst && f.destino) dst.value = f.destino;
                if (vl && f.valor) vl.value = f.valor;
                if (com && f.comissao) com.value = f.comissao;
                if (desc && f.descarga) desc.value = f.descarga;
            });
        }

        // Abastecimentos
        if (Array.isArray(ficha.abastecimentos)) {
            ficha.abastecimentos.forEach((ab, idx) => {
                const i = idx + 1;
                const posto = document.querySelector(`[name="posto_ml_${i}"]`);
                const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                const km = document.querySelector(`input[name="km_ml_${i}"]`);
                const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                if (posto && ab.posto) {
                    let opt = Array.from(posto.options).find(o => o.value.toUpperCase() === ab.posto.toUpperCase());
                    if (!opt) {
                        const o = document.createElement('option');
                        o.value = ab.posto;
                        o.textContent = ab.posto;
                        posto.appendChild(o);
                    }
                    posto.value = ab.posto;
                }
                if (nf && ab.nf) nf.value = ab.nf;
                if (km && ab.km) km.value = ab.km;
                if (valor && ab.valor) valor.value = ab.valor;
                if (litros && ab.litros) litros.value = ab.litros;
            });
        }

        // Pedágios
        if (Array.isArray(ficha.pedagios)) {
            if (inputsPedagioMl[0] && ficha.pedagios[0]) inputsPedagioMl[0].value = ficha.pedagios[0];
            if (inputsPedagioMl[1] && ficha.pedagios[1]) inputsPedagioMl[1].value = ficha.pedagios[1];
            if (inputsPedagioMl[2] && ficha.pedagios[2]) inputsPedagioMl[2].value = ficha.pedagios[2];
        }

        // Imposto Federal
        if (inputMlImpFederal && ficha.impFederal) {
            inputMlImpFederal.value = ficha.impFederal;
        }

        // Anexos
        if (Array.isArray(ficha.anexos)) {
            arquivosComprovantesMl = ficha.anexos;
            renderizarListaAnexosMl();
        }

        calcularKmTotal();
        calcularTotaisFreteMl();
        calcularTotaisAbastecimentoMl();
        calcularTotaisDespesasMl();
        calcularIndicadoresViagemMl();
    }

    function obterListaFichasCentral() {
        const dados = localStorage.getItem(STORAGE_CENTRAL_FICHAS);
        if (dados) {
            try {
                const lista = JSON.parse(dados);
                if (Array.isArray(lista)) {
                    // Remove dados de seed mockados antigos se existirem
                    const limpa = lista.filter(f => {
                        if (!f || !f.id) return false;
                        const mockIds = ['AJB-2026-001', 'AJB-2026-002', 'AJB-2026-003', 'AJB-2026-004', 'AJB-2026-005',
                            'AJB-2026-006', 'AJB-2026-007', 'AJB-2026-008', 'AJB-2026-009', 'AJB-2026-010', 'AJB-2026-011'];
                        return !mockIds.includes(f.id);
                    });
                    if (limpa.length !== lista.length) {
                        localStorage.setItem(STORAGE_CENTRAL_FICHAS, JSON.stringify(limpa));
                    }
                    return limpa;
                }
            } catch (e) { }
        }
        return [];
    }

    function salvarListaFichasCentral(lista) {
        localStorage.setItem(STORAGE_CENTRAL_FICHAS, JSON.stringify(lista));
    }

    // Alternância de Perfil (Driver vs Admin)
    window.alternarPerfil = function (novoRole) {
        let usuario = null;
        try {
            usuario = JSON.parse(localStorage.getItem(STORAGE_USER_ACTIVE) || '{}');
        } catch (e) { usuario = {}; }

        if (novoRole === 'admin' || novoRole === 'diretoria') {
            usuario.role = 'admin';
            usuario.nome = usuario.nome || 'Administrador Central';
            usuario.email = usuario.email || 'admin@ajborges.com';
            localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuario));
            exibirToast('Visão de ADMINISTRADOR ativada (Todos os campos liberados para edição)', 'sucesso');
        } else {
            usuario.role = 'motorista';
            usuario.nome = (usuario.nome && usuario.nome !== 'Carlos Eduardo Ferreira') ? usuario.nome : '';
            usuario.email = usuario.email || 'motorista@ajborges.com';
            localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuario));
            exibirToast('Visão de MOTORISTA ativada (Campos corporativos bloqueados / Imposto Federal oculto)', 'info');
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());

        configurarCicloDeVidaViagem();
    };

    // Configuração dos Modos (Admin vs Motorista)
    function configurarCicloDeVidaViagem() {
        const urlParams = new URLSearchParams(window.location.search);
        const fichaIdUrl = urlParams.get('ficha');
        const modeUrl = urlParams.get('mode');

        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivo = null;
        if (usuarioAtivoStr) {
            try {
                usuarioAtivo = JSON.parse(usuarioAtivoStr);
                if (usuarioAtivo && usuarioAtivo.nome === 'Carlos Eduardo Ferreira') {
                    usuarioAtivo.nome = '';
                    localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuarioAtivo));
                }
            } catch (e) { }
        }

        const isModoAdmin = (modeUrl === 'admin') || (usuarioAtivo && (usuarioAtivo.role === 'admin' || usuarioAtivo.role === 'diretoria') && modeUrl !== 'motorista');
        const isModoView = (modeUrl === 'view');

        const barraAdmin = document.getElementById('barra-admin-operacional');
        const barraMotorista = document.getElementById('barra-motorista-info');
        const adminTitulo = document.getElementById('admin-banner-ficha-titulo');
        const adminStatus = document.getElementById('admin-banner-status');
        const btnAdminAprovar = document.getElementById('btn-admin-aprovar-concluir');
        const btnAdminSalvar = document.getElementById('btn-admin-salvar-alteracoes');

        // Campos com governança corporativa da empresa
        const camposGovernançaFrota = [
            inputMotorista,
            inputPlacas,
            inputDataSaida,
            inputDataChegada,
            inputKmSaida,
            inputKmChegada,
            inputKmTotal,
            inputDestinoInicial,
            inputDestinoFinal,
            inputAdiantamento,
            inputFreteOrigem,
            inputRetorno1,
            inputRetorno2,
            inputRetorno3,
            inputTotalFrete,
            inputVrComissao,
            document.getElementById('ml-total-relacao-descarga'),
            document.getElementById('ml-pedagio-1'),
            document.getElementById('ml-pedagio-2'),
            document.getElementById('ml-pedagio-3'),
            document.getElementById('ml-total-pedagio')
        ].filter(Boolean);

        const camposDescargaTabela = Array.from(document.querySelectorAll('.input-descarga-frete-ml'));
        const linhaImpostoFederal = document.getElementById('linha-imposto-federal');
        const badgeImpostoObrigatorio = document.getElementById('badge-imposto-obrigatorio');
        const inputMlImpFederal = document.getElementById('ml-imp-federal-valor');
        const badgePedagio = document.getElementById('badge-pedagio-status');
        const botoesPickerData = document.querySelectorAll('.btn-picker-data');

        function aplicarBloqueioCampo(input, rotulo = 'Definido pela Gestão') {
            if (!input) return;
            input.setAttribute('readonly', 'true');
            input.setAttribute('tabindex', '-1');
            const wrapper = input.closest('.campo-grupo') || input.closest('.frete-coluna') || input.closest('.linha-despesa-item') || input.closest('.total-mini-wrap')?.parentElement || input.parentElement;
            if (wrapper) {
                wrapper.classList.add('campo-bloqueado-gestao');

                // Desabilita seletores e botões de data associados
                const pickers = wrapper.querySelectorAll('.input-picker-data-nativo, input[type="date"]');
                pickers.forEach(p => {
                    p.setAttribute('disabled', 'true');
                    p.disabled = true;
                });
                const btnsPicker = wrapper.querySelectorAll('.btn-picker-data');
                btnsPicker.forEach(b => {
                    b.setAttribute('disabled', 'true');
                    b.style.pointerEvents = 'none';
                    b.style.opacity = '0.3';
                    b.style.cursor = 'not-allowed';
                });

                const label = wrapper.querySelector('label') || wrapper.closest('.frete-coluna')?.querySelector('label');
                if (label && !label.querySelector('.tag-bloqueado-frota')) {
                    const tag = document.createElement('span');
                    tag.className = 'tag-bloqueado-frota';
                    tag.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span>${rotulo}</span>
                    `;
                    label.appendChild(tag);
                }
            }
        }

        function liberarCampoBloqueado(input) {
            if (!input) return;
            input.removeAttribute('readonly');
            input.removeAttribute('disabled');
            input.removeAttribute('tabindex');
            const wrapper = input.closest('.campo-grupo') || input.closest('.frete-coluna') || input.closest('.linha-despesa-item') || input.parentElement;
            if (wrapper) {
                wrapper.classList.remove('campo-bloqueado-gestao');
                const pickers = wrapper.querySelectorAll('.input-picker-data-nativo, input[type="date"]');
                pickers.forEach(p => {
                    p.removeAttribute('disabled');
                    p.disabled = false;
                });
                const btnsPicker = wrapper.querySelectorAll('.btn-picker-data');
                btnsPicker.forEach(b => {
                    b.removeAttribute('disabled');
                    b.disabled = false;
                    b.style.pointerEvents = 'auto';
                    b.style.opacity = '1';
                    b.style.cursor = 'pointer';
                });
                const tags = wrapper.querySelectorAll('.tag-bloqueado-frota, .tag-bloqueado-adm');
                tags.forEach(t => t.remove());
                const label = wrapper.closest('.frete-coluna')?.querySelector('label');
                if (label) {
                    label.querySelectorAll('.tag-bloqueado-frota, .tag-bloqueado-adm').forEach(t => t.remove());
                }
            }
        }

        // Conecta botões de troca de visão (modo teste / apresentação)
        const btnAlternarMotorista = document.getElementById('btn-alternar-modo-motorista');
        const btnAlternarAdmin = document.getElementById('btn-alternar-modo-admin');
        if (btnAlternarMotorista && !btnAlternarMotorista.dataset.bound) {
            btnAlternarMotorista.dataset.bound = 'true';
            btnAlternarMotorista.addEventListener('click', () => window.alternarPerfil('motorista'));
        }
        if (btnAlternarAdmin && !btnAlternarAdmin.dataset.bound) {
            btnAlternarAdmin.dataset.bound = 'true';
            btnAlternarAdmin.addEventListener('click', () => window.alternarPerfil('admin'));
        }

        // -------------------------------------------------------------
        // CASO A: MODO ADMINISTRADOR (Conferência 100% Liberada)
        // -------------------------------------------------------------
        if (isModoAdmin) {
            if (barraAdmin) barraAdmin.classList.add('ativa');
            if (barraMotorista) barraMotorista.style.display = 'none';

            // 1. Liberação total dos campos sob governança da empresa
            camposGovernançaFrota.forEach(input => liberarCampoBloqueado(input));

            // Liberação das 3 colunas de frete para a Gestão / Administrador
            const inputsValorFrete = Array.from(document.querySelectorAll('.input-valor-frete-ml'));
            const inputsComissaoFrete = Array.from(document.querySelectorAll('.input-comissao-frete-ml'));
            const inputsDescargaFrete = Array.from(document.querySelectorAll('.input-descarga-frete-ml'));
            [...inputsValorFrete, ...inputsComissaoFrete, ...inputsDescargaFrete].forEach(input => {
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
                input.removeAttribute('tabindex');
                input.classList.remove('campo-bloqueado-gestao');
                const parentMoeda = input.closest('.tabela-moeda-wrap');
                if (parentMoeda) parentMoeda.classList.remove('campo-bloqueado-gestao');
            });

            // 2. Imposto Federal visível e livremente editável
            if (linhaImpostoFederal) linhaImpostoFederal.classList.remove('oculto-motorista');
            if (badgeImpostoObrigatorio) badgeImpostoObrigatorio.classList.remove('oculto-motorista');
            if (inputMlImpFederal) {
                liberarCampoBloqueado(inputMlImpFederal);
                inputMlImpFederal.removeAttribute('readonly');
            }

            // 3. Status de Pedágio
            if (badgePedagio) badgePedagio.textContent = '3 Linhas';

            // 4. Habilita seletores de data
            botoesPickerData.forEach(btn => {
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
            });

            // Abre o formulário oficial automaticamente para conferência
            toggleFormularioUnificado(true, false);

            let fichaCarregada = null;
            if (fichaIdUrl) {
                const todas = obterListaFichasCentral();
                fichaCarregada = todas.find(f => f.id === fichaIdUrl);
                if (fichaCarregada) {
                    atualizarDisplayNumeroFicha(fichaCarregada.id);
                    carregarFichaEmCampos(fichaCarregada);

                    if (adminTitulo) {
                        adminTitulo.innerHTML = `Conferência da Ficha: <strong>${fichaCarregada.id}</strong>`;
                    }
                    if (adminStatus) {
                        const aprovado = fichaCarregada.status === 'aprovado';
                        adminStatus.className = `status-pill ${aprovado ? 'status-concluido' : 'status-pendente'}`;
                        adminStatus.textContent = aprovado ? '🟢 Concluído / Aprovado' : '🟡 Pendente de Conferência';
                    }
                }
            }

            // Ação de Salvar Alterações pelo Administrador
            if (btnAdminSalvar) {
                btnAdminSalvar.addEventListener('click', () => {
                    const idSalvar = fichaCarregada ? fichaCarregada.id : fichaNumeroAtual;
                    atualizarFichaNaBase(idSalvar, false);
                    exibirToast(`Alterações da ficha ${idSalvar} salvas com sucesso!`, 'sucesso');
                });
            }

            // Ação de "Aprovar e Concluir Relatório" pelo Administrador
            if (btnAdminAprovar) {
                btnAdminAprovar.addEventListener('click', () => {
                    const idAprovar = fichaCarregada ? fichaCarregada.id : fichaNumeroAtual;
                    if (!confirm(`Confirmar a homologação e aprovação definitiva do Relatório de Viagem ${idAprovar}?`)) {
                        return;
                    }

                    atualizarFichaNaBase(idAprovar, true);
                    sessionStorage.setItem('ajborges_toast_mensagem', `Relatório ${idAprovar} APROVADO e CONCLUÍDO com sucesso!`);

                    // Retorna suavemente ao Dashboard Administrativo na seção de fichas
                    setTimeout(() => {
                        window.location.href = 'dashboard-admin.html#fichas';
                    }, 500);
                });
            }

            return;
        }

        // -------------------------------------------------------------
        // CASO B: MODO VISUALIZAÇÃO (Ficha Concluída)
        // -------------------------------------------------------------
        if (isModoView && fichaIdUrl) {
            const todas = obterListaFichasCentral();
            const fichaView = todas.find(f => f.id === fichaIdUrl);
            if (fichaView) {
                atualizarDisplayNumeroFicha(fichaView.id);
                carregarFichaEmCampos(fichaView);
                toggleFormularioUnificado(true, false);

                // Bloqueia todos os inputs para leitura
                document.querySelectorAll('#form-relatorio input, #form-relatorio select').forEach(el => {
                    el.setAttribute('readonly', 'true');
                    el.setAttribute('disabled', 'true');
                });

                if (barraMotorista) {
                    barraMotorista.innerHTML = `
                        <div class="motorista-info-left">
                            <span class="motorista-icone-tag">🟢</span>
                            <div class="motorista-texto-aviso">
                                <strong>Relatório de Viagem Homologado e Concluído</strong><br>
                                <span>Esta ficha (${fichaView.id}) já foi conferida e aprovada pela Gestão Operacional da AJBorges.</span>
                            </div>
                        </div>
                        <div class="motorista-info-right">
                            <button type="button" class="btn-minhas-viagens" onclick="window.history.back()">
                                ⬅ Voltar
                            </button>
                        </div>
                    `;
                }
            }
            return;
        }

        // -------------------------------------------------------------
        // CASO C: MODO MOTORISTA (Com Permissões e Campos Bloqueados)
        // -------------------------------------------------------------
        if (barraAdmin) barraAdmin.classList.remove('ativa');
        if (barraMotorista) barraMotorista.style.display = 'flex';

        // 1. Aplicação de Bloqueio nos Campos Sob Governança da Gestão
        camposGovernançaFrota.forEach(input => aplicarBloqueioCampo(input, 'Definido pela Gestão'));

        // Bloqueio das 3 colunas da tabela de fretes para o motorista (VALOR FRETE, COMISSÃO e DESCARGA)
        const inputsValorFrete = Array.from(document.querySelectorAll('.input-valor-frete-ml'));
        const inputsComissaoFrete = Array.from(document.querySelectorAll('.input-comissao-frete-ml'));
        const inputsDescargaFrete = Array.from(document.querySelectorAll('.input-descarga-frete-ml'));
        [...inputsValorFrete, ...inputsComissaoFrete, ...inputsDescargaFrete].forEach(input => {
            input.setAttribute('readonly', 'true');
            input.setAttribute('tabindex', '-1');
            input.classList.add('campo-bloqueado-gestao');
            const parentMoeda = input.closest('.tabela-moeda-wrap');
            if (parentMoeda) parentMoeda.classList.add('campo-bloqueado-gestao');
        });

        // 2. Ocultação total do campo sensível: Imposto Federal (IRRF / INSS / SEST / SENAT)
        if (linhaImpostoFederal) linhaImpostoFederal.classList.add('oculto-motorista');
        if (badgeImpostoObrigatorio) badgeImpostoObrigatorio.classList.add('oculto-motorista');

        // 3. Status de Pedágio
        if (badgePedagio) badgePedagio.textContent = 'Definido pela Gestão';

        // 4. Desabilita seletores de data
        botoesPickerData.forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        });

        // Abre automaticamente o formulário oficial para lançamento de fretes e diesel
        toggleFormularioUnificado(true, false);

        // Verifica estado do Motorista (Com Login ou Sem Login)
        const motoristaSaudacao = document.getElementById('motorista-saudacao-texto');
        const motoristaBotoesLogado = document.getElementById('motorista-botoes-logado');
        const badgeTotalMinhas = document.getElementById('badge-total-minhas-viagens');
        const btnAbrirMinhasViagens = document.getElementById('btn-abrir-minhas-viagens');

        const isMotoristaLogado = usuarioAtivo && usuarioAtivo.role === 'motorista';

        if (isMotoristaLogado) {
            const nomeMotoristaValido = (usuarioAtivo.nome && usuarioAtivo.nome !== 'Carlos Eduardo Ferreira') ? usuarioAtivo.nome : '';
            if (inputMotorista) {
                if (nomeMotoristaValido) {
                    let opt = Array.from(inputMotorista.options).find(o => o.value.toUpperCase() === nomeMotoristaValido.toUpperCase());
                    if (!opt) {
                        const o = document.createElement('option');
                        o.value = nomeMotoristaValido;
                        o.textContent = nomeMotoristaValido;
                        inputMotorista.appendChild(o);
                    }
                    inputMotorista.value = nomeMotoristaValido;
                    inputMotorista.style.pointerEvents = 'none';
                    inputMotorista.style.backgroundColor = '#f8fafc';
                    inputMotorista.setAttribute('tabindex', '-1');

                    // Vínculo automático inicial da placa para o motorista logado
                    if (inputPlacas && !inputPlacas.value && mapaMotoristaPlaca[nomeMotoristaValido.toUpperCase()]) {
                        inputPlacas.value = mapaMotoristaPlaca[nomeMotoristaValido.toUpperCase()];
                    }
                } else {
                    inputMotorista.style.pointerEvents = '';
                    inputMotorista.style.backgroundColor = '';
                    inputMotorista.removeAttribute('tabindex');
                }
            }
            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Olá, <strong>${nomeMotoristaValido || 'Motorista'}</strong> • Conectado via Portal`;
            }
            if (motoristaBotoesLogado) {
                motoristaBotoesLogado.style.display = 'block';
            }

            // Atualiza contador de "Minhas Viagens"
            atualizarContadorMinhasViagens();

            if (btnAbrirMinhasViagens) {
                btnAbrirMinhasViagens.addEventListener('click', abrirModalMinhasViagens);
            }
        } else {
            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Portal da Frota • Modo Motorista`;
            }
            if (motoristaBotoesLogado) {
                motoristaBotoesLogado.style.display = 'none';
            }
        }
    }

    function atualizarContadorMinhasViagens() {
        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivo = null;
        if (usuarioAtivoStr) {
            try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
        }
        if (!usuarioAtivo || usuarioAtivo.role !== 'motorista') return;

        const todas = obterListaFichasCentral();
        const minhas = todas.filter(f => f.motoristaId === usuarioAtivo.id || f.motorista === usuarioAtivo.nome);
        const badge = document.getElementById('badge-total-minhas-viagens');
        if (badge) badge.textContent = minhas.length;
    }

    function atualizarFichaNaBase(idFicha, marcarComoAprovado = false) {
        let todas = obterListaFichasCentral();
        let index = todas.findIndex(f => f.id === idFicha);

        const dadosAtualizados = {
            id: idFicha,
            protocolo: idFicha,
            dataSaida: inputDataSaida?.value || '',
            dataChegada: inputDataChegada?.value || '',
            motorista: inputMotorista?.value.trim() || 'Motorista',
            placas: inputPlacas?.value || '',
            destinoInicial: inputDestinoInicial?.value || '',
            destinoFinal: inputDestinoFinal?.value || '',
            kmSaida: inputKmSaida?.value || '',
            kmChegada: inputKmChegada?.value || '',
            kmTotal: inputKmTotal?.value || '',
            valorAdiantamento: inputAdiantamento?.value || '',
            freteOrigem: inputFreteOrigem?.value || '',
            retorno1: inputRetorno1?.value || '',
            retorno2: inputRetorno2?.value || '',
            retorno3: inputRetorno3?.value || '',
            totalFrete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
            vrComissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
            fretes: coletarFretesAtuais(),
            abastecimentos: coletarAbastecimentosAtuais(),
            totalAbastecimento: document.getElementById('ml-total-abast-valor')?.value || '0,00',
            totalLitros: document.getElementById('ml-total-abast-litros')?.value || '0,00',
            mediaKmL: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
            pedagios: [
                inputsPedagioMl[0]?.value || '',
                inputsPedagioMl[1]?.value || '',
                inputsPedagioMl[2]?.value || ''
            ],
            totalPedagio: (parseMoeda(inputsPedagioMl[0]?.value) + parseMoeda(inputsPedagioMl[1]?.value) + parseMoeda(inputsPedagioMl[2]?.value)).toFixed(2).replace('.', ','),
            impFederal: inputMlImpFederal?.value || '',
            outrasDespesas: coletarOutrasDespesasAtuais(),
            totalDespesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
            resultadoViagem: document.getElementById('ml-indicador-resultado-viagem')?.textContent?.replace('R$', '')?.trim() || '0,00',
            saldoComissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
            anexos: arquivosComprovantesMl || []
        };

        if (marcarComoAprovado) {
            dadosAtualizados.status = 'aprovado';
            dadosAtualizados.dataAprovacao = new Date().toLocaleString('pt-BR');
            dadosAtualizados.aprovadoPor = 'operacional@ajborges.com';
        }

        if (index >= 0) {
            todas[index] = { ...todas[index], ...dadosAtualizados };
        } else {
            dadosAtualizados.dataEnvio = new Date().toLocaleString('pt-BR');
            dadosAtualizados.status = marcarComoAprovado ? 'aprovado' : 'pendente';
            todas.unshift(dadosAtualizados);
        }

        salvarListaFichasCentral(todas);
    }

    // Modal de Minhas Viagens do Motorista
    function abrirModalMinhasViagens() {
        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivo = null;
        if (usuarioAtivoStr) {
            try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
        }
        if (!usuarioAtivo) return;

        const todas = obterListaFichasCentral();
        const minhas = todas.filter(f => f.motoristaId === usuarioAtivo.id || f.motorista === usuarioAtivo.nome);

        const modal = document.getElementById('modal-lista-minhas-viagens');
        const tbody = document.getElementById('tabela-minhas-viagens-body');
        const empty = document.getElementById('minhas-viagens-empty');
        const sub = document.getElementById('subtitulo-motorista-minhas-viagens');

        if (sub) sub.textContent = `Relatórios de ${usuarioAtivo.nome || 'Motorista'}`;

        if (tbody) {
            tbody.innerHTML = '';
            if (minhas.length === 0) {
                if (empty) empty.style.display = 'block';
            } else {
                if (empty) empty.style.display = 'none';
                minhas.forEach(m => {
                    const isPendente = m.status === 'pendente';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${m.id}</strong></td>
                        <td>${m.dataEnvio || m.dataSaida || '-'}</td>
                        <td>${m.destinoInicial || '-'} ➔ ${m.destinoFinal || 'SP'}</td>
                        <td><strong style="color: #047857;">R$ ${m.totalFrete || '0,00'}</strong></td>
                        <td>
                            <span class="status-pill ${isPendente ? 'status-pendente' : 'status-concluido'}">
                                ${isPendente ? '🟡 Pendente de Aprovação' : '🟢 Concluído'}
                            </span>
                        </td>
                        <td style="text-align: right;">
                            <a href="relatorio-viagem.html?ficha=${m.id}&mode=view" class="btn-minhas-viagens" style="padding: 4px 10px; font-size: 0.78rem;">
                                Ver Ficha
                            </a>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        if (modal) modal.classList.add('ativo');
    }

    // Fechar Modais
    const btnFecharMinhasViagens = document.getElementById('btn-fechar-minhas-viagens');
    const btnFecharMinhasViagensRodape = document.getElementById('btn-fechar-minhas-viagens-rodape');
    if (btnFecharMinhasViagens) {
        btnFecharMinhasViagens.addEventListener('click', () => {
            document.getElementById('modal-lista-minhas-viagens')?.classList.remove('ativo');
        });
    }
    if (btnFecharMinhasViagensRodape) {
        btnFecharMinhasViagensRodape.addEventListener('click', () => {
            document.getElementById('modal-lista-minhas-viagens')?.classList.remove('ativo');
        });
    }

    // Modal Sem Login - Copiar Protocolo
    const btnCopiarSemLogin = document.getElementById('btn-copiar-protocolo-sem-login');
    if (btnCopiarSemLogin) {
        btnCopiarSemLogin.addEventListener('click', () => {
            const num = document.getElementById('modal-num-protocolo-sem-login')?.textContent || '';
            navigator.clipboard.writeText(num).then(() => {
                exibirToast(`Protocolo ${num} copiado para a área de transferência!`, 'sucesso');
            });
        });
    }

    // Modal Sem Login - Novo Envio
    const btnNovoEnvioSemLogin = document.getElementById('btn-novo-envio-sem-login');
    if (btnNovoEnvioSemLogin) {
        btnNovoEnvioSemLogin.addEventListener('click', () => {
            window.location.href = 'relatorio-viagem.html';
        });
    }

    // Modal Com Login - Ir para Minhas Viagens
    const btnModalIrMinhasViagens = document.getElementById('btn-modal-ir-minhas-viagens');
    if (btnModalIrMinhasViagens) {
        btnModalIrMinhasViagens.addEventListener('click', () => {
            document.getElementById('modal-protocolo-com-login')?.classList.remove('ativo');
            abrirModalMinhasViagens();
        });
    }

    // Modal Com Login - Novo Envio
    const btnNovoEnvioComLogin = document.getElementById('btn-novo-envio-com-login');
    if (btnNovoEnvioComLogin) {
        btnNovoEnvioComLogin.addEventListener('click', () => {
            window.location.href = 'relatorio-viagem.html';
        });
    }

    // =========================================================================
    // FINALIZAR E ENVIAR RELATÓRIO DE VIAGEM (MOTORISTA)
    // =========================================================================
    const btnFinalizarRelatorioMl = document.getElementById('btn-finalizar-relatorio-ml');
    if (btnFinalizarRelatorioMl) {
        btnFinalizarRelatorioMl.addEventListener('click', (e) => {
            e.preventDefault();

            const motoristaPreenchido = inputMotorista && inputMotorista.value.trim() !== '';
            const impostoFederalPreenchido = inputMlImpFederal && inputMlImpFederal.value.trim() !== '';

            // Valida identificação do motorista
            if (!motoristaPreenchido) {
                exibirToast('Por favor, informe o nome do Motorista.', 'erro');
                if (inputMotorista) inputMotorista.focus();
                return;
            }

            // Valida Imposto Federal obrigatório
            if (!impostoFederalPreenchido) {
                exibirToast('O valor do Imposto Federal é obrigatório no relatório.', 'erro');
                if (inputMlImpFederal) inputMlImpFederal.focus();
                return;
            }

            // Verifica se há pelo menos um frete ou abastecimento preenchido
            const fretesAtuais = coletarFretesAtuais();
            const abastsAtuais = coletarAbastecimentosAtuais();

            if (fretesAtuais.length === 0 && abastsAtuais.length === 0) {
                exibirToast('Lance pelo menos um frete ou abastecimento na operação.', 'erro');
                return;
            }

            // Gera Identificador Único da Ficha (ex: AJB-2026-004)
            const novoNumeroSeq = obterProximoNumeroFicha();
            const novoIdFicha = formatarNumeroFicha(novoNumeroSeq);

            // Recupera usuário ativo
            const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
            let usuarioAtivo = null;
            if (usuarioAtivoStr) {
                try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
            }
            const isComLogin = usuarioAtivo && usuarioAtivo.role === 'motorista';

            // Monta objeto completo da nova ficha
            const agoraDataHora = new Date().toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const novaFicha = {
                id: novoIdFicha,
                protocolo: novoIdFicha,
                dataEnvio: agoraDataHora,
                dataSaida: inputDataSaida?.value || '24/09/2026',
                dataChegada: inputDataChegada?.value || '24/09/2026',
                motoristaId: isComLogin ? usuarioAtivo.id : 'anonimo',
                motorista: inputMotorista.value.trim(),
                origemEnvio: isComLogin ? 'motorista_com_login' : 'motorista_sem_login',
                placas: inputPlacas?.value || 'A definir pela Gestão',
                destinoInicial: inputDestinoInicial?.value || (fretesAtuais[0]?.origem || 'Origem'),
                destinoFinal: inputDestinoFinal?.value || (fretesAtuais[fretesAtuais.length - 1]?.destino || 'Destino'),
                kmSaida: inputKmSaida?.value || '',
                kmChegada: inputKmChegada?.value || '',
                kmTotal: inputKmTotal?.value || '',
                valorAdiantamento: inputAdiantamento?.value || '',
                freteOrigem: inputFreteOrigem?.value || (fretesAtuais[0]?.valor || '0,00'),
                retorno1: inputRetorno1?.value || '',
                retorno2: inputRetorno2?.value || '',
                retorno3: inputRetorno3?.value || '',
                totalFrete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
                vrComissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
                fretes: fretesAtuais,
                abastecimentos: abastsAtuais,
                totalAbastecimento: document.getElementById('ml-total-abast-valor')?.value || '0,00',
                totalLitros: document.getElementById('ml-total-abast-litros')?.value || '0,00',
                mediaKmL: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
                pedagios: [
                    inputsPedagioMl[0]?.value || '',
                    inputsPedagioMl[1]?.value || '',
                    inputsPedagioMl[2]?.value || ''
                ],
                totalPedagio: (parseMoeda(inputsPedagioMl[0]?.value) + parseMoeda(inputsPedagioMl[1]?.value) + parseMoeda(inputsPedagioMl[2]?.value)).toFixed(2).replace('.', ','),
                impFederal: inputMlImpFederal?.value || '',
                outrasDespesas: coletarOutrasDespesasAtuais(),
                totalDespesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
                resultadoViagem: document.getElementById('ml-indicador-resultado-viagem')?.textContent?.replace('R$', '')?.trim() || '0,00',
                saldoComissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
                anexos: arquivosComprovantesMl || [],
                status: 'pendente'
            };

            // Salva na fila central de fichas
            const todasFichas = obterListaFichasCentral();
            todasFichas.unshift(novaFicha);
            salvarListaFichasCentral(todasFichas);

            // Incrementa contador sequencial
            localStorage.setItem(STORAGE_FICHA_KEY, novoNumeroSeq + 1);

            // Limpa rascunho temporário
            localStorage.removeItem(STORAGE_ML_KEY);

            // Dispara feedback de acordo com o login do motorista
            if (!isComLogin) {
                // SEM LOGIN: Exibe modal com o protocolo único gerado
                const modalSemLogin = document.getElementById('modal-protocolo-sem-login');
                const elNum = document.getElementById('modal-num-protocolo-sem-login');
                const elHora = document.getElementById('modal-data-envio-sem-login');

                if (elNum) elNum.textContent = novoIdFicha;
                if (elHora) elHora.textContent = agoraDataHora;
                if (modalSemLogin) modalSemLogin.classList.add('ativo');

                exibirToast(`Ficha ${novoIdFicha} transmitida com sucesso para a Gestão!`, 'sucesso');
            } else {
                // COM LOGIN: Exibe confirmação com status 🟡 Pendente de Aprovação
                const modalComLogin = document.getElementById('modal-protocolo-com-login');
                const elNum = document.getElementById('modal-num-protocolo-com-login');

                if (elNum) elNum.textContent = novoIdFicha;
                if (modalComLogin) modalComLogin.classList.add('ativo');

                atualizarContadorMinhasViagens();
                exibirToast(`Ficha ${novoIdFicha} vinculada ao seu cadastro e enviada com sucesso!`, 'sucesso');
            }
        });
    }

    // Salvar progresso ao digitar nos campos e prevenir submit padrão
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
        form.addEventListener('input', () => {
            salvarProgressoMl();
        });
    }

    // Sincronização inicial com Google Sheets e vinculação Motorista <-> Placa
    sincronizarComGoogleSheets();
    configurarVinculoMotoristaPlaca();

    window.carregarProgressoMl = carregarProgressoMl;
    carregarProgressoMl();

    // Dispara a configuração completa do ciclo de vida
    configurarCicloDeVidaViagem();
});

// ==========================================================================
// INTEGRAÇÃO EM TEMPO REAL: GOOGLE SHEETS (FROTA AJBORGES)
// ==========================================================================
// Integração EXCLUSIVAMENTE DE LEITURA (HTTP GET). Planilha 100% intacta.
const LINK_GOOGLE_SHEETS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSD4-GWAn_bNswB31LnjIBVezbRNYxd0NjnXaekV6uiE5D2LN-GdGX2Q1o6HxqcRTtqAGJGkCQx4wF6/pub?gid=1654915875&single=true&output=csv';
const CHAVE_CACHE_GOOGLE_SHEETS = 'ajborges_cadastros_sheets_cache';

const mapaMotoristaPlaca = {};
const mapaPlacaMotorista = {};

/**
 * Parser seguro de CSV para células com aspas, vírgulas e quebras
 */
function parsearCSVGoogleSheets(texto) {
    const linhas = [];
    let linhaAtual = [];
    let campoAtual = '';
    let dentroAspas = false;

    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        const prox = texto[i + 1];

        if (c === '"') {
            if (dentroAspas && prox === '"') {
                campoAtual += '"';
                i++;
            } else {
                dentroAspas = !dentroAspas;
            }
        } else if (c === ',' && !dentroAspas) {
            linhaAtual.push(campoAtual.trim());
            campoAtual = '';
        } else if ((c === '\r' || c === '\n') && !dentroAspas) {
            if (c === '\r' && prox === '\n') i++;
            linhaAtual.push(campoAtual.trim());
            if (linhaAtual.some(col => col !== '')) {
                linhas.push(linhaAtual);
            }
            linhaAtual = [];
            campoAtual = '';
        } else {
            campoAtual += c;
        }
    }
    if (campoAtual !== '' || linhaAtual.length > 0) {
        linhaAtual.push(campoAtual.trim());
        if (linhaAtual.some(col => col !== '')) {
            linhas.push(linhaAtual);
        }
    }
    return linhas;
}

/**
 * Popula um elemento <select> preservando o valor atualmente selecionado
 */
function preencherSelectDinamico(selectElement, opcoes, placeholder) {
    if (!selectElement) return;

    // Preserva o valor selecionado
    const valorAtual = selectElement.value || selectElement.getAttribute('data-valor-pendente') || '';

    selectElement.innerHTML = '';
    const optPadrao = document.createElement('option');
    optPadrao.value = '';
    optPadrao.textContent = placeholder;
    selectElement.appendChild(optPadrao);

    let valorEncontrado = false;

    opcoes.forEach(item => {
        if (!item) return;
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        if (valorAtual && item.toUpperCase() === valorAtual.toUpperCase()) {
            opt.selected = true;
            valorEncontrado = true;
        }
        selectElement.appendChild(opt);
    });

    // Se havia um valor previamente selecionado e ele não consta na lista, mantém para não perder dados
    if (valorAtual && !valorEncontrado) {
        const optExtra = document.createElement('option');
        optExtra.value = valorAtual;
        optExtra.textContent = valorAtual;
        optExtra.selected = true;
        selectElement.appendChild(optExtra);
    }
}

/**
 * Aplica os dados estruturados aos selects da página
 */
function aplicarDadosNosSelects(dados) {
    if (!dados) return;
    const { postos, motoristas, placas, vinculosMotoristaPlaca, vinculosPlacaMotorista } = dados;

    if (vinculosMotoristaPlaca) {
        Object.assign(mapaMotoristaPlaca, vinculosMotoristaPlaca);
    }
    if (vinculosPlacaMotorista) {
        Object.assign(mapaPlacaMotorista, vinculosPlacaMotorista);
    }

    // 1. Select de Motorista
    const campoMotorista = document.getElementById('motorista');
    if (campoMotorista) {
        preencherSelectDinamico(campoMotorista, motoristas, 'Selecione o motorista...');
    }

    // 2. Select de Placas
    const campoPlacas = document.getElementById('placas');
    if (campoPlacas) {
        preencherSelectDinamico(campoPlacas, placas, 'Selecione a placa...');
    }

    // 3. Selects de Postos de Combustível (todas as 10 linhas de combustível)
    for (let i = 1; i <= 10; i++) {
        const selectPosto = document.querySelector(`select[name="posto_ml_${i}"]`);
        if (selectPosto) {
            preencherSelectDinamico(selectPosto, postos, 'Selecione o posto...');
        }
    }

    // Vínculo inicial se um já estiver preenchido e o outro não
    if (campoMotorista && campoMotorista.value && campoPlacas && !campoPlacas.value) {
        const placa = mapaMotoristaPlaca[campoMotorista.value.trim().toUpperCase()];
        if (placa) campoPlacas.value = placa;
    } else if (campoPlacas && campoPlacas.value && campoMotorista && !campoMotorista.value) {
        const mot = mapaPlacaMotorista[campoPlacas.value.trim().toUpperCase()];
        if (mot) campoMotorista.value = mot;
    }
}

/**
 * Extrai, desduplica e ordena os dados da planilha
 */
function processarLinhasPlanilha(linhas) {
    const motoristasSet = new Set();
    const placasSet = new Set();
    const postosSet = new Set();
    const vinculosMotoristaPlaca = {};
    const vinculosPlacaMotorista = {};

    // Pula linha 0 de cabeçalho
    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i];
        const placa = (colunas[0] || '').trim();
        const posto = (colunas[1] || '').trim();
        const motorista = (colunas[2] || '').trim();

        if (placa) placasSet.add(placa);
        if (posto) postosSet.add(posto);
        if (motorista) motoristasSet.add(motorista);

        if (motorista && placa) {
            vinculosMotoristaPlaca[motorista.toUpperCase()] = placa;
            if (!vinculosPlacaMotorista[placa.toUpperCase()]) {
                vinculosPlacaMotorista[placa.toUpperCase()] = motorista;
            }
        }
    }

    return {
        motoristas: Array.from(motoristasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        placas: Array.from(placasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        postos: Array.from(postosSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        vinculosMotoristaPlaca,
        vinculosPlacaMotorista,
        timestamp: Date.now()
    };
}

/**
 * Sincronização automática em tempo real via HTTP GET com fallback offline
 */
async function sincronizarComGoogleSheets() {
    // 1. Tenta restaurar do cache local imediatamente para renderização ultrarrápida
    try {
        const cacheSalvo = localStorage.getItem(CHAVE_CACHE_GOOGLE_SHEETS);
        if (cacheSalvo) {
            const dadosCache = JSON.parse(cacheSalvo);
            if (dadosCache && Array.isArray(dadosCache.postos)) {
                aplicarDadosNosSelects(dadosCache);
            }
        }
    } catch (e) {
        console.warn('Cache offline de cadastros indisponível:', e);
    }

    // 2. Busca a versão mais atualizada diretamente na planilha (Exclusivamente GET)
    try {
        const resposta = await fetch(LINK_GOOGLE_SHEETS_CSV, {
            method: 'GET',
            headers: { 'Accept': 'text/csv, text/plain, */*' }
        });

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        const textoCSV = await resposta.text();
        const linhas = parsearCSVGoogleSheets(textoCSV);

        if (linhas.length <= 1) return;

        const dadosAtualizados = processarLinhasPlanilha(linhas);

        // Aplica os novos dados aos selects
        aplicarDadosNosSelects(dadosAtualizados);

        // Salva cópia atualizada no localStorage para fallback
        localStorage.setItem(CHAVE_CACHE_GOOGLE_SHEETS, JSON.stringify(dadosAtualizados));
    } catch (erro) {
        console.warn('Operando com dados locais/cache do Google Sheets:', erro);
    }
}

/**
 * Vínculo automático e bidirecional: Motorista <-> Placa
 */
function configurarVinculoMotoristaPlaca() {
    const campoMotorista = document.getElementById('motorista');
    const campoPlacas = document.getElementById('placas');

    if (campoMotorista && campoPlacas) {
        // Ao selecionar Motorista -> seleciona a Placa vinculada
        ['change', 'input'].forEach(ev => {
            campoMotorista.addEventListener(ev, () => {
                const nome = campoMotorista.value.trim().toUpperCase();
                if (!nome) return;

                const placaVinculada = mapaMotoristaPlaca[nome];
                if (placaVinculada) {
                    let opt = Array.from(campoPlacas.options).find(o => o.value.toUpperCase() === placaVinculada.toUpperCase());
                    if (opt) {
                        campoPlacas.value = opt.value;
                    } else {
                        const novaOpt = document.createElement('option');
                        novaOpt.value = placaVinculada;
                        novaOpt.textContent = placaVinculada;
                        campoPlacas.appendChild(novaOpt);
                        campoPlacas.value = placaVinculada;
                    }
                    if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
                }
            });
        });

        // Ao selecionar Placa -> seleciona o Motorista vinculado
        ['change', 'input'].forEach(ev => {
            campoPlacas.addEventListener(ev, () => {
                const placa = campoPlacas.value.trim().toUpperCase();
                if (!placa) return;

                const motoristaVinculado = mapaPlacaMotorista[placa];
                if (motoristaVinculado) {
                    let opt = Array.from(campoMotorista.options).find(o => o.value.toUpperCase() === motoristaVinculado.toUpperCase());
                    if (opt) {
                        campoMotorista.value = opt.value;
                    } else {
                        const novaOpt = document.createElement('option');
                        novaOpt.value = motoristaVinculado;
                        novaOpt.textContent = motoristaVinculado;
                        campoMotorista.appendChild(novaOpt);
                        campoMotorista.value = motoristaVinculado;
                    }
                    if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
                }
            });
        });
    }
}

// Exposição global das funções para acesso ou recarregamento manual
window.sincronizarComGoogleSheets = sincronizarComGoogleSheets;
window.configurarVinculoMotoristaPlaca = configurarVinculoMotoristaPlaca;

