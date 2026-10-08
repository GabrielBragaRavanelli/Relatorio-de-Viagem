// ==========================================
// AJBorges - Script do Relatório de Viagem
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------
    // Route Guard: Proteção de Acesso
    // ------------------------------------------
    const STORAGE_USER_ACTIVE = 'ajborges_usuario_ativo';
    const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
    let usuarioAtivo = null;
    if (usuarioAtivoStr) {
        try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
    }
    const urlParamsInit = new URLSearchParams(window.location.search);
    const modeUrlInit = urlParamsInit.get('mode');

    if (!usuarioAtivo) {
        if (modeUrlInit === 'admin') {
            usuarioAtivo = { role: 'admin', nome: 'Administrador Central', email: 'admin@ajborges.com' };
            localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuarioAtivo));
        } else {
            window.location.href = 'Login.html';
            return;
        }
    } else if (modeUrlInit === 'admin' && usuarioAtivo.role !== 'admin') {
        usuarioAtivo.role = 'admin';
        localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuarioAtivo));
    }

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

    // Limpeza de exemplo mockado no armazenamento e input
    try {
        const uAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        if (uAtivoStr) {
            const uAtivo = JSON.parse(uAtivoStr);
            if (uAtivo && uAtivo.nome === 'Carlos Eduardo Ferreira' && uAtivo.role !== 'admin') {
                uAtivo.nome = '';
                localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(uAtivo));
            }
        }
    } catch (e) { }
    if (inputMotorista && inputMotorista.value === 'Carlos Eduardo Ferreira') {
        inputMotorista.value = '';
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
    // 1. Formatação e Máscara Estrita de Placas (7 caracteres alfanuméricos)
    // ------------------------------------------
    if (inputPlacas) {
        let apagandoPlaca = false;

        inputPlacas.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                apagandoPlaca = true;
                // Se terminar com '-', remove o hífen e a letra anterior para não travar o cursor
                if (inputPlacas.value.endsWith('-')) {
                    e.preventDefault();
                    const limpo = inputPlacas.value.replace(/[^A-Z0-9]/g, '');
                    inputPlacas.value = limpo.slice(0, -1);
                }
            } else {
                apagandoPlaca = false;
            }
        });

        inputPlacas.addEventListener('input', (e) => {
            // Converte automaticamente para maiúsculas e aceita apenas caracteres alfanuméricos (máximo 7)
            let limpo = (e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

            if (limpo.length > 3) {
                e.target.value = limpo.slice(0, 3) + '-' + limpo.slice(3);
            } else if (limpo.length === 3) {
                if (!apagandoPlaca && e.inputType !== 'deleteContentBackward') {
                    e.target.value = limpo + '-';
                } else {
                    e.target.value = limpo;
                }
            } else {
                e.target.value = limpo;
            }
        });

        // Validação ao sair do campo (blur)
        inputPlacas.addEventListener('blur', () => {
            if (inputPlacas.readOnly || inputPlacas.disabled) return;
            const limpo = (inputPlacas.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (limpo.length > 0 && limpo.length < 7) {
                exibirToast('A placa deve conter obrigatoriamente exatamente 7 caracteres alfanuméricos (Ex: GAB-1234 ou GAB-1C34).', 'erro');
                inputPlacas.focus();
            }
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

    // Formatação de Litros: números inteiros (ex: 500 -> 500, 150000 -> 150.000) ou decimais (ex: 150000,50 -> 150.000,5).
    function formatarLitros(num) {
        if (num === null || num === undefined || num === '') return '0';
        if (typeof num === 'string') num = parseLitros(num);
        if (isNaN(num) || num === 0) return '0';
        if (Number.isInteger(num)) {
            return num.toLocaleString('pt-BR');
        }
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        });
    }

    function parseLitros(str) {
        if (str === null || str === undefined || str === '') return 0;
        if (typeof str === 'number') return isNaN(str) ? 0 : str;
        let s = str.toString().trim();
        if (!s) return 0;

        // Se contém vírgula (ex: "150.000,50" -> 150000.5, "150000,5" -> 150000.5, "500,5" -> 500.5)
        if (s.includes(',')) {
            const partes = s.split(',');
            const intPart = partes[0].replace(/\D/g, '');
            const decPart = partes.slice(1).join('').replace(/\D/g, '');
            const n = parseFloat((intPart || '0') + (decPart ? '.' + decPart : ''));
            return isNaN(n) ? 0 : n;
        }

        // Se NÃO contém vírgula: trata como inteiro em litros com ou sem separador de milhar pt-BR (ex: "150000" -> 150000, "150.000" -> 150000, "15.000" -> 15000, "500" -> 500)
        // Elimina qualquer fatiamento arbitrário dos últimos 3 dígitos!
        const digitos = s.replace(/\D/g, '');
        if (!digitos) return 0;
        const n = parseInt(digitos, 10);
        return isNaN(n) ? 0 : n;
    }

    function formatarTextoLitros(val) {
        if (val === null || val === undefined || val === '') return '';
        const num = parseLitros(val);
        if (num === 0) return '';
        return formatarLitros(num);
    }

    function aplicarMascaraLitros(input, callback) {
        if (!input) return;

        // Ao focar no campo: mantém o número editável limpo sem truncar dígitos
        // Remove pontos de milhar para facilitar a edição pelo usuário, preservando a vírgula se houver decimal
        input.addEventListener('focus', (e) => {
            const val = e.target.value;
            if (val) {
                if (val.includes(',')) {
                    const partes = val.split(',');
                    e.target.value = partes[0].replace(/\./g, '') + ',' + partes.slice(1).join('').replace(/\./g, '');
                } else {
                    e.target.value = val.replace(/\./g, '');
                }
            }
        });

        // Durante a digitação: aceita dígitos e vírgula decimal (converte ponto em vírgula)
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\./g, ',');
            val = val.replace(/[^0-9,]/g, '');
            const partes = val.split(',');
            if (partes.length > 2) {
                val = partes[0] + ',' + partes.slice(1).join('').substring(0, 3);
            } else if (partes.length === 2) {
                val = partes[0] + ',' + partes[1].substring(0, 3);
            }
            e.target.value = val;
            if (callback) callback();
        });

        // Ao perder o foco (blur): formata com separador de milhar pt-BR e decimais corretos
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

        if (!selectCli || !inputValFrete || !inputComissao) return;

        // Identifica perfil ativo (Admin vs Motorista)
        const urlParamsAtual = new URLSearchParams(window.location.search);
        const modeUrlAtual = urlParamsAtual.get('mode');
        const userSalvoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let userSalvo = null;
        try { if (userSalvoStr) userSalvo = JSON.parse(userSalvoStr); } catch (e) {}
        const isModoAdminAtivo = (modeUrlAtual === 'admin') || (userSalvo && (userSalvo.role === 'admin' || userSalvo.role === 'diretoria') && modeUrlAtual !== 'motorista');

        const tipoOperacao = selectCli.value;

        if (isModoAdminAtivo) {
            // No Modo Administrador: 100% livre e editável com recálculo em tempo real
            inputValFrete.removeAttribute('readonly');
            inputValFrete.removeAttribute('disabled');
            inputValFrete.classList.remove('campo-bloqueado-gestao');

            inputComissao.removeAttribute('readonly');
            inputComissao.removeAttribute('disabled');
            inputComissao.classList.remove('campo-bloqueado-gestao');

            if (tipoOperacao === 'mercado_livre') {
                if (acaoDisparadaPorSelect) inputComissao.value = '400,00';
            } else if (tipoOperacao === 'shopee') {
                const valorNum = parseMoeda(inputValFrete.value);
                if (valorNum > 0 && (acaoDisparadaPorSelect || !inputComissao.dataset.editadoManual)) {
                    inputComissao.value = formatarMoedaSemPrefixo(valorNum * 0.11);
                }
            } else if (tipoOperacao === 'alimenticio') {
                if (acaoDisparadaPorSelect) inputComissao.value = '';
            } else {
                if (acaoDisparadaPorSelect) {
                    inputValFrete.value = '';
                    inputComissao.value = '';
                }
            }
        } else {
            // No Modo Motorista: campos financeiros de frete protegidos com readonly
            inputValFrete.setAttribute('readonly', 'true');
            inputValFrete.classList.add('campo-bloqueado-gestao');
            inputComissao.setAttribute('readonly', 'true');
            inputComissao.classList.add('campo-bloqueado-gestao');

            if (tipoOperacao === 'mercado_livre') {
                inputComissao.value = '400,00';
            } else if (tipoOperacao === 'shopee') {
                const valorNum = parseMoeda(inputValFrete.value);
                if (valorNum > 0) {
                    inputComissao.value = formatarMoedaSemPrefixo(valorNum * 0.11);
                } else {
                    inputComissao.value = '';
                }
            } else if (tipoOperacao === 'alimenticio') {
                if (acaoDisparadaPorSelect) inputComissao.value = '';
            } else {
                if (acaoDisparadaPorSelect) {
                    inputValFrete.value = '';
                    inputComissao.value = '';
                }
            }
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

    // Lista Oficial dos Postos de Combustíveis Conveniados da AJBorges
    const POSTOS_COMBUSTIVEL_CONVENIADOS = [
        "Açailândia MA - Posto Magnólia 06",
        "Anaurilandia MS - Posto Lala (93)",
        "Arapora GO - Posto Decio",
        "Araquari SC - Posto Russi",
        "Campo Grande MS - Posto Fortaleza (IDEAL)",
        "Caxias do Sul RS - Posto Squizzato",
        "Centralina MG - Posto Decio",
        "Corumbataí SP - Monte Carlo",
        "Coxilha RS - Posto Buffon",
        "Dom Pedro de Alcântara RS - Posto Rota",
        "Guará SP - Posto Monte Carlo",
        "Gurupi TO - Posto Decio",
        "Juiz de Fora MG - Posto Dom Pedro",
        "Luz MG - Caxuxa Matriz",
        "Marília SP - Posto Esmeralda",
        "Marília SP - Posto Gigantão",
        "Mimoso do Sul ES - Posto Cajú",
        "Mirassol SP - Monte Carlo",
        "Moema MG - Posto Caxuxa",
        "Montes Claros MG - Posto D'Angelis",
        "Nova Santa Rita RS - Posto Buffon",
        "Olimpia SP - Posto Rei do Suco",
        "Passo Fundo RS - Posto Buffon",
        "Ribeirão Preto SP - Monte Carlo",
        "Rio Claro SP - Monte Carlo",
        "Santa Cecília SC - Posto Cesca & Cia",
        "Santópolis do Aguapeí SP - Posto Monte Carlo",
        "São Gonçalo do Sapucaí MG - Posto Caxuxa",
        "São José do Rio Preto SP - Posto Monte Carlo I",
        "Uberlandia MG - Posto Decio",
        "Varzea Grande MT - Monte Carlo",
        "Outro Posto / Não Listado"
    ];

    function popularSelectsPostosConvenidos() {
        const selectsPosto = document.querySelectorAll('.input-posto');
        selectsPosto.forEach(sel => {
            const valAtual = sel.value;
            sel.innerHTML = '<option value="">Selecione o posto...</option>';
            POSTOS_COMBUSTIVEL_CONVENIADOS.forEach(nomePosto => {
                const opt = document.createElement('option');
                opt.value = nomePosto;
                opt.textContent = nomePosto;
                sel.appendChild(opt);
            });
            if (valAtual) {
                sel.value = valAtual;
            }
        });
    }

    popularSelectsPostosConvenidos();

    for (let i = 1; i <= 10; i++) {
        const inputPosto = document.querySelector(`[name="posto_ml_${i}"]`);
        const inputNf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const inputKm = document.querySelector(`input[name="km_ml_${i}"]`);
        const inputValor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const inputLitros = document.querySelector(`input[name="litros_ml_${i}"]`);

        if (inputPosto) {
            const atualizarPosto = () => {
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            };
            inputPosto.addEventListener('change', atualizarPosto);
            inputPosto.addEventListener('input', atualizarPosto);
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
            const urlParams = new URLSearchParams(window.location.search);
            const fichaUrl = urlParams.get('ficha');
            const modeUrl = urlParams.get('mode');
            const usuarioAtualStr = localStorage.getItem(STORAGE_USER_ACTIVE);
            let usuarioAtual = usuarioAtivo;
            if (usuarioAtualStr) {
                try { usuarioAtual = JSON.parse(usuarioAtualStr); } catch (e) { }
            }
            const isModoAdmin = (modeUrl === 'admin') || (usuarioAtual && (usuarioAtual.role === 'admin' || usuarioAtual.role === 'diretoria') && modeUrl !== 'motorista');

            // Se estiver em modo admin ou editando uma ficha específica, retornar imediatamente sem salvar rascunho
            if (fichaUrl || isModoAdmin || modeUrl === 'admin') {
                return;
            }

            const isMotorista = (urlParams.get('mode') === 'motorista') || (usuarioAtual && usuarioAtual.role === 'motorista');

            const cabecalho = {
                motorista: (isMotorista && usuarioAtual?.nome && usuarioAtual.nome !== 'Carlos Eduardo Ferreira') ? usuarioAtual.nome : (inputMotorista?.value || ''),
                placas: isMotorista ? '' : (inputPlacas?.value || ''),
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

    function limparFormularioCompleto() {
        if (form) form.reset();

        // Zerar todos os campos de cabeçalho
        if (inputPlacas) inputPlacas.value = '';
        if (inputDataSaida) inputDataSaida.value = '';
        if (inputDataChegada) inputDataChegada.value = '';
        if (inputKmSaida) inputKmSaida.value = '';
        if (inputKmChegada) inputKmChegada.value = '';
        if (inputKmTotal) inputKmTotal.value = '';
        if (inputDestinoInicial) inputDestinoInicial.value = '';
        if (inputDestinoFinal) inputDestinoFinal.value = '';
        if (inputAdiantamento) inputAdiantamento.value = '';
        if (inputFreteOrigem) inputFreteOrigem.value = '';
        if (inputRetorno1) inputRetorno1.value = '';
        if (inputRetorno2) inputRetorno2.value = '';
        if (inputRetorno3) inputRetorno3.value = '';
        if (inputTotalFrete) inputTotalFrete.value = '';
        if (inputVrComissao) inputVrComissao.value = '';

        // Limpar as 8 linhas de frete
        for (let i = 1; i <= 8; i++) {
            const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
            const cli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
            const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
            const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
            const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
            const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
            const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

            if (dt) dt.value = '';
            if (cli) cli.value = '';
            if (og) og.value = '';
            if (dst) dst.value = '';
            if (vl) vl.value = '';
            if (com) {
                com.value = '';
                com.dataset.editadoManual = '';
            }
            if (desc) desc.value = '';
        }

        // Limpar 10 linhas de abastecimento
        for (let i = 1; i <= 10; i++) {
            const posto = document.querySelector(`[name="posto_ml_${i}"]`);
            const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
            const km = document.querySelector(`input[name="km_ml_${i}"]`);
            const vl = document.querySelector(`input[name="valor_ml_${i}"]`);
            const lit = document.querySelector(`input[name="litros_ml_${i}"]`);

            if (posto) posto.value = '';
            if (nf) nf.value = '';
            if (km) km.value = '';
            if (vl) vl.value = '';
            if (lit) lit.value = '';
        }

        // Limpar 3 pedágios e despesas extras
        if (inputsPedagioMl[0]) inputsPedagioMl[0].value = '';
        if (inputsPedagioMl[1]) inputsPedagioMl[1].value = '';
        if (inputsPedagioMl[2]) inputsPedagioMl[2].value = '';
        if (inputMlImpFederal) inputMlImpFederal.value = '';
        if (inputMlDespesaDesc2) inputMlDespesaDesc2.value = '';
        if (inputMlDespesaValor2) inputMlDespesaValor2.value = '';
        if (inputMlDespesaDesc3) inputMlDespesaDesc3.value = '';
        if (inputMlDespesaValor3) inputMlDespesaValor3.value = '';

        // Zerar comprovantes anexos
        arquivosComprovantesMl = [];
        renderizarListaAnexosMl();

        // Manter preenchido APENAS o nome do motorista autenticado
        const usuarioAtualStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtual = usuarioAtivo;
        if (usuarioAtualStr) {
            try { usuarioAtual = JSON.parse(usuarioAtualStr); } catch (e) { }
        }
        if (inputMotorista) {
            if (usuarioAtual && usuarioAtual.role === 'motorista' && usuarioAtual.nome && usuarioAtual.nome !== 'Carlos Eduardo Ferreira') {
                inputMotorista.value = usuarioAtual.nome;
            }
        }

        // Recalcular totais zerados
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
    }

    function carregarProgressoMl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const fichaUrl = urlParams.get('ficha');
            const novoUrl = urlParams.get('novo');
            const usuarioAtualStr = localStorage.getItem(STORAGE_USER_ACTIVE);
            let usuarioAtual = usuarioAtivo;
            if (usuarioAtualStr) {
                try { usuarioAtual = JSON.parse(usuarioAtualStr); } catch (e) { }
            }
            const isMotorista = (urlParams.get('mode') === 'motorista') || (usuarioAtual && usuarioAtual.role === 'motorista');

            // Se a URL contiver ficha ou novo=true, não restaurar rascunho e limpar a chave STORAGE_ML_KEY
            if (fichaUrl || novoUrl === 'true' || urlParams.has('novo')) {
                localStorage.removeItem(STORAGE_ML_KEY);
                limparFormularioCompleto();
                return;
            }

            const salvo = localStorage.getItem(STORAGE_ML_KEY);
            if (!salvo) {
                limparFormularioCompleto();
                return;
            }

            // Inicialização padrão para motorista
            if (isMotorista) {
                if (inputMotorista && usuarioAtual?.nome && usuarioAtual.nome !== 'Carlos Eduardo Ferreira') {
                    inputMotorista.value = usuarioAtual.nome;
                }
                if (inputPlacas) {
                    inputPlacas.value = '';
                }
            }
            if (salvo) {
                const dados = JSON.parse(salvo);

                // Restaurar cabeçalho
                if (dados.cabecalho) {
                    if (inputMotorista) {
                        if (isMotorista && usuarioAtual?.nome && usuarioAtual.nome !== 'Carlos Eduardo Ferreira') {
                            inputMotorista.value = usuarioAtual.nome;
                        } else if (dados.cabecalho.motorista) {
                            inputMotorista.value = dados.cabecalho.motorista;
                        }
                    }

                    // TAREFA 3: Bloqueio de Rascunho para Placas no Modo Motorista
                    // Se o usuário logado for com role 'motorista', NÃO restaure o valor de #placas a partir do rascunho local
                    if (inputPlacas) {
                        if (isMotorista) {
                            inputPlacas.value = '';
                        } else if (dados.cabecalho.placas) {
                            inputPlacas.value = dados.cabecalho.placas;
                        }
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
                            if (!Array.from(posto.options).some(o => o.value === ab.posto)) {
                                const opt = document.createElement('option');
                                opt.value = ab.posto;
                                opt.textContent = ab.posto;
                                posto.appendChild(opt);
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
        const motoristaNome = ficha.motorista || ficha.motoristaNome || ficha.dados_completos?.motorista;
        if (inputMotorista && motoristaNome) inputMotorista.value = motoristaNome;

        const placasVal = ficha.placas || ficha.dados_completos?.placas;
        if (inputPlacas && placasVal) inputPlacas.value = placasVal;

        const dataSaidaVal = ficha.dataSaida || ficha.data_saida || ficha.dados_completos?.dataSaida;
        if (inputDataSaida && dataSaidaVal) inputDataSaida.value = normalizarDataExibicao(dataSaidaVal);

        const dataChegadaVal = ficha.dataChegada || ficha.data_chegada || ficha.dados_completos?.dataChegada;
        if (inputDataChegada && dataChegadaVal) inputDataChegada.value = normalizarDataExibicao(dataChegadaVal);

        const kmSaidaVal = ficha.kmSaida ?? ficha.km_saida ?? ficha.dados_completos?.kmSaida;
        if (inputKmSaida && kmSaidaVal !== undefined && kmSaidaVal !== null) inputKmSaida.value = kmSaidaVal;

        const kmChegadaVal = ficha.kmChegada ?? ficha.km_chegada ?? ficha.dados_completos?.kmChegada;
        if (inputKmChegada && kmChegadaVal !== undefined && kmChegadaVal !== null) inputKmChegada.value = kmChegadaVal;

        const kmTotalVal = ficha.kmTotal ?? ficha.km_total ?? ficha.dados_completos?.kmTotal;
        if (inputKmTotal && kmTotalVal !== undefined && kmTotalVal !== null) inputKmTotal.value = kmTotalVal;

        const destinoInicialVal = ficha.destinoInicial || ficha.destino_inicial || ficha.dados_completos?.destinoInicial;
        if (inputDestinoInicial && destinoInicialVal) inputDestinoInicial.value = destinoInicialVal;

        const destinoFinalVal = ficha.destinoFinal || ficha.destino_final || ficha.dados_completos?.destinoFinal;
        if (inputDestinoFinal && destinoFinalVal) inputDestinoFinal.value = destinoFinalVal;

        const adiantamentoVal = ficha.valorAdiantamento || ficha.valor_adiantamento || ficha.dados_completos?.valorAdiantamento;
        if (inputAdiantamento && adiantamentoVal) inputAdiantamento.value = adiantamentoVal;

        const freteOrigemVal = ficha.freteOrigem || ficha.frete_origem || ficha.dados_completos?.freteOrigem;
        if (inputFreteOrigem && freteOrigemVal) inputFreteOrigem.value = freteOrigemVal;

        const retorno1Val = ficha.retorno1 || ficha.retorno_1 || ficha.dados_completos?.retorno1;
        if (inputRetorno1 && retorno1Val) inputRetorno1.value = retorno1Val;

        const retorno2Val = ficha.retorno2 || ficha.retorno_2 || ficha.dados_completos?.retorno2;
        if (inputRetorno2 && retorno2Val) inputRetorno2.value = retorno2Val;

        const retorno3Val = ficha.retorno3 || ficha.retorno_3 || ficha.dados_completos?.retorno3;
        if (inputRetorno3 && retorno3Val) inputRetorno3.value = retorno3Val;

        const totalFreteVal = ficha.totalFrete || ficha.total_frete || ficha.dados_completos?.totalFrete;
        if (inputTotalFrete && totalFreteVal) inputTotalFrete.value = totalFreteVal;

        const vrComissaoVal = ficha.vrComissao || ficha.vr_comissao || ficha.dados_completos?.vrComissao;
        if (inputVrComissao && vrComissaoVal) inputVrComissao.value = vrComissaoVal;

        // Fretes Operacionais
        const fretesLista = Array.isArray(ficha.fretes) ? ficha.fretes : (Array.isArray(ficha.dados_completos?.fretes) ? ficha.dados_completos.fretes : []);
        if (fretesLista.length > 0) {
            fretesLista.forEach((f, idx) => {
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

        // Abastecimentos (Usa document.querySelector(`[name="posto_ml_${i}"]`) para contemplar <select> e <input>)
        const abastLista = Array.isArray(ficha.abastecimentos) ? ficha.abastecimentos : (Array.isArray(ficha.dados_completos?.abastecimentos) ? ficha.dados_completos.abastecimentos : []);
        if (abastLista.length > 0) {
            abastLista.forEach((ab, idx) => {
                const i = idx + 1;
                const posto = document.querySelector(`[name="posto_ml_${i}"]`);
                const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                const km = document.querySelector(`input[name="km_ml_${i}"]`);
                const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                if (posto && ab.posto) {
                    if (posto.tagName === 'SELECT') {
                        if (!Array.from(posto.options).some(o => o.value === ab.posto)) {
                            const opt = document.createElement('option');
                            opt.value = ab.posto;
                            opt.textContent = ab.posto;
                            posto.appendChild(opt);
                        }
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
        const pedagiosLista = Array.isArray(ficha.pedagios) ? ficha.pedagios : (Array.isArray(ficha.dados_completos?.pedagios) ? ficha.dados_completos.pedagios : []);
        if (pedagiosLista.length > 0) {
            if (inputsPedagioMl[0] && pedagiosLista[0]) inputsPedagioMl[0].value = pedagiosLista[0];
            if (inputsPedagioMl[1] && pedagiosLista[1]) inputsPedagioMl[1].value = pedagiosLista[1];
            if (inputsPedagioMl[2] && pedagiosLista[2]) inputsPedagioMl[2].value = pedagiosLista[2];
        }

        // Imposto Federal
        const impFederalVal = ficha.impFederal || ficha.imp_federal || ficha.dados_completos?.impFederal;
        if (inputMlImpFederal && impFederalVal) {
            inputMlImpFederal.value = impFederalVal;
        }

        // Outras Despesas
        const despesasExtras = Array.isArray(ficha.outrasDespesas) ? ficha.outrasDespesas : 
            (Array.isArray(ficha.despesas_extras) ? ficha.despesas_extras : 
            (Array.isArray(ficha.dados_completos?.outrasDespesas) ? ficha.dados_completos.outrasDespesas : 
            (Array.isArray(ficha.dados_completos?.despesas_extras) ? ficha.dados_completos.despesas_extras : [])));
        if (despesasExtras.length > 0) {
            despesasExtras.forEach((item, index) => {
                if (index === 0) {
                    if (inputMlImpFederal && item.valor) inputMlImpFederal.value = item.valor;
                } else if (index === 1) {
                    if (inputMlDespesaDesc2 && item.desc) inputMlDespesaDesc2.value = item.desc;
                    if (inputMlDespesaValor2 && item.valor) inputMlDespesaValor2.value = item.valor;
                } else if (index === 2) {
                    if (inputMlDespesaDesc3 && item.desc) inputMlDespesaDesc3.value = item.desc;
                    if (inputMlDespesaValor3 && item.valor) inputMlDespesaValor3.value = item.valor;
                }
            });
        }

        // Anexos / Comprovantes
        const anexosLista = Array.isArray(ficha.anexos) ? ficha.anexos : 
            (Array.isArray(ficha.comprovantes) ? ficha.comprovantes : 
            (Array.isArray(ficha.dados_completos?.anexos) ? ficha.dados_completos.anexos : 
            (Array.isArray(ficha.dados_completos?.comprovantes) ? ficha.dados_completos.comprovantes : [])));
        if (anexosLista.length > 0) {
            arquivosComprovantesMl = anexosLista;
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
                    return lista.filter(f => f && f.id);
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
    async function configurarCicloDeVidaViagem() {
        const urlParams = new URLSearchParams(window.location.search);
        const fichaIdUrl = urlParams.get('ficha');
        const modeUrl = urlParams.get('mode');

        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivo = null;
        if (usuarioAtivoStr) {
            try {
                usuarioAtivo = JSON.parse(usuarioAtivoStr);
                if (usuarioAtivo && usuarioAtivo.nome === 'Carlos Eduardo Ferreira' && usuarioAtivo.role !== 'admin') {
                    usuarioAtivo.nome = '';
                    localStorage.setItem(STORAGE_USER_ACTIVE, JSON.stringify(usuarioAtivo));
                }
                if (modeUrl === 'admin' && usuarioAtivo && usuarioAtivo.role !== 'admin') {
                    usuarioAtivo.role = 'admin';
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
        const btnAdminExcluir = document.getElementById('btn-admin-excluir-ficha');

        // -------------------------------------------------------------
        // SEPARAÇÃO DOS CAMPOS DE GOVERNANÇA (Tarefas 1, 2, 3 e 4)
        // -------------------------------------------------------------
        // Grupo 1: Veículo e Motorista (Definido pela Administração no modo motorista)
        const camposAdminVeiculo = [inputMotorista, inputPlacas].filter(Boolean);

        // Grupo 2: Fretes da Empresa (Definido pela Frota no modo motorista)
        const camposFretesFrota = [
            inputFreteOrigem,
            inputRetorno1,
            inputRetorno2,
            inputRetorno3,
            inputTotalFrete,
            inputVrComissao,
            document.getElementById('ml-total-relacao-frete'),
            document.getElementById('ml-total-relacao-comissao'),
            document.getElementById('ml-total-relacao-descarga')
        ].filter(Boolean);

        // Grupo 3: Campos Operacionais Corporativos
        const camposOperacionaisFrota = [
            inputDataSaida,
            inputDataChegada,
            inputKmSaida,
            inputKmChegada,
            inputKmTotal,
            inputDestinoInicial,
            inputDestinoFinal,
            inputAdiantamento,
            document.getElementById('ml-pedagio-1'),
            document.getElementById('ml-pedagio-2'),
            document.getElementById('ml-pedagio-3'),
            document.getElementById('ml-total-pedagio')
        ].filter(Boolean);

        const camposTabelaFretes = Array.from(document.querySelectorAll('.input-valor-frete-ml, .input-comissao-frete-ml, .input-descarga-frete-ml'));
        const linhaImpostoFederal = document.getElementById('linha-imposto-federal');
        const badgeImpostoObrigatorio = document.getElementById('badge-imposto-obrigatorio');
        const inputMlImpFederal = document.getElementById('ml-imp-federal-valor');
        const badgePedagio = document.getElementById('badge-pedagio-status');
        const botoesPickerData = document.querySelectorAll('.btn-picker-data');

        function aplicarBloqueioCampo(input, rotulo = 'Definido pela Frota') {
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
                if (label) {
                    const tagExistente = label.querySelector('.tag-bloqueado-frota, .tag-bloqueado-adm');
                    if (tagExistente) tagExistente.remove();

                    const isAdm = rotulo.toLowerCase().includes('administra');
                    const tag = document.createElement('span');
                    tag.className = isAdm ? 'tag-bloqueado-adm' : 'tag-bloqueado-frota';
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
                const label = wrapper.closest('.frete-coluna')?.querySelector('label') || wrapper.querySelector('label');
                if (label) {
                    label.querySelectorAll('.tag-bloqueado-frota, .tag-bloqueado-adm').forEach(t => t.remove());
                }
            }
        }

        // TAREFA 4: Configuração da Seção Outras Despesas (100% liberada e editável para ambos os modos)
        function configurarSecaoOutrasDespesas() {
            const listaDespesas = document.querySelector('.card-outras-despesas .linhas-despesas-lista');
            if (!listaDespesas) return;

            // Garante que todas as linhas (exceto imposto federal) estejam liberadas
            const inputsDespesasLivres = listaDespesas.querySelectorAll('.linha-despesa-composta:not(#linha-imposto-federal) input');
            inputsDespesasLivres.forEach(inp => {
                liberarCampoBloqueado(inp);
                inp.removeAttribute('readonly');
                inp.removeAttribute('disabled');
            });

            // Remover botão dinâmico caso exista
            const containerExistente = document.getElementById('container-adicionar-despesa-ml');
            if (containerExistente) {
                containerExistente.remove();
            }
        }

        // -------------------------------------------------------------
        // CASO A: MODO ADMINISTRADOR (Conferência 100% Liberada)
        // -------------------------------------------------------------
        if (isModoAdmin) {
            if (barraAdmin) barraAdmin.classList.add('ativa');
            if (barraMotorista) barraMotorista.style.display = 'none';

            // 1. Liberação total de Motorista e Placas (Tarefa 2)
            camposAdminVeiculo.forEach(input => {
                liberarCampoBloqueado(input);
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
            });
            if (inputMotorista) {
                liberarCampoBloqueado(inputMotorista);
                inputMotorista.removeAttribute('readonly');
                inputMotorista.removeAttribute('disabled');
                inputMotorista.placeholder = 'Nome completo do motorista';
            }
            if (inputPlacas) {
                liberarCampoBloqueado(inputPlacas);
                inputPlacas.removeAttribute('readonly');
                inputPlacas.removeAttribute('disabled');
                inputPlacas.placeholder = 'Ex: GAB-1234';
            }

            // 2. Liberação total dos campos de frete com recálculo (Tarefa 3)
            camposFretesFrota.forEach(input => liberarCampoBloqueado(input));
            camposTabelaFretes.forEach(input => {
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
                input.classList.remove('campo-bloqueado-gestao');
            });
            document.querySelectorAll('.th-tag-gestao').forEach(t => t.style.display = 'none');

            // 3. Liberação dos campos operacionais
            camposOperacionaisFrota.forEach(input => liberarCampoBloqueado(input));

            // 4. Seção Outras Despesas 100% liberada e editável (Tarefa 4)
            configurarSecaoOutrasDespesas();

            // 5. Imposto Federal visível e livremente editável
            if (linhaImpostoFederal) linhaImpostoFederal.classList.remove('oculto-motorista');
            if (badgeImpostoObrigatorio) badgeImpostoObrigatorio.classList.remove('oculto-motorista');
            if (inputMlImpFederal) {
                liberarCampoBloqueado(inputMlImpFederal);
                inputMlImpFederal.removeAttribute('readonly');
                inputMlImpFederal.removeAttribute('disabled');
            }

            // 6. Status de Pedágio
            if (badgePedagio) badgePedagio.textContent = '3 Linhas';

            // 7. Habilita seletores de data
            botoesPickerData.forEach(btn => {
                btn.removeAttribute('disabled');
                btn.disabled = false;
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });

            // Abre o formulário oficial automaticamente para conferência/edição
            toggleFormularioUnificado(true, false);

            let fichaCarregada = null;
            const tagAdmin = barraAdmin?.querySelector('.tag-gestor-destaque');
            if (tagAdmin) {
                tagAdmin.textContent = '🛡️ Gestão Operacional • Modo Administrador';
            }

            if (fichaIdUrl) {
                const todas = obterListaFichasCentral();
                fichaCarregada = todas.find(f => f.id === fichaIdUrl);

                // Caso não encontre localmente ou se estiver conectado ao Supabase, faz a busca assíncrona diretamente no Supabase
                if (!fichaCarregada || window.supabaseClient) {
                    if (window.supabaseClient) {
                        try {
                            const { data: registro } = await window.supabaseClient
                                .from('fichas_viagem')
                                .select('*')
                                .eq('id', fichaIdUrl)
                                .maybeSingle();

                            const mapearFn = typeof mapearFichaDoSupabase === 'function'
                                ? mapearFichaDoSupabase
                                : (typeof window.mapearFichaDoSupabase === 'function' ? window.mapearFichaDoSupabase : null);

                            if (registro && mapearFn) {
                                fichaCarregada = mapearFn(registro);
                            }
                        } catch (errSupabase) {
                            console.warn('Erro ao consultar ficha no Supabase:', errSupabase);
                        }
                    }

                    // Fallback em tempo real via window.buscarFichasSupabase() se ainda não constar
                    if (!fichaCarregada && typeof window.buscarFichasSupabase === 'function') {
                        try {
                            const fichasSupabase = await window.buscarFichasSupabase();
                            if (Array.isArray(fichasSupabase)) {
                                const encontrada = fichasSupabase.find(f => f.id === fichaIdUrl);
                                if (encontrada) {
                                    fichaCarregada = encontrada;
                                }
                            }
                        } catch (e) {
                            console.warn('Erro ao consultar fallback buscarFichasSupabase:', e);
                        }
                    }
                }

                if (fichaCarregada) {
                    // Atualiza cache local para sincronização imediata
                    const todasAtuais = obterListaFichasCentral();
                    const idxExistente = todasAtuais.findIndex(f => f.id === fichaCarregada.id);
                    if (idxExistente >= 0) {
                        todasAtuais[idxExistente] = { ...todasAtuais[idxExistente], ...fichaCarregada };
                    } else {
                        todasAtuais.unshift(fichaCarregada);
                    }
                    salvarListaFichasCentral(todasAtuais);

                    atualizarDisplayNumeroFicha(fichaCarregada.id);
                    carregarFichaEmCampos(fichaCarregada);

                    if (adminTitulo) {
                        adminTitulo.innerHTML = `Conferência da Ficha: <strong>${fichaCarregada.id}</strong>`;
                    }
                    if (adminStatus) {
                        const st = fichaCarregada.status || 'pendente';
                        if (st === 'aprovado') {
                            adminStatus.className = 'status-pill status-concluido';
                            adminStatus.textContent = '🟢 Concluído / Aprovado';
                        } else if (st === 'aguardando_confirmacao') {
                            adminStatus.className = 'status-pill status-aguardando-confirmacao';
                            adminStatus.textContent = '🟠 Esperando Confirmação';
                        } else {
                            adminStatus.className = 'status-pill status-pendente';
                            adminStatus.textContent = '🟡 Pendente de Conferência';
                        }
                    }
                }
            } else {
                // Criação de Nova Ficha pelo Administrador
                if (adminTitulo) {
                    adminTitulo.textContent = 'Lançamento de Nova Ficha • Todos os campos liberados para a Frota';
                }
                if (adminStatus) {
                    adminStatus.className = 'status-pill status-pendente';
                    adminStatus.textContent = '🟡 Pendente de Conferência';
                }
            }

            // Ação de Salvar Alterações pelo Administrador
            if (btnAdminSalvar) {
                btnAdminSalvar.addEventListener('click', async () => {
                    if (inputPlacas && !inputPlacas.disabled && !inputPlacas.readOnly) {
                        const limpo = (inputPlacas.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (limpo.length !== 7) {
                            exibirToast('A placa do veículo deve conter exatamente 7 caracteres (Ex: GAB-1234 ou GAB-1C34).', 'erro');
                            inputPlacas.focus();
                            return;
                        }
                    }

                    const idSalvar = (fichaCarregada && fichaCarregada.id) ? fichaCarregada.id : (fichaIdUrl || fichaNumeroAtual);
                    const textoOriginal = btnAdminSalvar.innerHTML;
                    btnAdminSalvar.innerHTML = `<span>⏳ Salvando...</span>`;
                    btnAdminSalvar.disabled = true;

                    try {
                        const dadosSalvos = await atualizarFichaNaBase(idSalvar, false);
                        if (dadosSalvos) {
                            fichaCarregada = dadosSalvos;
                        }
                        sessionStorage.setItem('ajborges_toast_mensagem', `Ficha ${idSalvar} salva! Status: Esperando Confirmação`);
                        window.location.href = 'dashboard-admin.html#fichas';
                    } catch (e) {
                        console.error('Erro ao salvar alterações da ficha:', e);
                        exibirToast(`Erro ao salvar alterações da ficha ${idSalvar}`, 'erro');
                        btnAdminSalvar.innerHTML = textoOriginal;
                        btnAdminSalvar.disabled = false;
                    }
                });
            }

            // Ação de "Aprovar e Concluir Relatório" pelo Administrador
            if (btnAdminAprovar) {
                btnAdminAprovar.addEventListener('click', async () => {
                    if (inputPlacas && !inputPlacas.disabled && !inputPlacas.readOnly) {
                        const limpo = (inputPlacas.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (limpo.length !== 7) {
                            exibirToast('A placa do veículo deve conter exatamente 7 caracteres (Ex: GAB-1234).', 'erro');
                            inputPlacas.focus();
                            return;
                        }
                    }

                    const idAprovar = fichaCarregada ? fichaCarregada.id : fichaNumeroAtual;
                    if (!confirm(`Confirmar a homologação e aprovação definitiva do Relatório de Viagem ${idAprovar}?`)) {
                        return;
                    }

                    const textoOriginal = btnAdminAprovar.innerHTML;
                    btnAdminAprovar.innerHTML = `<span>⏳ Aprovando...</span>`;
                    btnAdminAprovar.disabled = true;

                    try {
                        await atualizarFichaNaBase(idAprovar, true);
                        sessionStorage.setItem('ajborges_toast_mensagem', `Relatório ${idAprovar} APROVADO e CONCLUÍDO com sucesso!`);
                        window.location.href = 'dashboard-admin.html#fichas';
                    } catch (e) {
                        console.error('Erro ao aprovar ficha:', e);
                        exibirToast(`Erro ao aprovar a ficha ${idAprovar}`, 'erro');
                        btnAdminAprovar.innerHTML = textoOriginal;
                        btnAdminAprovar.disabled = false;
                    }
                });
            }

            // Ação de "Apagar Ficha" pelo Administrador
            if (btnAdminExcluir) {
                btnAdminExcluir.addEventListener('click', async () => {
                    const idExcluir = fichaCarregada ? fichaCarregada.id : fichaNumeroAtual;
                    if (!confirm(`Tem certeza de que deseja apagar a ficha ${idExcluir}?\n\nTodos os dados desta viagem serão removidos permanentemente do dashboard e dos relatórios.`)) {
                        return;
                    }

                    // 1. Remove da lista local
                    const todasFichas = obterListaFichasCentral();
                    const atualizadas = todasFichas.filter(f => f.id !== idExcluir);
                    salvarListaFichasCentral(atualizadas);

                    // 2. Remove do Supabase
                    if (typeof window.excluirFichaSupabase === 'function') {
                        try {
                            await window.excluirFichaSupabase(idExcluir);
                        } catch (e) {
                            console.warn('Erro ao excluir ficha no Supabase:', e);
                        }
                    }

                    // 3. Notifica e retorna ao Dashboard
                    sessionStorage.setItem('ajborges_toast_mensagem', `Ficha ${idExcluir} apagada com sucesso! Dados removidos do dashboard.`);
                    window.location.href = 'dashboard-admin.html#fichas';
                });
            }

            return;
        }

        // -------------------------------------------------------------
        // CASO B: MODO VISUALIZAÇÃO (Ficha Concluída)
        // -------------------------------------------------------------
        if (isModoView && fichaIdUrl) {
            const todas = obterListaFichasCentral();
            let fichaView = todas.find(f => f.id === fichaIdUrl);

            // Carregamento direto do Supabase no modo visualização
            if (window.supabaseClient) {
                try {
                    const { data: registro } = await window.supabaseClient
                        .from('fichas_viagem')
                        .select('*')
                        .eq('id', fichaIdUrl)
                        .maybeSingle();

                    const mapearFn = typeof mapearFichaDoSupabase === 'function'
                        ? mapearFichaDoSupabase
                        : (typeof window.mapearFichaDoSupabase === 'function' ? window.mapearFichaDoSupabase : null);

                    if (registro && mapearFn) {
                        fichaView = mapearFn(registro);
                    }
                } catch (e) {
                    console.warn('Erro ao carregar ficha no modo view via Supabase:', e);
                }
            }

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
                            <button type="button" class="btn-voltar-gestao" onclick="window.history.back()">
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

        // 1. TAREFA 2: Bloqueio rigoroso de Motorista e Placas com "Definido pela Administração"
        camposAdminVeiculo.forEach(input => {
            aplicarBloqueioCampo(input, 'Definido pela Administração');
            input.setAttribute('readonly', 'true');
        });

        // Campo Placas (NUNCA Preencher Automaticamente no modo motorista)
        if (inputPlacas) {
            inputPlacas.value = '';
            inputPlacas.placeholder = 'Aguardando definição da Gestão';
            aplicarBloqueioCampo(inputPlacas, 'Definido pela Administração');
            inputPlacas.setAttribute('readonly', 'true');
            inputPlacas.setAttribute('disabled', 'true');
        }

        // Campo Motorista (Bloqueado como readonly com a tag Definido pela Administração)
        if (inputMotorista) {
            aplicarBloqueioCampo(inputMotorista, 'Definido pela Administração');
            inputMotorista.setAttribute('readonly', 'true');
            if (usuarioAtivo && usuarioAtivo.role === 'motorista' && usuarioAtivo.nome) {
                const nomeValido = usuarioAtivo.nome !== 'Carlos Eduardo Ferreira' ? usuarioAtivo.nome : '';
                if (nomeValido) {
                    inputMotorista.value = nomeValido;
                }
            }
        }

        // 2. TAREFA 3: Bloqueio de Fretes com "Definido pela Frota"
        camposFretesFrota.forEach(input => aplicarBloqueioCampo(input, 'Definido pela Frota'));
        camposTabelaFretes.forEach(input => {
            input.setAttribute('readonly', 'true');
            input.classList.add('campo-bloqueado-gestao');
        });
        document.querySelectorAll('.th-tag-gestao').forEach(t => t.style.display = 'inline-flex');

        // 3. Bloqueio de Campos Operacionais Corporativos
        camposOperacionaisFrota.forEach(input => aplicarBloqueioCampo(input, 'Definido pela Frota'));

        // 4. TAREFA 4: Liberação Total da Seção "Outras Despesas" para Motorista
        configurarSecaoOutrasDespesas();

        // 5. Ocultação total do campo sensível: Imposto Federal (IRRF / INSS / SEST / SENAT)
        if (linhaImpostoFederal) linhaImpostoFederal.classList.add('oculto-motorista');
        if (badgeImpostoObrigatorio) badgeImpostoObrigatorio.classList.add('oculto-motorista');

        // 6. Status de Pedágio
        if (badgePedagio) badgePedagio.textContent = 'Definido pela Frota';

        // 7. Desabilita seletores de data
        botoesPickerData.forEach(btn => {
            btn.setAttribute('disabled', 'true');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        });

        // Abre automaticamente o formulário oficial para lançamento de fretes e diesel
        toggleFormularioUnificado(true, false);

        // Verifica estado do Motorista (Com Login ou Sem Login)
        const motoristaSaudacao = document.getElementById('motorista-saudacao-texto');

        const isMotoristaLogado = usuarioAtivo && usuarioAtivo.role === 'motorista';

        if (isMotoristaLogado) {
            const nomeMotoristaValido = (usuarioAtivo.nome && usuarioAtivo.nome !== 'Carlos Eduardo Ferreira') ? usuarioAtivo.nome : '';

            // TAREFA 1: Campo Motorista preenchido automaticamente com nome do perfil e mantido readonly
            if (inputMotorista && nomeMotoristaValido) {
                inputMotorista.value = nomeMotoristaValido;
                aplicarBloqueioCampo(inputMotorista, 'Definido pela Administração');
                inputMotorista.setAttribute('readonly', 'true');
            }

            // TAREFA 2: Campo Placas NUNCA preenchido automaticamente; permanece vazio e bloqueado
            if (inputPlacas) {
                inputPlacas.value = '';
                inputPlacas.placeholder = 'Aguardando definição da Gestão';
                aplicarBloqueioCampo(inputPlacas, 'Definido pela Administração');
                inputPlacas.setAttribute('readonly', 'true');
                inputPlacas.setAttribute('disabled', 'true');
            }

            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Olá, <strong>${nomeMotoristaValido || 'Motorista'}</strong> • Conectado via Portal`;
            }
        } else {
            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Portal da Frota • Modo Motorista`;
            }
        }
    }

    async function atualizarFichaNaBase(idFicha, marcarComoAprovado = false) {
        let todas = obterListaFichasCentral();
        let index = todas.findIndex(f => f.id === idFicha);

        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivoSessao = null;
        if (usuarioAtivoStr) {
            try { usuarioAtivoSessao = JSON.parse(usuarioAtivoStr); } catch (e) { }
        }

        const dadosAtualizados = {
            id: idFicha,
            protocolo: idFicha,
            motorista: inputMotorista?.value.trim() || (index >= 0 ? todas[index].motorista : '') || usuarioAtivoSessao?.nome || 'Motorista',
            motorista_cpf: (index >= 0 ? (todas[index].motorista_cpf || todas[index].motoristaCpf) : '') || usuarioAtivoSessao?.cpf || '',
            motoristaCpf: (index >= 0 ? (todas[index].motoristaCpf || todas[index].motorista_cpf) : '') || usuarioAtivoSessao?.cpf || '',
            placas: inputPlacas?.value.trim() || (index >= 0 ? todas[index].placas : '') || '',
            dataSaida: inputDataSaida?.value || '',
            data_saida: inputDataSaida?.value || '',
            dataChegada: inputDataChegada?.value || '',
            data_chegada: inputDataChegada?.value || '',
            kmSaida: inputKmSaida?.value || '',
            km_saida: inputKmSaida?.value || '',
            kmChegada: inputKmChegada?.value || '',
            km_chegada: inputKmChegada?.value || '',
            kmTotal: inputKmTotal?.value || '',
            km_total: inputKmTotal?.value || '',
            destinoInicial: inputDestinoInicial?.value || '',
            destino_inicial: inputDestinoInicial?.value || '',
            destinoFinal: inputDestinoFinal?.value || '',
            destino_final: inputDestinoFinal?.value || '',
            freteOrigem: inputFreteOrigem?.value || '',
            frete_origem: inputFreteOrigem?.value || '',
            retorno1: inputRetorno1?.value || '',
            retorno_1: inputRetorno1?.value || '',
            retorno2: inputRetorno2?.value || '',
            retorno_2: inputRetorno2?.value || '',
            retorno3: inputRetorno3?.value || '',
            retorno_3: inputRetorno3?.value || '',
            totalFrete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
            total_frete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
            vrComissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
            vr_comissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
            valorAdiantamento: inputAdiantamento?.value || '',
            valor_adiantamento: inputAdiantamento?.value || '',
            fretes: coletarFretesAtuais(),
            abastecimentos: coletarAbastecimentosAtuais(),
            totalAbastecimento: document.getElementById('ml-total-abast-valor')?.value || '0,00',
            totalLitros: document.getElementById('ml-total-abast-litros')?.value || '0,00',
            mediaKmL: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
            media_km_l: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
            pedagios: [
                inputsPedagioMl[0]?.value || '',
                inputsPedagioMl[1]?.value || '',
                inputsPedagioMl[2]?.value || ''
            ],
            totalPedagio: (parseMoeda(inputsPedagioMl[0]?.value) + parseMoeda(inputsPedagioMl[1]?.value) + parseMoeda(inputsPedagioMl[2]?.value)).toFixed(2).replace('.', ','),
            impFederal: inputMlImpFederal?.value || '',
            outrasDespesas: coletarOutrasDespesasAtuais(),
            despesas_extras: coletarOutrasDespesasAtuais(),
            totalDespesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
            total_despesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
            resultadoViagem: document.getElementById('ml-indicador-resultado-viagem')?.textContent?.replace('R$', '')?.trim() || '0,00',
            saldoComissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
            saldo_comissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
            anexos: arquivosComprovantesMl || [],
            comprovantes: arquivosComprovantesMl || [],
            origemEnvio: (index >= 0 && todas[index].origemEnvio) ? todas[index].origemEnvio : 'motorista_com_login',
            dados_completos: null
        };
        dadosAtualizados.dados_completos = { ...dadosAtualizados };

        const urlParams = new URLSearchParams(window.location.search);
        const modeUrl = urlParams.get('mode');
        const isModoAdmin = (modeUrl === 'admin') || (usuarioAtivoSessao && (usuarioAtivoSessao.role === 'admin' || usuarioAtivoSessao.role === 'diretoria') && modeUrl !== 'motorista');

        if (marcarComoAprovado) {
            dadosAtualizados.status = 'aprovado';
            dadosAtualizados.dataAprovacao = new Date().toLocaleString('pt-BR');
            dadosAtualizados.aprovadoPor = usuarioAtivoSessao?.email || 'operacional@ajborges.com';
        } else if (isModoAdmin) {
            dadosAtualizados.status = 'aguardando_confirmacao';
            dadosAtualizados.dataUltimaEdicao = new Date().toLocaleString('pt-BR');
            dadosAtualizados.editadoPor = usuarioAtivoSessao?.nome || 'Gestão Operacional';
        } else {
            dadosAtualizados.status = (index >= 0 && todas[index].status) ? todas[index].status : 'pendente';
        }

        if (index >= 0) {
            todas[index] = { ...todas[index], ...dadosAtualizados };
        } else {
            dadosAtualizados.dataEnvio = new Date().toLocaleString('pt-BR');
            if (!dadosAtualizados.status) {
                dadosAtualizados.status = marcarComoAprovado ? 'aprovado' : (isModoAdmin ? 'aguardando_confirmacao' : 'pendente');
            }
            todas.unshift(dadosAtualizados);
        }

        salvarListaFichasCentral(todas);

        // Limpar a chave temporária de rascunho
        localStorage.removeItem(STORAGE_ML_KEY);

        // Persistência obrigatória em nuvem no Supabase TANTO se for nova QUANTO se for edição (index >= 0)
        if (typeof window.salvarFichaSupabase === 'function') {
            try {
                await window.salvarFichaSupabase(dadosAtualizados);
                console.log(`✅ Ficha ${idFicha} sincronizada e salva no Supabase com sucesso.`);
            } catch (errSupabase) {
                console.warn('Erro ao salvar ficha no Supabase:', errSupabase);
            }
        }

        return dadosAtualizados;
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
                localStorage.removeItem(STORAGE_ML_KEY);
                window.location.href = 'relatorio-viagem.html?novo=true';
            });
        }

        // Modal Com Login - Novo Envio
        const btnNovoEnvioComLogin = document.getElementById('btn-novo-envio-com-login');
        if (btnNovoEnvioComLogin) {
            btnNovoEnvioComLogin.addEventListener('click', () => {
                localStorage.removeItem(STORAGE_ML_KEY);
                window.location.href = 'relatorio-viagem.html?novo=true';
            });
        }

        // =========================================================================
        // FINALIZAR E ENVIAR RELATÓRIO DE VIAGEM (MOTORISTA / GESTÃO ADMIN)
        // =========================================================================
        const btnFinalizarRelatorioMl = document.getElementById('btn-finalizar-relatorio-ml');
        if (btnFinalizarRelatorioMl) {
            btnFinalizarRelatorioMl.addEventListener('click', async (e) => {
                e.preventDefault();

                // Recupera usuário ativo e modo
                const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
                let usuarioAtivo = null;
                if (usuarioAtivoStr) {
                    try { usuarioAtivo = JSON.parse(usuarioAtivoStr); } catch (e) { }
                }

                const urlParams = new URLSearchParams(window.location.search);
                const modeUrl = urlParams.get('mode');
                const fichaIdUrl = urlParams.get('ficha');
                const isModoAdmin = (modeUrl === 'admin') || (usuarioAtivo && (usuarioAtivo.role === 'admin' || usuarioAtivo.role === 'diretoria') && modeUrl !== 'motorista');

                // SE FOR ADMINISTRADOR: Salva/atualiza com todos os campos e retorna imediatamente ao Dashboard
                if (isModoAdmin) {
                    if (inputPlacas && !inputPlacas.disabled && !inputPlacas.readOnly) {
                        const limpo = (inputPlacas.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (limpo.length !== 7) {
                            exibirToast('A placa do veículo deve conter exatamente 7 caracteres (Ex: GAB-1234 ou GAB-1C34).', 'erro');
                            inputPlacas.focus();
                            return;
                        }
                    }

                    const idSalvar = fichaIdUrl || (fichaCarregada ? fichaCarregada.id : (typeof fichaNumeroAtual !== 'undefined' ? fichaNumeroAtual : formatarNumeroFicha(obterProximoNumeroFicha())));
                    const textoOriginal = btnFinalizarRelatorioMl.innerHTML;
                    btnFinalizarRelatorioMl.innerHTML = `<span>⏳ Salvando pela Gestão...</span>`;
                    btnFinalizarRelatorioMl.disabled = true;

                    try {
                        await atualizarFichaNaBase(idSalvar, false);
                        sessionStorage.setItem('ajborges_toast_mensagem', `Ficha ${idSalvar} salva! Status: Esperando Confirmação`);
                        window.location.href = 'dashboard-admin.html#fichas';
                    } catch (err) {
                        console.error('Erro ao salvar ficha pelo administrador:', err);
                        exibirToast(`Erro ao salvar a ficha ${idSalvar}`, 'erro');
                        btnFinalizarRelatorioMl.innerHTML = textoOriginal;
                        btnFinalizarRelatorioMl.disabled = false;
                    }
                    return;
                }

                const isComLogin = usuarioAtivo && usuarioAtivo.role === 'motorista';

                // Valida placa se foi preenchida
                if (inputPlacas) {
                    const limpoPlaca = (inputPlacas.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (limpoPlaca.length > 0 && limpoPlaca.length !== 7) {
                        exibirToast('A placa deve conter obrigatoriamente exatamente 7 caracteres (Ex: GAB-1234 ou GAB-1C34).', 'erro');
                        if (!inputPlacas.disabled && !inputPlacas.readOnly) inputPlacas.focus();
                        return;
                    }
                }

                const motoristaIdentificado = (inputMotorista && inputMotorista.value.trim() !== '') || (isComLogin && usuarioAtivo?.nome);
                const impostoFederalPreenchido = inputMlImpFederal && inputMlImpFederal.value.trim() !== '';

                // Valida identificação do motorista
                if (!motoristaIdentificado) {
                    exibirToast('Por favor, informe o nome do Motorista.', 'erro');
                    if (inputMotorista && !inputMotorista.disabled && !inputMotorista.readOnly) inputMotorista.focus();
                    return;
                }

                // Valida Imposto Federal obrigatório
                if (!impostoFederalPreenchido) {
                    if (usuarioAtivo && usuarioAtivo.role === 'motorista') {
                        if (inputMlImpFederal) inputMlImpFederal.value = '0,00';
                    } else {
                        exibirToast('O valor do Imposto Federal é obrigatório no relatório.', 'erro');
                        if (inputMlImpFederal) inputMlImpFederal.focus();
                        return;
                    }
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

                // Monta objeto completo da nova ficha com todas as colunas requeridas
                const agoraDataHora = new Date().toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                const nomeFinalMotorista = inputMotorista?.value.trim() || (isComLogin ? usuarioAtivo?.nome : '') || 'Motorista';

                const novaFicha = {
                    id: novoIdFicha,
                    protocolo: novoIdFicha,
                    dataEnvio: agoraDataHora,
                    motorista: nomeFinalMotorista,
                    motorista_cpf: usuarioAtivo?.cpf || '',
                    motoristaCpf: usuarioAtivo?.cpf || '',
                    motoristaId: isComLogin ? usuarioAtivo.id : 'anonimo',
                    origemEnvio: isComLogin ? 'motorista_com_login' : 'motorista_sem_login',
                    placas: inputPlacas?.value.trim() || 'A definir pela Gestão',
                    data_saida: inputDataSaida?.value || '',
                    dataSaida: inputDataSaida?.value || '',
                    data_chegada: inputDataChegada?.value || '',
                    dataChegada: inputDataChegada?.value || '',
                    km_saida: inputKmSaida?.value || '',
                    kmSaida: inputKmSaida?.value || '',
                    km_chegada: inputKmChegada?.value || '',
                    kmChegada: inputKmChegada?.value || '',
                    km_total: inputKmTotal?.value || '',
                    kmTotal: inputKmTotal?.value || '',
                    destino_inicial: inputDestinoInicial?.value || (fretesAtuais[0]?.origem || 'Origem'),
                    destinoInicial: inputDestinoInicial?.value || (fretesAtuais[0]?.origem || 'Origem'),
                    destino_final: inputDestinoFinal?.value || (fretesAtuais[fretesAtuais.length - 1]?.destino || 'Destino'),
                    destinoFinal: inputDestinoFinal?.value || (fretesAtuais[fretesAtuais.length - 1]?.destino || 'Destino'),
                    frete_origem: inputFreteOrigem?.value || (fretesAtuais[0]?.valor || '0,00'),
                    freteOrigem: inputFreteOrigem?.value || (fretesAtuais[0]?.valor || '0,00'),
                    retorno_1: inputRetorno1?.value || '',
                    retorno1: inputRetorno1?.value || '',
                    retorno_2: inputRetorno2?.value || '',
                    retorno2: inputRetorno2?.value || '',
                    retorno_3: inputRetorno3?.value || '',
                    retorno3: inputRetorno3?.value || '',
                    total_frete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
                    totalFrete: document.getElementById('ml-total-relacao-frete')?.value || inputTotalFrete?.value || '0,00',
                    vr_comissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
                    vrComissao: document.getElementById('ml-total-relacao-comissao')?.value || inputVrComissao?.value || '0,00',
                    valor_adiantamento: inputAdiantamento?.value || '',
                    valorAdiantamento: inputAdiantamento?.value || '',
                    fretes: fretesAtuais,
                    abastecimentos: abastsAtuais,
                    totalAbastecimento: document.getElementById('ml-total-abast-valor')?.value || '0,00',
                    totalLitros: document.getElementById('ml-total-abast-litros')?.value || '0,00',
                    media_km_l: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
                    mediaKmL: document.getElementById('ml-calc-media-combustivel')?.textContent?.trim() || '2.38',
                    pedagios: [
                        inputsPedagioMl[0]?.value || '',
                        inputsPedagioMl[1]?.value || '',
                        inputsPedagioMl[2]?.value || ''
                    ],
                    totalPedagio: (parseMoeda(inputsPedagioMl[0]?.value) + parseMoeda(inputsPedagioMl[1]?.value) + parseMoeda(inputsPedagioMl[2]?.value)).toFixed(2).replace('.', ','),
                    impFederal: inputMlImpFederal?.value || '',
                    outrasDespesas: coletarOutrasDespesasAtuais(),
                    despesas_extras: coletarOutrasDespesasAtuais(),
                    total_despesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
                    totalDespesas: document.getElementById('ml-indicador-despesa-total')?.textContent?.replace('R$', '')?.trim() || '0,00',
                    resultadoViagem: document.getElementById('ml-indicador-resultado-viagem')?.textContent?.replace('R$', '')?.trim() || '0,00',
                    saldo_comissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
                    saldoComissao: document.getElementById('ml-indicador-saldo-comissao')?.textContent?.replace('R$', '')?.trim() || '0,00',
                    anexos: arquivosComprovantesMl || [],
                    comprovantes: arquivosComprovantesMl || [],
                    dados_completos: null,
                    status: 'pendente'
                };
                novaFicha.dados_completos = { ...novaFicha };

                // Salva na fila central de fichas (Local e Nuvem)
                const todasFichas = obterListaFichasCentral();
                todasFichas.unshift(novaFicha);
                salvarListaFichasCentral(todasFichas);

                // Envia para o Supabase
                if (typeof window.salvarFichaSupabase === 'function') {
                    window.salvarFichaSupabase(novaFicha);
                }

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

        window.carregarProgressoMl = carregarProgressoMl;
        carregarProgressoMl();

        // Dispara a configuração completa do ciclo de vida
        configurarCicloDeVidaViagem();
    });

