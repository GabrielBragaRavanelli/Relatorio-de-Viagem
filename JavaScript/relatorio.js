// ==========================================
// AJBorges - Script do Relatório de Viagem
// ==========================================

// Só abre com sessão real do Supabase (motorista ou gestão). Ver JavaScript/auth.js
ajbAoAutenticar(['motorista', 'admin', 'diretoria'], 'Login.html', (usuarioSessao) => {
    // ------------------------------------------
    // Route Guard: Proteção de Acesso
    // O usuário vem da sessão validada no servidor (auth.js), não do localStorage.
    // ------------------------------------------
    const STORAGE_USER_ACTIVE = 'ajborges_usuario_ativo';
    let usuarioAtivo = usuarioSessao;
    const ehGestao = usuarioSessao.role === 'admin' || usuarioSessao.role === 'diretoria';

    // ?mode=admin só vale para a gestão. Para o motorista, remove da URL
    // (o resto do código lê a URL; a proteção real dos dados é a RLS do banco).
    const urlParamsInit = new URLSearchParams(window.location.search);
    if (urlParamsInit.get('mode') === 'admin' && !ehGestao) {
        urlParamsInit.delete('mode');
        const qs = urlParamsInit.toString();
        history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    }
    window.ajbAuth.vigiarSessao('Login.html');

    // Elementos do Formulário
    const form = document.getElementById('form-relatorio');
    const inputMotorista = document.getElementById('motorista');
    const inputPlacas = document.getElementById('placas');
    const inputPlacaSecundaria = document.getElementById('placa-secundaria');
    const inputDataSaida = document.getElementById('data-saida');
    const inputDataChegada = document.getElementById('data-chegada');
    const inputKmSaida = document.getElementById('km-saida');
    const inputKmChegada = document.getElementById('km-chegada');
    const inputKmTotal = document.getElementById('km-total');
    // 2º trecho (placa secundária)
    const blocoKmSecundaria = document.getElementById('bloco-km-secundaria');
    const inputKmSaida2 = document.getElementById('km-saida-2');
    const inputKmChegada2 = document.getElementById('km-chegada-2');
    const inputKmTotal2 = document.getElementById('km-total-2');
    const spanKmTotalViagem = document.getElementById('km-total-viagem');
    const inputDestinoInicial = document.getElementById('destino-inicial');
    const inputDestinoFinal = document.getElementById('destino-final');
    const inputAdiantamento = document.getElementById('valor-adiantamento');

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

    // O número definitivo é gerado pelo banco no momento do envio
    if (numeroFichaDisplay) numeroFichaDisplay.textContent = 'Gerado no envio';

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
    //    Vale para "Placas" e "Placa secundária" (troca de cavalo na viagem)
    // ------------------------------------------
    function aplicarMascaraPlaca(inputPlaca) {
        if (!inputPlaca) return;
        let apagandoPlaca = false;

        inputPlaca.addEventListener('keydown', (e) => {
            if (inputPlaca.readOnly || inputPlaca.disabled) {
                e.preventDefault();
                return;
            }
            if (e.key === 'Backspace') {
                apagandoPlaca = true;
                // Se terminar com '-', remove o hífen e a letra anterior para não travar o cursor
                if (inputPlaca.value.endsWith('-')) {
                    e.preventDefault();
                    const limpo = inputPlaca.value.replace(/[^A-Z0-9]/g, '');
                    inputPlaca.value = limpo.slice(0, -1);
                }
            } else {
                apagandoPlaca = false;
            }
        });

        inputPlaca.addEventListener('input', (e) => {
            if (inputPlaca.readOnly || inputPlaca.disabled) {
                e.preventDefault();
                return;
            }
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

        inputPlaca.addEventListener('focus', () => {
            if (inputPlaca.readOnly || inputPlaca.disabled) {
                inputPlaca.blur();
            }
        });

        // Validação ao sair do campo (blur)
        inputPlaca.addEventListener('blur', () => {
            if (inputPlaca.readOnly || inputPlaca.disabled) return;
            const limpo = (inputPlaca.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (limpo.length > 0 && limpo.length < 7) {
                exibirToast('A placa deve conter obrigatoriamente exatamente 7 caracteres alfanuméricos (Ex: GAB-1234 ou GAB-1C34).', 'erro');
                inputPlaca.focus();
            }
        });
    }
    aplicarMascaraPlaca(inputPlacas);
    aplicarMascaraPlaca(inputPlacaSecundaria);

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
    aplicarMascaraMilhar(inputKmSaida2, () => {
        calcularKmTotal();
        if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
    });
    aplicarMascaraMilhar(inputKmChegada2, () => {
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

        inputTexto.addEventListener('click', (e) => {
            if (inputTexto.readOnly || inputTexto.disabled || inputTexto.hasAttribute('readonly') || inputTexto.closest('.campo-bloqueado-gestao')) {
                return;
            }
            abrirSeletorNativo();
        });

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
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                abrirSeletorNativo();
                return;
            }
            if (e.ctrlKey || e.altKey || e.metaKey || [
                'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'
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
                'Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'
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

    // ==========================================
    // 3.1. Auto-complete Inteligente de Cidades do Brasil (API IBGE)
    // ==========================================
    const STORAGE_IBGE_CIDADES = 'ajborges_cidades_ibge';
    const URL_IBGE_MUNICIPIOS = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';

    // Fallback gracioso com principais capitais e polos logísticos de carga do Brasil
    const FALLBACK_CIDADES_IBGE = [
        "São Paulo - SP", "Campinas - SP", "Santos - SP", "Guarulhos - SP", "São Bernardo do Campo - SP",
        "Santo André - SP", "Osasco - SP", "São José dos Campos - SP", "Ribeirão Preto - SP", "Sorocaba - SP",
        "Marília - SP", "Bauru - SP", "São José do Rio Preto - SP", "Piracicaba - SP", "Jundiaí - SP",
        "Presidente Prudente - SP", "Araçatuba - SP", "Araraquara - SP", "Franca - SP", "Limeira - SP",
        "Rio de Janeiro - RJ", "Niterói - RJ", "Duque de Caxias - RJ", "São Gonçalo - RJ", "Volta Redonda - RJ",
        "Belo Horizonte - MG", "Uberlândia - MG", "Contagem - MG", "Juiz de Fora - MG", "Betim - MG",
        "Montes Claros - MG", "Uberaba - MG", "Governador Valadares - MG", "Ipatinga - MG", "Pouso Alegre - MG",
        "Curitiba - PR", "Londrina - PR", "Maringá - PR", "Ponta Grossa - PR", "Cascavel - PR", "Foz do Iguaçu - PR",
        "Porto Alegre - RS", "Caxias do Sul - RS", "Canoas - RS", "Pelotas - RS", "Santa Maria - RS", "Passo Fundo - RS",
        "Florianópolis - SC", "Joinville - SC", "Blumenau - SC", "Itajaí - SC", "Chapecó - SC", "Criciúma - SC",
        "Goiânia - GO", "Aparecida de Goiânia - GO", "Anápolis - GO", "Rio Verde - GO", "Itumbiara - GO",
        "Brasília - DF",
        "Cuiabá - MT", "Várzea Grande - MT", "Rondonópolis - MT", "Sinop - MT", "Sorriso - MT", "Lucas do Rio Verde - MT",
        "Campo Grande - MS", "Dourados - MS", "Três Lagoas - MS", "Corumbá - MS",
        "Salvador - BA", "Feira de Santana - BA", "Vitória da Conquista - BA", "Camaçari - BA", "Itabuna - BA", "Luís Eduardo Magalhães - BA",
        "Recife - PE", "Jaboatão dos Guararapes - PE", "Petrolina - PE", "Caruaru - PE",
        "Fortaleza - CE", "Caucaia - CE", "Juazeiro do Norte - CE", "Sobral - CE",
        "São Luís - MA", "Imperatriz - MA",
        "Belém - PA", "Ananindeua - PA", "Santarém - PA", "Marabá - PA", "Parauapebas - PA",
        "Manaus - AM",
        "Vitória - ES", "Vila Velha - ES", "Serra - ES", "Cariacica - ES", "Linhares - ES",
        "Natal - RN", "Mossoró - RN",
        "João Pessoa - PB", "Campina Grande - PB",
        "Maceió - AL", "Arapiraca - AL",
        "Teresina - PI", "Parnaíba - PI",
        "Aracaju - SE",
        "Porto Velho - RO", "Ji-Paraná - RO", "Vilhena - RO", "Cacoal - RO",
        "Palmas - TO", "Araguaína - TO", "Gurupi - TO",
        "Macapá - AP", "Boa Vista - RR", "Rio Branco - AC"
    ].sort((a, b) => a.localeCompare('pt-BR'));

    let cacheCidadesIBGE = null;
    let buscandoIBGEEmProgresso = false;

    // Normalizador de texto para busca case-insensitive e sem acentos
    function normalizarTextoBuscaIBGE(str) {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    // Escape seguro de caracteres HTML para renderização
    function escapeHTMLAutocomplete(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Regra de governança: verifica se o campo está bloqueado pela gestão
    function campoEstaBloqueadoGovernança(campo) {
        if (!campo) return true;
        return campo.readOnly ||
            campo.disabled ||
            campo.hasAttribute('readonly') ||
            campo.classList.contains('campo-bloqueado-gestao') ||
            Boolean(campo.closest('.campo-bloqueado-gestao'));
    }

    // Função assíncrona de carregamento e cache das cidades do IBGE
    async function obterCidadesIBGE() {
        if (cacheCidadesIBGE && cacheCidadesIBGE.length > 0) {
            return cacheCidadesIBGE;
        }

        // 1. Tenta carregar do localStorage
        try {
            const salvo = localStorage.getItem(STORAGE_IBGE_CIDADES);
            if (salvo) {
                const lista = JSON.parse(salvo);
                if (Array.isArray(lista) && lista.length > 0) {
                    cacheCidadesIBGE = lista;
                    return cacheCidadesIBGE;
                }
            }
        } catch (e) {
            console.warn('Erro ao ler cache do IBGE no localStorage:', e);
        }

        // Fallback preliminar para resposta imediata
        cacheCidadesIBGE = [...FALLBACK_CIDADES_IBGE];

        if (buscandoIBGEEmProgresso) {
            return cacheCidadesIBGE;
        }
        buscandoIBGEEmProgresso = true;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const resposta = await fetch(URL_IBGE_MUNICIPIOS, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!resposta.ok) {
                throw new Error(`Falha HTTP ${resposta.status}`);
            }

            const dados = await resposta.json();
            if (Array.isArray(dados) && dados.length > 0) {
                const listaFormatada = dados.map((m) => {
                    if (!m || !m.nome) return null;
                    const uf = m?.microrregiao?.mesorregiao?.UF?.sigla ||
                        m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || '';
                    return uf ? `${m.nome} - ${uf}` : m.nome;
                }).filter(Boolean);

                listaFormatada.sort((a, b) => a.localeCompare('pt-BR'));

                cacheCidadesIBGE = listaFormatada;

                try {
                    localStorage.setItem(STORAGE_IBGE_CIDADES, JSON.stringify(listaFormatada));
                } catch (eStorage) {
                    console.warn('Não foi possível gravar cidades no localStorage:', eStorage);
                }
            }
        } catch (erro) {
            console.warn('API IBGE indisponível ou offline. Usando fallback gracioso.', erro);
            if (!cacheCidadesIBGE || cacheCidadesIBGE.length === 0) {
                cacheCidadesIBGE = [...FALLBACK_CIDADES_IBGE];
            }
        } finally {
            buscandoIBGEEmProgresso = false;
        }

        return cacheCidadesIBGE;
    }

    // Inicialização do módulo de auto-complete (Combobox / Select Pesquisável)
    function inicializarAutoCompleteCidadesIBGE() {
        // Dispara pré-carregamento em segundo plano
        obterCidadesIBGE();

        // Dropdown singleton flutuante anexado ao body (impede quebra em tabelas e overflow)
        let dropdownEl = document.getElementById('ajborges-autocomplete-cidades-dropdown');
        if (!dropdownEl) {
            dropdownEl = document.createElement('ul');
            dropdownEl.id = 'ajborges-autocomplete-cidades-dropdown';
            dropdownEl.className = 'autocomplete-cidades-dropdown';
            dropdownEl.setAttribute('role', 'listbox');
            dropdownEl.setAttribute('aria-label', 'Sugestões de cidades do Brasil');
            document.body.appendChild(dropdownEl);
        }

        let inputAtivo = null;
        let indiceFoco = -1;
        let debounceTimer = null;
        let listaCompletaFiltrada = [];
        let quantidadeItensRenderizados = 0;
        let ultimoTermoBuscado = '';

        const TAMANHO_LOTE_INICIAL = 45;
        const TAMANHO_LOTE_SCROLL = 30;

        function fecharTodasAsSetinhas() {
            document.querySelectorAll('.btn-combobox-seta.aberto').forEach((btn) => btn.classList.remove('aberto'));
            document.querySelectorAll('.combobox-aberto').forEach((wrap) => wrap.classList.remove('combobox-aberto'));
        }

        function atualizarEstadoSetinha(input, aberta) {
            if (!input) return;
            const wrapper = input.closest('.input-wrapper, .combobox-cidade-wrap');
            const seta = wrapper ? wrapper.querySelector('.btn-combobox-seta') : null;
            if (seta) {
                if (aberta) {
                    seta.classList.add('aberto');
                    wrapper?.classList.add('combobox-aberto');
                } else {
                    seta.classList.remove('aberto');
                    wrapper?.classList.remove('combobox-aberto');
                }
            }
        }

        function fecharDropdown() {
            if (dropdownEl) {
                dropdownEl.style.display = 'none';
                dropdownEl.innerHTML = '';
            }
            fecharTodasAsSetinhas();
            indiceFoco = -1;
            listaCompletaFiltrada = [];
            quantidadeItensRenderizados = 0;
            ultimoTermoBuscado = '';
            inputAtivo = null;
        }

        function isDropdownAberto() {
            return dropdownEl && dropdownEl.style.display === 'block';
        }

        function posicionarDropdown(input) {
            if (!dropdownEl || !input) return;
            const rect = input.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                fecharDropdown();
                return;
            }

            const scrollX = window.scrollX || window.pageXOffset || 0;
            const scrollY = window.scrollY || window.pageYOffset || 0;

            const larguraMinima = Math.max(rect.width, 240);
            let top = rect.bottom + scrollY + 4;
            let left = rect.left + scrollX;

            const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
            if (left + larguraMinima > viewportWidth - 12) {
                left = Math.max(12, viewportWidth - larguraMinima - 12);
            }

            dropdownEl.style.top = `${top}px`;
            dropdownEl.style.left = `${left}px`;
            dropdownEl.style.minWidth = `${rect.width}px`;
            dropdownEl.style.width = `${larguraMinima}px`;
        }

        function reposicionarSeAberto() {
            if (isDropdownAberto() && inputAtivo) {
                posicionarDropdown(inputAtivo);
            }
        }

        window.addEventListener('resize', reposicionarSeAberto, { passive: true });
        window.addEventListener('scroll', reposicionarSeAberto, { passive: true, capture: true });

        // Filtragem dinâmica de cidades (ou lista completa quando campo vazio)
        function filtrarCidades(termo) {
            const lista = cacheCidadesIBGE || FALLBACK_CIDADES_IBGE;
            const termoNorm = normalizarTextoBuscaIBGE(termo);

            // Se o campo estiver vazio ou limpo, exibe todas as 5.500 cidades em ordem alfabética
            if (!termoNorm) {
                return lista;
            }

            const correspondenciasExatasInicio = [];
            const correspondenciasInicio = [];
            const correspondenciasMeio = [];

            for (let i = 0; i < lista.length; i++) {
                const cidade = lista[i];
                const cidadeNorm = normalizarTextoBuscaIBGE(cidade);
                const nomeNorm = cidadeNorm.split(' - ')[0] || cidadeNorm;

                if (nomeNorm === termoNorm) {
                    correspondenciasExatasInicio.push(cidade);
                } else if (cidadeNorm.startsWith(termoNorm)) {
                    correspondenciasInicio.push(cidade);
                } else if (cidadeNorm.includes(termoNorm)) {
                    correspondenciasMeio.push(cidade);
                }
            }

            return [...correspondenciasExatasInicio, ...correspondenciasInicio, ...correspondenciasMeio];
        }

        function selecionarSugestao(valor) {
            if (!inputAtivo) return;
            inputAtivo.value = valor;
            inputAtivo.dispatchEvent(new Event('input', { bubbles: true }));
            inputAtivo.dispatchEvent(new Event('change', { bubbles: true }));
            fecharDropdown();
        }

        function atualizarItemAtivoVisual(novoIndice) {
            const itens = dropdownEl.querySelectorAll('.autocomplete-cidades-item');
            if (!itens.length) return;

            if (indiceFoco >= 0 && itens[indiceFoco]) {
                itens[indiceFoco].classList.remove('ativo');
                itens[indiceFoco].removeAttribute('aria-selected');
            }

            if (novoIndice < 0) {
                indiceFoco = -1;
                return;
            }

            if (novoIndice >= itens.length) {
                novoIndice = 0;
            } else if (novoIndice < 0) {
                novoIndice = itens.length - 1;
            }

            indiceFoco = novoIndice;
            const itemAtual = itens[indiceFoco];
            if (itemAtual) {
                itemAtual.classList.add('ativo');
                itemAtual.setAttribute('aria-selected', 'true');
                itemAtual.scrollIntoView({ block: 'nearest' });
            }
        }

        // Renderização em lotes sob demanda (Lazy Loading / Infinite Scroll)
        function renderizarProximoBloco(termoBusca) {
            if (!dropdownEl) return;
            const totalDisponivel = listaCompletaFiltrada.length;
            if (quantidadeItensRenderizados >= totalDisponivel) return;

            const fim = Math.min(quantidadeItensRenderizados + TAMANHO_LOTE_SCROLL, totalDisponivel);
            const fragment = document.createDocumentFragment();
            const termoNorm = normalizarTextoBuscaIBGE(termoBusca);

            for (let i = quantidadeItensRenderizados; i < fim; i++) {
                const cidadeStr = listaCompletaFiltrada[i];
                const li = document.createElement('li');
                li.className = 'autocomplete-cidades-item';
                li.setAttribute('role', 'option');
                li.dataset.index = i;

                const partes = cidadeStr.split(' - ');
                const nomeCidade = partes[0] || cidadeStr;
                const uf = partes[1] || '';

                // Ícone pin
                const spanIcone = document.createElement('span');
                spanIcone.className = 'item-icone';
                spanIcone.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

                // Nome da cidade com destaque se houver termo
                const spanNome = document.createElement('span');
                spanNome.className = 'item-nome';
                if (termoNorm && termoNorm.length > 0) {
                    const idxMatch = normalizarTextoBuscaIBGE(nomeCidade).indexOf(termoNorm);
                    if (idxMatch >= 0) {
                        const antes = nomeCidade.substring(0, idxMatch);
                        const meio = nomeCidade.substring(idxMatch, idxMatch + termoBusca.length);
                        const depois = nomeCidade.substring(idxMatch + termoBusca.length);
                        spanNome.innerHTML = `${escapeHTMLAutocomplete(antes)}<mark>${escapeHTMLAutocomplete(meio)}</mark>${escapeHTMLAutocomplete(depois)}`;
                    } else {
                        spanNome.textContent = nomeCidade;
                    }
                } else {
                    spanNome.textContent = nomeCidade;
                }

                // Badge de UF
                const spanUf = document.createElement('span');
                spanUf.className = 'item-uf';
                spanUf.textContent = uf;

                li.appendChild(spanIcone);
                li.appendChild(spanNome);
                if (uf) li.appendChild(spanUf);

                // Seleção com o mouse
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selecionarSugestao(cidadeStr);
                });

                // Hover sincronizado
                li.addEventListener('mouseenter', () => {
                    atualizarItemAtivoVisual(i);
                });

                fragment.appendChild(li);
            }

            dropdownEl.appendChild(fragment);
            quantidadeItensRenderizados = fim;
        }

        // Listener de Infinite Scroll no dropdown
        dropdownEl.addEventListener('scroll', () => {
            if (dropdownEl.scrollTop + dropdownEl.clientHeight >= dropdownEl.scrollHeight - 70) {
                renderizarProximoBloco(ultimoTermoBuscado);
            }
        }, { passive: true });

        // Abre o dropdown e carrega os primeiros itens
        function exibirSugestoes(termo, input) {
            if (campoEstaBloqueadoGovernança(input)) {
                fecharDropdown();
                return;
            }

            ultimoTermoBuscado = termo || '';
            listaCompletaFiltrada = filtrarCidades(termo);
            quantidadeItensRenderizados = 0;
            indiceFoco = -1;
            inputAtivo = input;
            dropdownEl.innerHTML = '';
            dropdownEl.scrollTop = 0;

            fecharTodasAsSetinhas();
            atualizarEstadoSetinha(input, true);

            if (listaCompletaFiltrada.length === 0) {
                const divVazio = document.createElement('div');
                divVazio.className = 'autocomplete-cidades-vazio';
                divVazio.textContent = 'Nenhuma cidade encontrada';
                dropdownEl.appendChild(divVazio);
            } else {
                // Renderiza primeiro bloco sob demanda
                const limiteInicial = Math.min(TAMANHO_LOTE_INICIAL, listaCompletaFiltrada.length);
                const fragment = document.createDocumentFragment();
                const termoNorm = normalizarTextoBuscaIBGE(termo);

                for (let i = 0; i < limiteInicial; i++) {
                    const cidadeStr = listaCompletaFiltrada[i];
                    const li = document.createElement('li');
                    li.className = 'autocomplete-cidades-item';
                    li.setAttribute('role', 'option');
                    li.dataset.index = i;

                    const partes = cidadeStr.split(' - ');
                    const nomeCidade = partes[0] || cidadeStr;
                    const uf = partes[1] || '';

                    const spanIcone = document.createElement('span');
                    spanIcone.className = 'item-icone';
                    spanIcone.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

                    const spanNome = document.createElement('span');
                    spanNome.className = 'item-nome';
                    if (termoNorm && termoNorm.length > 0) {
                        const idxMatch = normalizarTextoBuscaIBGE(nomeCidade).indexOf(termoNorm);
                        if (idxMatch >= 0) {
                            const antes = nomeCidade.substring(0, idxMatch);
                            const meio = nomeCidade.substring(idxMatch, idxMatch + termo.length);
                            const depois = nomeCidade.substring(idxMatch + termo.length);
                            spanNome.innerHTML = `${escapeHTMLAutocomplete(antes)}<mark>${escapeHTMLAutocomplete(meio)}</mark>${escapeHTMLAutocomplete(depois)}`;
                        } else {
                            spanNome.textContent = nomeCidade;
                        }
                    } else {
                        spanNome.textContent = nomeCidade;
                    }

                    const spanUf = document.createElement('span');
                    spanUf.className = 'item-uf';
                    spanUf.textContent = uf;

                    li.appendChild(spanIcone);
                    li.appendChild(spanNome);
                    if (uf) li.appendChild(spanUf);

                    li.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        selecionarSugestao(cidadeStr);
                    });

                    li.addEventListener('mouseenter', () => {
                        atualizarItemAtivoVisual(i);
                    });

                    fragment.appendChild(li);
                }

                dropdownEl.appendChild(fragment);
                quantidadeItensRenderizados = limiteInicial;
            }

            posicionarDropdown(input);
            dropdownEl.style.display = 'block';
        }

        // Alterna abertura ao clicar na setinha
        function alternarDropdownParaInput(input) {
            if (campoEstaBloqueadoGovernança(input)) return;

            if (isDropdownAberto() && inputAtivo === input) {
                fecharDropdown();
            } else {
                inputAtivo = input;
                const valor = (input.value || '').trim();
                exibirSugestoes(valor, input);
                input.focus();
            }
        }

        // Fechar ao clicar fora
        document.addEventListener('pointerdown', (e) => {
            if (!isDropdownAberto()) return;
            if (dropdownEl.contains(e.target)) return;
            if (inputAtivo && inputAtivo.contains(e.target)) return;

            const wrap = inputAtivo?.closest('.input-wrapper, .combobox-cidade-wrap');
            if (wrap && wrap.contains(e.target)) return;

            fecharDropdown();
        });

        // Configuração de eventos e listeners nos inputs e botões
        function vincularCampo(input) {
            if (!input || input._autocompleteIBGEVinculado) return;
            input._autocompleteIBGEVinculado = true;
            input.setAttribute('autocomplete', 'off');

            const wrapper = input.closest('.input-wrapper, .combobox-cidade-wrap');
            const btnSeta = wrapper ? wrapper.querySelector('.btn-combobox-seta') : null;

            // Governança: esconde a setinha se o campo já nascer bloqueado
            if (campoEstaBloqueadoGovernança(input) && btnSeta) {
                btnSeta.style.display = 'none';
            }

            // Clique na setinha chevron
            if (btnSeta) {
                btnSeta.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alternarDropdownParaInput(input);
                });
            }

            // Clique no próprio campo: abre imediatamente o dropdown
            input.addEventListener('click', () => {
                if (campoEstaBloqueadoGovernança(input)) return;
                if (!isDropdownAberto() || inputAtivo !== input) {
                    inputAtivo = input;
                    const valor = (input.value || '').trim();
                    exibirSugestoes(valor, input);
                }
            });

            // Digitação: filtra em tempo real (mesmo apagando ou digitando 1 letra)
            input.addEventListener('input', () => {
                if (campoEstaBloqueadoGovernança(input)) {
                    fecharDropdown();
                    return;
                }

                clearTimeout(debounceTimer);
                const valor = (input.value || '').trim();

                // Filtro dinâmico com debounce rápido de 60ms
                debounceTimer = setTimeout(() => {
                    inputAtivo = input;
                    exibirSugestoes(valor, input);
                }, 60);
            });

            // Teclado: Setas Cima/Baixo, Enter, Escape e Tab
            input.addEventListener('keydown', (e) => {
                if (campoEstaBloqueadoGovernança(input)) return;

                if (isDropdownAberto()) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (indiceFoco >= quantidadeItensRenderizados - 5) {
                            renderizarProximoBloco(ultimoTermoBuscado);
                        }
                        atualizarItemAtivoVisual(indiceFoco + 1);
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        atualizarItemAtivoVisual(indiceFoco - 1);
                        return;
                    }
                    if (e.key === 'Enter') {
                        if (indiceFoco >= 0 && listaCompletaFiltrada[indiceFoco]) {
                            e.preventDefault();
                            e.stopPropagation();
                            selecionarSugestao(listaCompletaFiltrada[indiceFoco]);
                            return;
                        }
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        fecharDropdown();
                        return;
                    }
                    if (e.key === 'Tab') {
                        fecharDropdown();
                        return;
                    }
                } else {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        alternarDropdownParaInput(input);
                    }
                }
            });
        }

        // Mapeamento estrito dos campos solicitados:
        // - Destino Inicial (#destino-inicial)
        // - Destino Final (#destino-final)
        // - Origem de cada linha de frete ("origem_frete_ml_1" a 8)
        // - Destino de cada linha de frete ("destino_frete_ml_1" a 8)
        function vincularTodosOsCampos() {
            const campos = [
                document.getElementById('destino-inicial'),
                document.getElementById('destino-final')
            ];

            for (let i = 1; i <= 8; i++) {
                const origem = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                const destino = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                if (origem) campos.push(origem);
                if (destino) campos.push(destino);
            }

            campos.filter(Boolean).forEach(vincularCampo);
        }

        vincularTodosOsCampos();
    }

    inicializarAutoCompleteCidadesIBGE();

    // ------------------------------------------
    // 4. Cálculo Automático do KM Total (trecho da principal + trecho da secundária)
    // ------------------------------------------
    // Um trecho: chegada − saída. Sem total se faltar um dos dois ou se a chegada for menor.
    function kmTrecho(inputSaida, inputEntrada) {
        const saida = parseInt((inputSaida?.value || '').replace(/\D/g, ''), 10);
        const entrada = parseInt((inputEntrada?.value || '').replace(/\D/g, ''), 10);
        if (isNaN(saida) || isNaN(entrada)) return { total: null, invalido: false };
        return entrada >= saida ? { total: entrada - saida, invalido: false } : { total: null, invalido: true };
    }

    function segundoTrechoAtivo() {
        return !!(blocoKmSecundaria && !blocoKmSecundaria.hidden);
    }

    // Totais sem mexer na tela (usado nos indicadores e no envio)
    function kmsDaViagem() {
        const t1 = kmTrecho(inputKmSaida, inputKmChegada);
        const t2 = segundoTrechoAtivo() ? kmTrecho(inputKmSaida2, inputKmChegada2) : { total: null, invalido: false };
        const viagem = (t1.total === null && t2.total === null) ? null : (t1.total || 0) + (t2.total || 0);
        return { t1, t2, viagem };
    }

    function mostrarErroKm(inputEntrada, idErro, invalido) {
        const erro = document.getElementById(idErro);
        if (erro) erro.hidden = !invalido;
        inputEntrada?.closest('.input-wrapper')?.classList.toggle('campo-invalido', invalido);
    }

    function calcularKmTotal() {
        const kms = kmsDaViagem();
        mostrarErroKm(inputKmChegada, 'erro-km-principal', kms.t1.invalido);
        mostrarErroKm(inputKmChegada2, 'erro-km-secundaria', kms.t2.invalido);

        if (inputKmTotal) inputKmTotal.value = kms.t1.total === null ? '' : formatarMilhar(kms.t1.total);
        if (inputKmTotal2) inputKmTotal2.value = kms.t2.total === null ? '' : formatarMilhar(kms.t2.total);
        if (spanKmTotalViagem) spanKmTotalViagem.textContent = kms.viagem === null ? '0' : formatarMilhar(kms.viagem);

        if (typeof calcularIndicadoresViagemMl === 'function') {
            calcularIndicadoresViagemMl();
        }
        return kms;
    }

    // ------------------------------------------
    // 4.1. Placa secundária (troca de cavalo): libera o 2º trecho de KM e a coluna
    //      "Placa" do abastecimento. Grava sem hífen (ex.: XYZ9A87).
    // ------------------------------------------
    const limparPlaca = (valor) => String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatarPlaca = (valor) => {
        const limpo = limparPlaca(valor);
        return limpo.length > 3 ? `${limpo.slice(0, 3)}-${limpo.slice(3)}` : limpo;
    };
    // Formato antigo (ABC1234) ou Mercosul (ABC1D23), o mesmo que o banco aceita
    const placaValida = (limpo) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(limpo);

    function placaSecundariaAtual() {
        const limpo = limparPlaca(inputPlacaSecundaria?.value);
        return placaValida(limpo) ? limpo : '';
    }

    const tabelaAbastecimento = document.querySelector('table.tabela-abastecimento:not(.tabela-fretes-ml)');
    const selectsPlacaAbast = () => Array.from(document.querySelectorAll('select.input-placa-abast'));

    function placaPrincipalAtual() {
        const limpo = limparPlaca(inputPlacas?.value);
        return placaValida(limpo) ? limpo : '';
    }

    // Texto de cada placa: "Principal (ABC-1D23)" e "Secundária (XYZ-9A87)" (sem placa: só o nome)
    function rotuloPlacaAbast(qual) {
        const placa = qual === 'secundaria' ? placaSecundariaAtual() : placaPrincipalAtual();
        const nome = qual === 'secundaria' ? 'Secundária' : 'Principal';
        return placa ? `${nome} (${formatarPlaca(placa)})` : nome;
    }

    // Os valores gravados são sempre 'principal' e 'secundaria'; só o texto mostra a placa
    function atualizarOpcoesPlacaAbast() {
        selectsPlacaAbast().forEach(sel => {
            if (sel.options[0]) sel.options[0].textContent = rotuloPlacaAbast('principal');
            if (sel.options[1]) sel.options[1].textContent = rotuloPlacaAbast('secundaria');
        });
    }

    // Mostra/esconde o bloco do 2º trecho e a coluna "Placa" conforme a placa secundária
    function atualizarSegundoTrecho() {
        const secundaria = placaSecundariaAtual();
        const ativo = !!secundaria;
        if (blocoKmSecundaria) blocoKmSecundaria.hidden = !ativo;
        const tagPlaca = document.getElementById('km-secundaria-placa');
        if (tagPlaca) tagPlaca.textContent = ativo ? formatarPlaca(secundaria) : '';
        if (tabelaAbastecimento) tabelaAbastecimento.classList.toggle('com-placa-secundaria', ativo);
        // Com placa secundária, KM de saída e de chegada do 2º trecho são obrigatórios
        [inputKmSaida2, inputKmChegada2].forEach(input => { if (input) input.required = ativo; });
        // Os rótulos "TOTAL DIESEL" e "TOTAL ARLA" cobrem a coluna Placa só quando ela aparece
        ['td-totais-label-abast', 'td-totais-label-arla'].forEach(id => {
            const tdTotais = document.getElementById(id);
            if (tdTotais) tdTotais.colSpan = ativo ? 6 : 5;
        });
        atualizarOpcoesPlacaAbast();
        calcularKmTotal();
    }

    // Placa secundária apagada: limpa o 2º trecho e volta os abastecimentos para a principal
    function limparSegundoTrecho() {
        if (inputKmSaida2) inputKmSaida2.value = '';
        if (inputKmChegada2) inputKmChegada2.value = '';
        if (inputKmTotal2) inputKmTotal2.value = '';
        selectsPlacaAbast().forEach(sel => { sel.value = 'principal'; });
    }

    let placaSecundariaAnterior = '';
    if (inputPlacaSecundaria) {
        // Registrado depois da máscara: aqui o valor já vem formatado
        inputPlacaSecundaria.addEventListener('input', () => {
            const limpo = limparPlaca(inputPlacaSecundaria.value);
            if (!limpo && segundoTrechoAtivo()) {
                const temDados = [inputKmSaida2, inputKmChegada2].some(i => i && i.value.trim() !== '') ||
                    selectsPlacaAbast().some(sel => sel.value === 'secundaria');
                if (temDados && !confirm('Apagar a placa secundária também apaga o KM da placa secundária e volta os abastecimentos dela para a placa principal. Continuar?')) {
                    inputPlacaSecundaria.value = formatarPlaca(placaSecundariaAnterior);
                    return;
                }
                limparSegundoTrecho();
            }
            // Enquanto digita (1 a 6 caracteres) o bloco fica como está
            if (!limpo || placaSecundariaAtual()) atualizarSegundoTrecho();
            if (placaSecundariaAtual()) placaSecundariaAnterior = placaSecundariaAtual();
            if (typeof salvarProgressoMl === 'function') salvarProgressoMl();
        });
    }
    if (inputPlacas) {
        inputPlacas.addEventListener('input', () => {
            atualizarOpcoesPlacaAbast();
            // O card de média mostra a placa ao lado da média
            if (typeof calcularIndicadoresViagemMl === 'function') calcularIndicadoresViagemMl();
        });
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

    // Aplica máscara no valor do adiantamento
    if (inputAdiantamento) {
        aplicarMascaraMoeda(inputAdiantamento, () => {
            if (typeof calcularIndicadoresViagemMl === 'function') {
                calcularIndicadoresViagemMl();
            }
            if (typeof salvarProgressoMl === 'function') {
                salvarProgressoMl();
            }
        });
    }



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
    const tabelaFretesMl = document.querySelector('table.tabela-fretes-ml');

    // Tipo de veículo do motorista da ficha e comissões especiais do Alimentício
    // (RPC veiculo_do_motorista, passo 13). Sem resposta do banco vale carreta, sem
    // comissões especiais: a tela só mostra a conta, quem grava a comissão é o banco.
    const veiculoMotorista = { tipo: 'carreta', comCarreta: null, comRodotrem: null };
    const ROTULOS_VEICULO = { carreta: 'Carreta', rodotrem: 'Rodotrem' };
    const motoristaEscolheVeiculo = () => veiculoMotorista.tipo === 'rodotrem' || veiculoMotorista.tipo === 'carreta_rodotrem';

    // Destino Viana (ES): sem acento, sem diferenciar maiúsculas e sem espaços sobrando.
    // "Viana", "Viana/ES", "Viana - ES", "Viana ES" e "Viana, ES"; outro estado não vale.
    // Mesma regra de public._eh_viana_es (passo 13; usada no destino desde o passo 15).
    function ehVianaES(texto) {
        const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
        return /^viana(\s*[\/,-]\s*es|\s+es)?$/.test(t);
    }

    // Veículo da linha: motorista de carreta é sempre 'carreta'; o de rodotrem escolhe ('' = não escolheu)
    function veiculoDaLinhaFrete(i) {
        if (!motoristaEscolheVeiculo()) return 'carreta';
        const v = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`)?.value || '';
        return ROTULOS_VEICULO[v] ? v : '';
    }

    // REGRA DA COMISSÃO (a mesma de public._limpar_fretes, passo 15). null = sem comissão.
    // Mercado Livre R$ 400; Shopee 11%; Alimentício pelo veículo da linha: rodotrem usa a
    // especial de rodotrem do motorista, senão 8% (destino Viana-ES) ou 9%; carreta usa a
    // especial de carreta, senão 11%.
    function calcularComissaoFrete(cliente, valor, destino, veiculo) {
        const centavos = Math.round((Number(valor) || 0) * 100);
        if (!(centavos > 0)) return null;
        if (cliente === 'mercado_livre') return 400;
        let pct = null;
        if (cliente === 'shopee') pct = 11;
        else if (cliente === 'alimenticio' && veiculo === 'rodotrem') pct = veiculoMotorista.comRodotrem ?? (ehVianaES(destino) ? 8 : 9);
        else if (cliente === 'alimenticio' && veiculo === 'carreta') pct = veiculoMotorista.comCarreta ?? 11;
        if (pct === null) return null;
        // Em centavos e centésimos de %, arredondando em 2 casas como o round() do banco
        return Math.floor((centavos * Math.round(pct * 100) + 5000) / 10000) / 100;
    }

    // Mostra/esconde a coluna "Veículo" (motorista de rodotrem) e, se pedido, refaz as comissões
    function aplicarTipoVeiculoFretes(recalcular) {
        const mostrar = motoristaEscolheVeiculo();
        if (tabelaFretesMl) tabelaFretesMl.classList.toggle('com-veiculo', mostrar);
        const tdTotais = document.getElementById('td-totais-label-fretes');
        if (tdTotais) tdTotais.colSpan = mostrar ? 6 : 5;
        if (recalcular) {
            for (let i = 1; i <= 8; i++) atualizarLinhaFreteMl(i, false);
        }
        calcularTotaisFreteMl();
        calcularIndicadoresViagemMl();
    }

    // Busca o tipo de veículo e as comissões especiais. Motorista: o próprio perfil (sem
    // parâmetro); gestão: o motorista da ficha. Se falhar, segue como carreta e avisa.
    async function carregarVeiculoMotorista(motoristaId, recalcular) {
        let dados = null;
        let falhou = false;
        try {
            const cliente = window.supabaseClient;
            if (!cliente) throw new Error('Supabase indisponível');
            const { data, error } = await cliente.rpc('veiculo_do_motorista', motoristaId ? { p_id: motoristaId } : {});
            if (error) throw error;
            dados = Array.isArray(data) ? data[0] : data;
        } catch (e) {
            console.warn('Não foi possível carregar o tipo de veículo:', (e && e.message) || e);
            falhou = true;
        }
        const pct = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v);
        const tipo = dados && ['rodotrem', 'carreta_rodotrem'].includes(dados.tipo_veiculo) ? dados.tipo_veiculo : 'carreta';
        veiculoMotorista.tipo = falhou ? 'carreta' : tipo;
        veiculoMotorista.comCarreta = falhou ? null : pct(dados && dados.comissao_alim_carreta);
        veiculoMotorista.comRodotrem = falhou ? null : pct(dados && dados.comissao_alim_rodotrem);
        const aviso = document.getElementById('aviso-veiculo-frete');
        if (aviso) aviso.hidden = !falhou;
        aplicarTipoVeiculoFretes(recalcular);
    }

    function atualizarLinhaFreteMl(index, acaoDisparadaPorSelect = false) {
        const selectCli = document.querySelector(`select[name="cliente_frete_ml_${index}"]`);
        const inputValFrete = document.querySelector(`input[name="valor_frete_ml_${index}"]`);
        const inputComissao = document.querySelector(`input[name="comissao_frete_ml_${index}"]`);
        const inputDestino = document.querySelector(`input[name="destino_frete_ml_${index}"]`);

        if (!selectCli || !inputValFrete || !inputComissao) return;

        // Identifica perfil ativo (Admin vs Motorista)
        const urlParamsAtual = new URLSearchParams(window.location.search);
        const modeUrlAtual = urlParamsAtual.get('mode');
        const userSalvoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let userSalvo = null;
        try { if (userSalvoStr) userSalvo = JSON.parse(userSalvoStr); } catch (e) {}
        const isModoAdminAtivo = (modeUrlAtual === 'admin') || (userSalvo && (userSalvo.role === 'admin' || userSalvo.role === 'diretoria') && modeUrlAtual !== 'motorista');

        const tipoOperacao = selectCli.value;
        if (!tipoOperacao && acaoDisparadaPorSelect) inputValFrete.value = '';

        const comissao = calcularComissaoFrete(tipoOperacao, parseMoeda(inputValFrete.value), inputDestino?.value, veiculoDaLinhaFrete(index));
        const textoComissao = comissao === null ? '' : formatarMoedaSemPrefixo(comissao);

        // Valor do frete: o motorista e a gestão preenchem
        inputValFrete.removeAttribute('readonly');
        inputValFrete.removeAttribute('disabled');
        inputValFrete.classList.remove('campo-bloqueado-gestao');

        if (isModoAdminAtivo) {
            // No Modo Administrador: comissão editável; o cálculo automático não passa
            // por cima do que a gestão digitou (só quando ela troca o cliente ou o veículo)
            inputComissao.removeAttribute('readonly');
            inputComissao.removeAttribute('disabled');
            inputComissao.classList.remove('campo-bloqueado-gestao');

            if (acaoDisparadaPorSelect || !inputComissao.dataset.editadoManual) {
                inputComissao.value = textoComissao;
                inputComissao.dataset.editadoManual = '';
            }
        } else {
            // No Modo Motorista: comissão calculada sozinha e só para leitura (o banco recalcula no envio)
            inputComissao.setAttribute('readonly', 'true');
            inputComissao.classList.add('campo-bloqueado-gestao');
            inputComissao.value = textoComissao;
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
            // Gestão digitou a comissão: o cálculo automático deixa de mexer nela
            inputComissao.addEventListener('input', (e) => {
                if (e.isTrusted && !inputComissao.readOnly) inputComissao.dataset.editadoManual = '1';
            });
        }

        // Veículo da linha (motorista de rodotrem): muda a comissão do Alimentício
        const selectVeiculo = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
        if (selectVeiculo) {
            selectVeiculo.addEventListener('change', () => {
                atualizarLinhaFreteMl(i, true);
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
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
                // Destino Viana (ES) muda a comissão do rodotrem
                atualizarLinhaFreteMl(i, false);
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasPreenchidasPopover === 'function') {
                    atualizarListaLinhasPreenchidasPopover();
                }
            });
        }

        // Lixeira na coluna de numeração: "Remover" a linha (da 2ª em diante)
        const btnLimparInline = document.querySelector(`.btn-limpar-linha-inline[data-linha="${i}"]`);
        if (btnLimparInline) {
            btnLimparInline.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removerLinhaLista('fretes', i);
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

        // Estes totais são o "Total frete" e o "Vr comissão" da ficha (indicadores e envio)
        return { frete: somaFrete, comissao: somaComissao, descarga: somaDescarga };
    }

    // 15.2. Abastecimento ML (10 Linhas - Sem Média)
    const inputsValorAbastMl = [];
    const inputsLitrosAbastMl = [];
    const inputTotalValorDieselMl = document.getElementById('ml-total-valor-diesel');
    const inputTotalLitrosDieselMl = document.getElementById('ml-total-litros-diesel');
    const inputTotalValorArlaMl = document.getElementById('ml-total-valor-arla');
    const inputTotalLitrosArlaMl = document.getElementById('ml-total-litros-arla');

    // Lista Oficial dos 38 Postos de Combustíveis Conveniados da AJBorges
    const POSTOS_COMBUSTIVEL_CONVENIADOS = [
        "Açailândia - Posto Magnólia 06",
        "Anaurilândia - Posto Lala (93)",
        "Araporã - Posto Décio",
        "Araquari - Posto Russi",
        "Campo Grande - MS - Posto Fortaleza (IDEAL)",
        "Caxias do Sul - Posto Squizzato",
        "Centralina - MG Posto Décio",
        "Corumbataí - Monte Carlo",
        "Coxilha - Posto Buffon",
        "Dom Pedro de Alcântara - Posto Rota",
        "Guará - Posto Monte Carlo",
        "Gurupi - TO Posto Décio",
        "Juiz de Fora - Posto Dom Pedro",
        "Luz - Caxuxa Matriz",
        "Marília - Posto Esmeralda",
        "Marília - Posto Gigantão",
        "Mimoso do Sul - ES - Posto Cajú",
        "Mirassol - Monte Carlo",
        "Moema - Posto Caxuxa",
        "Montes Claros - Rede HG",
        "Nova Santa Rita - Posto Buffon",
        "Olímpia - Posto Rei do Suco",
        "Passo Fundo - Posto Buffon",
        "Ribeirão Preto - Monte Carlo",
        "Rio Claro - Monte Carlo",
        "Santa Cecília - Posto Cesca & Cia",
        "São José do Rio Preto - Posto Monte Carlo I",
        "Uberlândia - MG Posto Décio",
        "Várzea Grande - Monte Carlo",
        "São Gonçalo do Sapucaí - Posto Caxuxa (BR) Moinho I",
        "Posto Monte Carlo - Santópolis do Aguapeí",
        "Posto Marajó Aparecidão",
        "Posto Marajó Centralina",
        "Posto Marajó Araporã",
        "Posto Marajo Anapolis 1",
        "Posto Marajó Cariri 1",
        "Posto Marajó Grande Belém",
        "Posto Monte Carlo Nova Alexandria - Rod. Raposo Tavares"
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

    // Litros acima do limite da linha (Diesel S10/S500 ou sem combustível: mais de 1.500 L; ARLA:
    // mais de 150 L): quase sempre é o número digitado sem a vírgula (312924 em vez de 312,924)
    const LIMITE_LITROS_DIESEL = 1500;
    const LIMITE_LITROS_ARLA = 150;
    const AVISO_LITROS = 'Confira os litros: use vírgula para os decimais (ex.: 312,924).';

    function litrosForaDoLimite(i) {
        const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '';
        const litros = parseLitros(document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '');
        return litros > (comb === 'arla' ? LIMITE_LITROS_ARLA : LIMITE_LITROS_DIESEL);
    }

    // Marca (ou desmarca) o campo de litros da linha; true = passou do limite
    function conferirLitrosDaLinha(i) {
        const input = document.querySelector(`input[name="litros_ml_${i}"]`);
        if (!input) return false;
        if (litrosForaDoLimite(i)) {
            marcarErroCampo(input, AVISO_LITROS);
            return true;
        }
        const aviso = (input.closest('.tabela-litros-wrap') || input).nextElementSibling;
        if (aviso && aviso.classList.contains('erro-campo-celular') && aviso.textContent.startsWith('Confira os litros')) limparErroCampo(input);
        return false;
    }

    for (let i = 1; i <= 10; i++) {
        const inputPosto = document.querySelector(`[name="posto_ml_${i}"]`);
        const inputNf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const inputKm = document.querySelector(`input[name="km_ml_${i}"]`);
        const inputValor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const inputLitros = document.querySelector(`input[name="litros_ml_${i}"]`);
        const selectCombustivel = document.querySelector(`select[name="combustivel_ml_${i}"]`);
        const selectPlacaAbast = document.querySelector(`select[name="placa_abast_ml_${i}"]`);

        // Combustível (ARLA fica fora da média) e placa (média por placa) mudam os indicadores
        [selectCombustivel, selectPlacaAbast].forEach(sel => {
            if (!sel) return;
            sel.addEventListener('change', () => {
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
                if (typeof atualizarListaLinhasAbastPreenchidasPopover === 'function') {
                    atualizarListaLinhasAbastPreenchidasPopover();
                }
            });
        });

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
            // Depois da máscara formatar: avisa se passou do limite da linha
            inputLitros.addEventListener('blur', () => conferirLitrosDaLinha(i));
            // Trocar o combustível muda o limite (ARLA 150 L) dos litros já digitados
            if (selectCombustivel) {
                selectCombustivel.addEventListener('change', () => {
                    if ((inputLitros.value || '').trim()) conferirLitrosDaLinha(i);
                });
            }
        }

        // Lixeira na coluna de numeração: "Remover" a linha de abastecimento (da 2ª em diante)
        const btnLimparInline = document.querySelector(`.btn-limpar-linha-inline[data-linha-abast="${i}"]`);
        if (btnLimparInline) {
            btnLimparInline.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removerLinhaLista('abastecimentos', i);
            });
        }
    }

    // TOTAL DIESEL = Diesel S10, Diesel S500 e linhas sem combustível escolhido; TOTAL ARLA = só ARLA.
    // valor/litros continuam sendo a soma dos dois (Despesa total e envio).
    function calcularTotaisAbastecimentoMl() {
        const diesel = { valor: 0, litros: 0 };
        const arla = { valor: 0, litros: 0 };

        for (let i = 1; i <= 10; i++) {
            const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '';
            const alvo = comb === 'arla' ? arla : diesel;
            alvo.valor += parseMoeda(document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '');
            alvo.litros += parseLitros(document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '');
        }

        if (inputTotalValorDieselMl) inputTotalValorDieselMl.value = formatarMoedaSemPrefixo(diesel.valor);
        if (inputTotalLitrosDieselMl) inputTotalLitrosDieselMl.value = formatarLitros(diesel.litros);
        if (inputTotalValorArlaMl) inputTotalValorArlaMl.value = formatarMoedaSemPrefixo(arla.valor);
        if (inputTotalLitrosArlaMl) inputTotalLitrosArlaMl.value = formatarLitros(arla.litros);

        return { valor: diesel.valor + arla.valor, litros: diesel.litros + arla.litros, diesel, arla };
    }

    // Combustíveis do abastecimento (valor gravado -> texto). Vazio (ficha antiga) conta como diesel.
    const ROTULOS_COMBUSTIVEL = { diesel_s10: 'Diesel S10', diesel_s500: 'Diesel S500', arla: 'ARLA' };

    // Placa de uma linha: só existe 'secundaria' quando o 2º trecho está ativo
    function placaDaLinhaAbast(i) {
        const sel = document.querySelector(`select[name="placa_abast_ml_${i}"]`);
        return (segundoTrechoAtivo() && sel && sel.value === 'secundaria') ? 'secundaria' : 'principal';
    }

    function limparCamposNovosAbast(i) {
        const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`);
        const placa = document.querySelector(`select[name="placa_abast_ml_${i}"]`);
        if (comb) comb.value = '';
        if (placa) placa.value = 'principal';
    }

    // Ficha antiga sem combustível fica vazia (e conta como diesel); sem placa = principal
    function definirCamposNovosAbast(i, ab) {
        const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`);
        const placa = document.querySelector(`select[name="placa_abast_ml_${i}"]`);
        if (comb) comb.value = ROTULOS_COMBUSTIVEL[ab?.combustivel] ? ab.combustivel : '';
        if (placa) placa.value = ab?.placa === 'secundaria' ? 'secundaria' : 'principal';
    }

    // Litros de diesel (S10 + S500 + sem combustível) por placa; o ARLA não entra na média
    function litrosDieselPorPlaca() {
        return litrosAbastPorPlaca(comb => comb !== 'arla');
    }

    // Litros de ARLA por placa, só para a "Média ARLA" informativa
    function litrosArlaPorPlaca() {
        return litrosAbastPorPlaca(comb => comb === 'arla');
    }

    function litrosAbastPorPlaca(usarLinha) {
        const litros = { principal: 0, secundaria: 0, total: 0 };
        for (let i = 1; i <= 10; i++) {
            const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '';
            if (!usarLinha(comb)) continue;
            const l = parseLitros(document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '');
            litros[placaDaLinhaAbast(i)] += l;
            litros.total += l;
        }
        return litros;
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
    if (inputMlDespesaDesc2) inputMlDespesaDesc2.addEventListener('change', salvarProgressoMl);
    if (inputMlDespesaDesc3) inputMlDespesaDesc3.addEventListener('change', salvarProgressoMl);

    // Descrição 2 e 3 são uma lista; ficha antiga com texto fora da lista ganha uma opção a mais
    function definirDescricaoDespesa(select, valor) {
        if (!select) return;
        const texto = String(valor || '').trim();
        if (texto && !Array.from(select.options).some(o => o.value === texto)) {
            const opt = document.createElement('option');
            opt.value = texto;
            opt.textContent = texto;
            select.appendChild(opt);
        }
        select.value = texto;
    }

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
        // KM da viagem toda (principal + secundária)
        const kms = kmsDaViagem();
        const kmTotalNum = kms.viagem || 0;
        const totaisCombustivel = calcularTotaisAbastecimentoMl();
        const totaisDespesas = calcularTotaisDespesasMl();
        const totalFreteRelacao = calcularTotaisFreteMl();
        // Média só com diesel (S10 + S500); o ARLA entra só nos custos
        const diesel = litrosDieselPorPlaca();
        const media = (km, litros) => (km > 0 && litros > 0 && isFinite(km / litros)) ? km / litros : 0;

        // 1. Média de Combustível (KM Total / Litros de diesel)
        if (mlIndicadorMedia) {
            mlIndicadorMedia.innerHTML = `${formatarDecimal(media(kmTotalNum, diesel.total), 2)} <span class="indicador-unidade">km/l</span>`;
        }
        if (mlCalcBaseKm) mlCalcBaseKm.textContent = kmTotalNum > 0 ? formatarMilhar(kmTotalNum) : '0';
        if (mlCalcBaseLitros) mlCalcBaseLitros.textContent = formatarLitros(diesel.total);

        // Com 2º trecho: no lugar do valor único, a média de cada placa, uma embaixo da outra
        // (km do trecho ÷ diesel das linhas daquela placa). Não há média geral somando as duas.
        const doisTrechos = segundoTrechoAtivo();
        const mediaPorPlaca = document.getElementById('ml-media-por-placa');
        const baseGeral = document.getElementById('ml-media-base-geral');
        if (mlIndicadorMedia) mlIndicadorMedia.hidden = doisTrechos;
        if (baseGeral) baseGeral.hidden = doisTrechos;
        if (mediaPorPlaca) {
            mediaPorPlaca.hidden = !doisTrechos;
            if (doisTrechos) {
                const esc = escapeHTMLAutocomplete;
                const bloco = (qual, km, litros) => {
                    const placa = qual === 'secundaria' ? placaSecundariaAtual() : placaPrincipalAtual();
                    const rotulo = placa ? formatarPlaca(placa) : (qual === 'secundaria' ? 'Secundária' : 'Principal');
                    const temBase = km > 0 && litros > 0;
                    const valor = temBase ? `${formatarDecimal(media(km, litros), 2)} <span class="indicador-unidade">km/l</span>` : '—';
                    const base = temBase ? `${formatarMilhar(km)} km ÷ ${formatarLitros(litros)} L` : 'Falta KM ou litros de diesel';
                    return `<div class="media-placa" data-placa="${qual}">` +
                        `<span class="media-placa-rotulo">${esc(rotulo)}</span>` +
                        `<strong class="media-placa-valor">${valor}</strong>` +
                        `<small class="indicador-formula-base">${esc(base)}</small></div>`;
                };
                mediaPorPlaca.innerHTML = bloco('principal', kms.t1.total || 0, diesel.principal) +
                    bloco('secundaria', kms.t2.total || 0, diesel.secundaria);
            }
        }

        // Média ARLA (KM ÷ litros de ARLA), só informativa; com 2º trecho, uma por placa
        const mediaArlaEl = document.getElementById('ml-media-arla');
        if (mediaArlaEl) {
            const arla = litrosArlaPorPlaca();
            const linhaArla = (rotulo, km, litros) => `<div class="media-arla-linha">${escapeHTMLAutocomplete(rotulo)}: <strong>` +
                (km > 0 && litros > 0 ? `${formatarDecimal(km / litros, 2)} km/l` : '—') + '</strong> (KM ÷ litros de ARLA)</div>';
            if (doisTrechos) {
                const rotuloPlaca = (qual) => {
                    const placa = qual === 'secundaria' ? placaSecundariaAtual() : placaPrincipalAtual();
                    return `Média ARLA ${placa ? formatarPlaca(placa) : (qual === 'secundaria' ? 'Secundária' : 'Principal')}`;
                };
                mediaArlaEl.innerHTML = linhaArla(rotuloPlaca('principal'), kms.t1.total || 0, arla.principal) +
                    linhaArla(rotuloPlaca('secundaria'), kms.t2.total || 0, arla.secundaria);
            } else {
                mediaArlaEl.innerHTML = linhaArla('Média ARLA', kmTotalNum, arla.total);
            }
        }

        // 2. Despesa Total = Combustível (diesel + ARLA) + Impostos/Pedágios + Outras Despesas + Vr Comissão + Descarga
        // (Vr Comissão = total de comissões da Relação de fretes)
        const vrComissaoNum = totalFreteRelacao.comissao;
        const totalDescargaNum = totalFreteRelacao && totalFreteRelacao.descarga ? totalFreteRelacao.descarga : 0;

        const despesaTotalCalculada = totaisCombustivel.valor +
            totaisDespesas.totalGeralDespesas +
            vrComissaoNum +
            totalDescargaNum;

        if (mlIndicadorDespesa) {
            mlIndicadorDespesa.textContent = formatarMoeda(despesaTotalCalculada);
        }

        // 3. Resultado da Viagem = Total Frete (da Relação de fretes) - Despesa Total
        const totalFreteFinal = totalFreteRelacao.frete;

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

    // Arquivos reais (File) ainda não enviados ao Storage, ligados ao item da lista
    const arquivosBinariosMl = new WeakMap();
    const TIPOS_COMPROVANTE = ['application/pdf', 'image/png', 'image/jpeg'];

    function adicionarArquivosMl(novosArquivos) {
        let adicionados = 0;
        for (let i = 0; i < novosArquivos.length; i++) {
            const file = novosArquivos[i];
            if (!TIPOS_COMPROVANTE.includes(file.type)) {
                exibirToast(`Arquivo "${file.name}" não é PDF, PNG ou JPG.`, 'erro');
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                exibirToast(`Arquivo "${file.name}" excede 10MB.`, 'erro');
                continue;
            }
            const item = {
                name: file.name,
                size: file.size,
                type: file.type
            };
            arquivosBinariosMl.set(item, file);
            arquivosComprovantesMl.push(item);
            adicionados++;
        }

        if (adicionados > 0) {
            renderizarListaAnexosMl();
            salvarProgressoMl();
            exibirToast(`${adicionados} arquivo(s) anexado(s) com sucesso!`, 'sucesso');
        }
    }

    /**
     * Envia ao Storage os comprovantes ainda não enviados e devolve a lista
     * final ({ name, size, type, path }). Lança erro se algum envio falhar.
     */
    async function enviarComprovantesPendentesMl(fichaId) {
        const resultado = [];
        let falhas = 0;
        let semArquivo = 0;
        for (const item of arquivosComprovantesMl) {
            if (item && item.path) { resultado.push(item); continue; }
            const file = arquivosBinariosMl.get(item);
            if (!file) { semArquivo++; continue; }
            const enviado = (typeof window.uploadComprovanteSupabase === 'function')
                ? await window.uploadComprovanteSupabase(file, fichaId)
                : null;
            if (enviado) {
                resultado.push(enviado);
            } else {
                falhas++;
            }
        }
        if (falhas > 0) {
            throw new Error(`${falhas} comprovante(s) não puderam ser enviados. Verifique a conexão e tente novamente.`);
        }
        if (semArquivo > 0) {
            exibirToast(`${semArquivo} comprovante(s) ficaram de fora porque a página foi recarregada. Anexe novamente se precisar.`, 'erro');
        }
        arquivosComprovantesMl = resultado;
        renderizarListaAnexosMl();
        return resultado;
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
        const selVeic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
        const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

        return !!((dt && dt.value.trim() !== '') ||
            (selCli && selCli.value.trim() !== '') ||
            (selVeic && motoristaEscolheVeiculo() && selVeic.value !== '') ||
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
        if (motoristaEscolheVeiculo() && ROTULOS_VEICULO[veiculoDaLinhaFrete(i)]) {
            partes.push(ROTULOS_VEICULO[veiculoDaLinhaFrete(i)]);
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
        const selVeic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);

        if (dt) dt.value = '';
        if (pickerNativo) pickerNativo.value = '';
        if (selCli) selCli.value = '';
        if (selVeic) selVeic.value = '';
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
                const selVeic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);

                if (dt) dt.value = '';
                if (pickerNativo) pickerNativo.value = '';
                if (selCli) selCli.value = '';
                if (selVeic) selVeic.value = '';
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
            voltarParaPrimeiraLinha('fretes');
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
        const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`);

        return !!((posto && posto.value.trim() !== '') ||
            (comb && comb.value !== '') ||
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

        const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`);

        const partes = [];
        if (posto && posto.value.trim()) {
            partes.push(posto.value.trim());
        }
        if (comb && ROTULOS_COMBUSTIVEL[comb.value]) {
            partes.push(ROTULOS_COMBUSTIVEL[comb.value]);
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
        limparCamposNovosAbast(i);

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
                limparCamposNovosAbast(i);
            }
            if (popoverLimparAbastMl) popoverLimparAbastMl.classList.add('oculto');
            voltarParaPrimeiraLinha('abastecimentos');
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
                placas: (inputPlacas?.value?.trim() && inputPlacas.value.trim() !== 'A definir pela Gestão') ? inputPlacas.value.trim() : '',
                dataSaida: inputDataSaida?.value || '',
                dataChegada: inputDataChegada?.value || '',
                kmSaida: inputKmSaida?.value || '',
                kmChegada: inputKmChegada?.value || '',
                kmTotal: inputKmTotal?.value || '',
                placaSecundaria: inputPlacaSecundaria?.value || '',
                kmSaida2: inputKmSaida2?.value || '',
                kmEntrada2: inputKmChegada2?.value || '',
                destinoInicial: inputDestinoInicial?.value?.trim() || '',
                destinoFinal: inputDestinoFinal?.value?.trim() || '',
                valorAdiantamento: inputAdiantamento?.value || ''
            };

            const fretesMl = [];
            for (let i = 1; i <= 8; i++) {
                fretesMl.push({
                    data: document.querySelector(`input[name="data_frete_ml_${i}"]`)?.value || '',
                    cliente: document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '',
                    veiculo: document.querySelector(`select[name="veiculo_frete_ml_${i}"]`)?.value || '',
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
                    litros: document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '',
                    combustivel: document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '',
                    placa: document.querySelector(`select[name="placa_abast_ml_${i}"]`)?.value || 'principal'
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
        if (inputPlacaSecundaria) inputPlacaSecundaria.value = '';
        placaSecundariaAnterior = '';
        limparSegundoTrecho();
        atualizarSegundoTrecho();
        // Listas do celular voltam a mostrar só a primeira linha
        document.querySelectorAll('table.tabela-abastecimento').forEach(t => { delete t.dataset.mostrar; });
        setTimeout(atualizarListasCelular, 0);
        if (inputDataSaida) inputDataSaida.value = '';
        if (inputDataChegada) inputDataChegada.value = '';
        if (inputKmSaida) inputKmSaida.value = '';
        if (inputKmChegada) inputKmChegada.value = '';
        if (inputKmTotal) inputKmTotal.value = '';
        if (inputDestinoInicial) inputDestinoInicial.value = '';
        if (inputDestinoFinal) inputDestinoFinal.value = '';
        if (inputAdiantamento) inputAdiantamento.value = '';

        // Limpar as 8 linhas de frete
        for (let i = 1; i <= 8; i++) {
            const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
            const cli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
            const veic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
            const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
            const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
            const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
            const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
            const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

            if (dt) dt.value = '';
            if (cli) cli.value = '';
            if (veic) veic.value = '';
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
            limparCamposNovosAbast(i);
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

                    if (inputPlacas) {
                        const pl = dados.cabecalho.placas;
                        if (pl && pl.trim() !== '' && pl.trim() !== 'A definir pela Gestão') {
                            inputPlacas.value = formatarPlaca(pl);
                        } else {
                            inputPlacas.value = '';
                        }
                    }

                    if (inputDataSaida && dados.cabecalho.dataSaida) inputDataSaida.value = normalizarDataExibicao(dados.cabecalho.dataSaida);
                    if (inputDataChegada && dados.cabecalho.dataChegada) inputDataChegada.value = normalizarDataExibicao(dados.cabecalho.dataChegada);
                    if (inputKmSaida && dados.cabecalho.kmSaida) inputKmSaida.value = dados.cabecalho.kmSaida;
                    if (inputKmChegada && dados.cabecalho.kmChegada) inputKmChegada.value = dados.cabecalho.kmChegada;
                    if (inputKmTotal && dados.cabecalho.kmTotal) inputKmTotal.value = dados.cabecalho.kmTotal;
                    if (inputPlacaSecundaria && dados.cabecalho.placaSecundaria) {
                        inputPlacaSecundaria.value = formatarPlaca(dados.cabecalho.placaSecundaria);
                        placaSecundariaAnterior = placaSecundariaAtual();
                    }
                    if (inputKmSaida2 && dados.cabecalho.kmSaida2) inputKmSaida2.value = dados.cabecalho.kmSaida2;
                    if (inputKmChegada2 && dados.cabecalho.kmEntrada2) inputKmChegada2.value = dados.cabecalho.kmEntrada2;
                    if (inputDestinoInicial && dados.cabecalho.destinoInicial) inputDestinoInicial.value = dados.cabecalho.destinoInicial;
                    if (inputDestinoFinal && dados.cabecalho.destinoFinal) inputDestinoFinal.value = dados.cabecalho.destinoFinal;
                    if (inputAdiantamento && dados.cabecalho.valorAdiantamento) inputAdiantamento.value = dados.cabecalho.valorAdiantamento;
                }

                // Restaurar fretes
                let temFretePreenchido = false;
                if (Array.isArray(dados.fretes)) {
                    dados.fretes.forEach((f, idx) => {
                        const i = idx + 1;
                        const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                        const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                        const selVeic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
                        const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                        const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                        const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                        const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
                        const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

                        if (dt && f.data) dt.value = normalizarDataExibicao(f.data);
                        if (selCli && f.cliente !== undefined) selCli.value = f.cliente;
                        if (selVeic) selVeic.value = ROTULOS_VEICULO[f.veiculo] ? f.veiculo : '';
                        if (og && f.origem) og.value = f.origem;
                        if (dst && f.destino) dst.value = f.destino;
                        if (vl && f.valor) vl.value = f.valor;
                        if (desc && f.descarga) desc.value = f.descarga;
                        if (com) {
                            com.dataset.editadoManual = '';
                            com.value = f.comissao || '';
                        }

                        if (f.cliente || f.valor || f.origem || f.destino || f.descarga) {
                            temFretePreenchido = true;
                        }

                        // Comissão sempre pela regra (o tipo de veículo do motorista chega depois e refaz a conta)
                        atualizarLinhaFreteMl(i, false);
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
                        definirCamposNovosAbast(i, ab);
                        if (ab.combustivel) temAbastPreenchido = true;
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
                        if (dados.outrasDespesas[1].desc) definirDescricaoDespesa(inputMlDespesaDesc2, dados.outrasDespesas[1].desc);
                        if (inputMlDespesaValor2 && dados.outrasDespesas[1].valor) { inputMlDespesaValor2.value = dados.outrasDespesas[1].valor; temDespesaPreenchida = true; }
                    }
                    if (dados.outrasDespesas[2]) {
                        if (dados.outrasDespesas[2].desc) definirDescricaoDespesa(inputMlDespesaDesc3, dados.outrasDespesas[2].desc);
                        if (inputMlDespesaValor3 && dados.outrasDespesas[2].valor) { inputMlDespesaValor3.value = dados.outrasDespesas[2].valor; temDespesaPreenchida = true; }
                    }
                }

                // Restaurar Anexos
                if (Array.isArray(dados.anexos)) {
                    arquivosComprovantesMl = dados.anexos;
                    renderizarListaAnexosMl();
                }

                atualizarSegundoTrecho();
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
            if (!linhaEmUso(document.querySelector(`input[name="data_frete_ml_${i}"]`))) continue;
            const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`)?.value || '';
            const cli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '';
            const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`)?.value || '';
            const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`)?.value || '';
            const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`)?.value || '';
            const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`)?.value || '';
            const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`)?.value || '';
            // 'carreta' | 'rodotrem'; '' = motorista de rodotrem que não escolheu (o banco grava null)
            const veiculo = veiculoDaLinhaFrete(i);

            if (dt || cli || og || dst || vl || com) {
                fretes.push({ data: dt, cliente: cli, veiculo, origem: og, destino: dst, valor: vl, comissao: com, descarga: desc });
            }
        }
        return fretes;
    }

    function coletarAbastecimentosAtuais() {
        const abasts = [];
        for (let i = 1; i <= 10; i++) {
            if (!linhaEmUso(document.querySelector(`[name="posto_ml_${i}"]`))) continue;
            const posto = document.querySelector(`[name="posto_ml_${i}"]`)?.value || '';
            const nf = document.querySelector(`input[name="nf_ml_${i}"]`)?.value || '';
            const km = document.querySelector(`input[name="km_ml_${i}"]`)?.value || '';
            const valor = document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '';
            const litros = document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '';
            const combustivel = document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '';
            // 'principal' | 'secundaria' só quando há placa secundária (a principal pode ser definida depois)
            const placa = segundoTrechoAtivo() ? placaDaLinhaAbast(i) : '';

            if (posto || nf || km || valor || litros || combustivel) {
                abasts.push({ posto, nf, km, valor, litros, combustivel, placa });
            }
        }
        return abasts;
    }

    // KMs dos dois trechos e placa secundária para gravar (só dígitos; totais calculados aqui,
    // mas para o motorista quem calcula de verdade é o banco)
    function coletarKmEPlacaSecundaria() {
        const kms = kmsDaViagem();
        const secundaria = placaSecundariaAtual();
        const digitos = (input) => (input?.value || '').replace(/\D/g, '');
        const texto = (n) => (n === null ? '' : String(n));
        return {
            kmSaida: digitos(inputKmSaida),
            kmEntrada: digitos(inputKmChegada),
            kmTotal1: texto(kms.t1.total),
            placaSecundaria: secundaria,
            kmSaida2: secundaria ? digitos(inputKmSaida2) : '',
            kmEntrada2: secundaria ? digitos(inputKmChegada2) : '',
            kmTotal2: secundaria ? texto(kms.t2.total) : '',
            kmTotal: texto(kms.viagem)
        };
    }

    // Totais para gravar, no formato da ficha ("1.234,56"): total frete e vr comissão vêm da
    // Relação de fretes; o total do abastecimento é diesel + ARLA, com os dois também separados
    function totaisParaGravar() {
        const fretes = calcularTotaisFreteMl();
        const abast = calcularTotaisAbastecimentoMl();
        return {
            totalFrete: formatarMoedaSemPrefixo(fretes.frete),
            vrComissao: formatarMoedaSemPrefixo(fretes.comissao),
            totalAbastecimento: formatarMoedaSemPrefixo(abast.valor),
            totalLitros: formatarLitros(abast.litros),
            totalDiesel: formatarMoedaSemPrefixo(abast.diesel.valor),
            totalArla: formatarMoedaSemPrefixo(abast.arla.valor)
        };
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
        if (inputPlacas) {
            if (placasVal && placasVal.trim() !== '' && placasVal.trim() !== 'A definir pela Gestão') {
                inputPlacas.value = formatarPlaca(placasVal);
            } else {
                inputPlacas.value = '';
            }
        }

        // Placa secundária (dados_completos.placaSecundaria): troca de cavalo durante a viagem
        if (inputPlacaSecundaria) {
            inputPlacaSecundaria.value = formatarPlaca(ficha.placaSecundaria || ficha.dados_completos?.placaSecundaria || '');
            placaSecundariaAnterior = placaSecundariaAtual();
        }

        const dataSaidaVal = ficha.dataSaida || ficha.data_saida || ficha.dados_completos?.dataSaida;
        if (inputDataSaida && dataSaidaVal) inputDataSaida.value = normalizarDataExibicao(dataSaidaVal);

        const dataChegadaVal = ficha.dataChegada || ficha.data_chegada || ficha.dados_completos?.dataChegada;
        if (inputDataChegada && dataChegadaVal) inputDataChegada.value = normalizarDataExibicao(dataChegadaVal);

        // KMs com ponto de milhar; o total é recalculado no fim (chegada − saída)
        const kmSaidaVal = ficha.kmSaida ?? ficha.km_saida ?? ficha.dados_completos?.kmSaida;
        if (inputKmSaida && kmSaidaVal !== undefined && kmSaidaVal !== null) inputKmSaida.value = formatarMilhar(kmSaidaVal);

        const kmChegadaVal = ficha.kmEntrada ?? ficha.kmChegada ?? ficha.km_chegada ?? ficha.dados_completos?.kmEntrada ?? ficha.dados_completos?.kmChegada;
        if (inputKmChegada && kmChegadaVal !== undefined && kmChegadaVal !== null) inputKmChegada.value = formatarMilhar(kmChegadaVal);

        // 2º trecho (só com placa secundária)
        const kmSaida2Val = ficha.kmSaida2 ?? ficha.dados_completos?.kmSaida2;
        if (inputKmSaida2) inputKmSaida2.value = formatarMilhar(kmSaida2Val);
        const kmEntrada2Val = ficha.kmEntrada2 ?? ficha.dados_completos?.kmEntrada2;
        if (inputKmChegada2) inputKmChegada2.value = formatarMilhar(kmEntrada2Val);

        const destinoInicialVal = ficha.destinoInicial || ficha.destino_inicial || ficha.dados_completos?.destinoInicial;
        if (inputDestinoInicial) {
            inputDestinoInicial.value = (destinoInicialVal && destinoInicialVal.trim() !== 'Origem') ? destinoInicialVal.trim() : '';
        }

        const destinoFinalVal = ficha.destinoFinal || ficha.destino_final || ficha.dados_completos?.destinoFinal;
        if (inputDestinoFinal) {
            inputDestinoFinal.value = (destinoFinalVal && destinoFinalVal.trim() !== 'Destino') ? destinoFinalVal.trim() : '';
        }

        const adiantamentoVal = ficha.valorAdiantamento || ficha.valor_adiantamento || ficha.dados_completos?.valorAdiantamento;
        if (inputAdiantamento && adiantamentoVal) inputAdiantamento.value = adiantamentoVal;

        // Frete origem, retornos, total frete e vr comissão de fichas antigas não têm mais
        // campo na tela: o total frete e a comissão vêm da Relação de fretes

        // Fretes Operacionais
        const fretesLista = Array.isArray(ficha.fretes) ? ficha.fretes : (Array.isArray(ficha.dados_completos?.fretes) ? ficha.dados_completos.fretes : []);
        if (fretesLista.length > 0) {
            fretesLista.forEach((f, idx) => {
                const i = idx + 1;
                const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                const selVeic = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
                const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
                const desc = document.querySelector(`input[name="descarga_frete_ml_${i}"]`);

                if (dt && f.data) dt.value = normalizarDataExibicao(f.data);
                if (selCli && f.cliente) selCli.value = f.cliente;
                if (selVeic) selVeic.value = ROTULOS_VEICULO[f.veiculo] ? f.veiculo : '';
                if (og && f.origem) og.value = f.origem;
                if (dst && f.destino) dst.value = f.destino;
                if (vl && f.valor) vl.value = f.valor;
                // A comissão gravada aparece como está (a gestão pode ter ajustado à mão)
                if (com && f.comissao) com.value = f.comissao;
                if (desc && f.descarga) desc.value = f.descarga;
            });
            if (typeof calcularTotaisFreteMl === 'function') calcularTotaisFreteMl();
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
                definirCamposNovosAbast(i, ab);
                // Litros acima do limite (provável falta da vírgula) já aparecem marcados ao abrir
                if (ab.litros) conferirLitrosDaLinha(i);
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
                    if (item.desc) definirDescricaoDespesa(inputMlDespesaDesc2, item.desc);
                    if (inputMlDespesaValor2 && item.valor) inputMlDespesaValor2.value = item.valor;
                } else if (index === 2) {
                    if (item.desc) definirDescricaoDespesa(inputMlDespesaDesc3, item.desc);
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

        atualizarSegundoTrecho();
        calcularKmTotal();
        calcularTotaisFreteMl();
        calcularTotaisAbastecimentoMl();
        calcularTotaisDespesasMl();
        calcularIndicadoresViagemMl();
        atualizarListasCelular();
    }

    // ------------------------------------------
    // Linhas em uso (fretes e abastecimentos), em todas as larguras
    // As 8 e 10 linhas do HTML continuam lá (mesmos name/id); só aparecem as
    // que estão em uso (no mínimo 1). "+ Adicionar" mostra a próxima; "Remover"
    // (da 2ª em diante) apaga a linha e sobe as de baixo, sem buraco no meio.
    // Até 900px cada linha vira um cartão (CSS) com o rótulo de cada campo.
    // ------------------------------------------
    const TABELAS_CELULAR = [
        { tipo: 'fretes', seletor: 'table.tabela-fretes-ml', item: 'Frete' },
        { tipo: 'abastecimentos', seletor: 'table.tabela-abastecimento:not(.tabela-fretes-ml)', item: 'Abastecimento' }
    ];

    function linhaPreenchida(tr) {
        return Array.from(tr.querySelectorAll('input:not([type="date"]), select:not(.input-placa-abast)'))
            .some(el => { const v = (el.value || '').trim(); return v !== '' && v !== '0,00' && v !== '0'; });
    }

    const linhasDaLista = (tabela) => Array.from(tabela.tBodies[0].rows).filter(tr => !tr.classList.contains('linha-adicionar-celular'));

    // Linha escondida não conta na validação nem no envio
    const linhaEmUso = (campo) => !(campo && campo.closest('tr')?.classList.contains('linha-oculta-celular'));

    function atualizarListasCelular() {
        TABELAS_CELULAR.forEach(({ seletor }) => {
            const tabela = document.querySelector(seletor);
            if (!tabela || !tabela.tBodies[0]) return;
            const linhas = linhasDaLista(tabela);
            const ultimaPreenchida = linhas.reduce((u, tr, i) => (linhaPreenchida(tr) ? i + 1 : u), 0);
            const mostrar = Math.min(linhas.length, Math.max(1, ultimaPreenchida, Number(tabela.dataset.mostrar || 0)));
            tabela.dataset.mostrar = String(mostrar);
            linhas.forEach((tr, i) => tr.classList.toggle('linha-oculta-celular', i >= mostrar));
            // No limite o botão some e aparece "Limite de 8 fretes" / "Limite de 10 abastecimentos"
            const linhaBotao = tabela.querySelector('.linha-adicionar-celular');
            if (!linhaBotao) return;
            const noLimite = mostrar >= linhas.length;
            const btn = linhaBotao.querySelector('.btn-adicionar-linha-celular');
            const limite = linhaBotao.querySelector('.texto-limite-linhas');
            if (btn) btn.hidden = noLimite;
            if (limite) limite.hidden = !noLimite;
            // Ficha só para leitura (concluída): nada de adicionar/remover
            linhaBotao.classList.toggle('linha-oculta-celular', tabela.hasAttribute('data-somente-leitura'));
        });
    }

    const camposDaLinha = (tr) => Array.from(tr.querySelectorAll('input, select'));

    // Copia os valores de uma linha para outra (mesma estrutura de campos)
    function copiarCamposLinha(origem, destino) {
        const de = camposDaLinha(origem);
        camposDaLinha(destino).forEach((el, k) => {
            const fonte = de[k];
            if (!fonte) return;
            // Posto antigo fora da lista: a opção vai junto
            if (el.tagName === 'SELECT' && fonte.value && !Array.from(el.options).some(o => o.value === fonte.value)) {
                const opt = document.createElement('option');
                opt.value = fonte.value;
                opt.textContent = fonte.selectedOptions[0]?.textContent || fonte.value;
                el.appendChild(opt);
            }
            el.value = fonte.value;
            if ('editadoManual' in fonte.dataset || 'editadoManual' in el.dataset) {
                el.dataset.editadoManual = fonte.dataset.editadoManual || '';
            }
        });
    }

    function limparCamposLinha(tr) {
        camposDaLinha(tr).forEach(el => {
            if (el.tagName === 'SELECT') el.selectedIndex = 0; // placa volta para "principal"
            else el.value = '';
            if ('editadoManual' in el.dataset) el.dataset.editadoManual = '';
        });
    }

    function recalcularDepoisDeMexerNasLinhas(tipo) {
        if (tipo === 'fretes') {
            for (let i = 1; i <= 8; i++) atualizarLinhaFreteMl(i, false);
        }
        calcularTotaisFreteMl();
        calcularTotaisAbastecimentoMl();
        calcularIndicadoresViagemMl();
        salvarProgressoMl();
        atualizarListaLinhasPreenchidasPopover();
        atualizarListaLinhasAbastPreenchidasPopover();
    }

    // "Remover" da linha N (2 em diante): confirma se tiver dados, sobe as de baixo
    function removerLinhaLista(tipo, numero) {
        const cfg = TABELAS_CELULAR.find(t => t.tipo === tipo);
        const tabela = cfg && document.querySelector(cfg.seletor);
        if (!tabela || numero < 2) return;
        const linhas = linhasDaLista(tabela);
        const mostrar = Number(tabela.dataset.mostrar || 1);
        if (numero > mostrar) return;
        if (linhaPreenchida(linhas[numero - 1]) &&
            !confirm(`Remover ${cfg.item.toLowerCase()} ${numero}? Os dados desta linha serão apagados.`)) return;

        for (let i = numero - 1; i < mostrar - 1; i++) copiarCamposLinha(linhas[i + 1], linhas[i]);
        limparCamposLinha(linhas[mostrar - 1]);
        tabela.dataset.mostrar = String(Math.max(1, mostrar - 1));
        atualizarListasCelular();
        recalcularDepoisDeMexerNasLinhas(tipo);
        exibirToast(`${cfg.item} ${numero} removido.`, 'info');
    }

    // "Limpar" do bloco: volta a ficar só a linha 1, vazia
    function voltarParaPrimeiraLinha(tipo) {
        const cfg = TABELAS_CELULAR.find(t => t.tipo === tipo);
        const tabela = cfg && document.querySelector(cfg.seletor);
        if (!tabela) return;
        delete tabela.dataset.mostrar;
        atualizarListasCelular();
    }

    function prepararListasCelular() {
        TABELAS_CELULAR.forEach(({ seletor, item }) => {
            const tabela = document.querySelector(seletor);
            if (!tabela || !tabela.tBodies[0] || tabela.dataset.listaPronta) return;
            tabela.dataset.listaPronta = '1';

            // Rótulo de cada célula = texto do cabeçalho da coluna (sem o selo "Gestão")
            const rotulos = Array.from(tabela.tHead.rows[0].cells).map(th => (th.childNodes[0]?.textContent || '').trim());
            linhasDaLista(tabela).forEach(tr => {
                Array.from(tr.cells).forEach((td, i) => {
                    td.dataset.rotulo = td.classList.contains('td-num') ? item : rotulos[i] || '';
                });
            });
            tabela.querySelectorAll('tfoot .td-total-valor').forEach(td => td.setAttribute('data-rotulo', 'Total em R$'));
            tabela.querySelectorAll('tfoot .td-total-litros').forEach(td => td.setAttribute('data-rotulo', 'Total de litros'));

            // "+ Adicionar": mostra a próxima linha guardada e já põe o foco nela
            tabela.querySelector('.btn-adicionar-linha-celular')?.addEventListener('click', () => {
                tabela.dataset.mostrar = String(Number(tabela.dataset.mostrar || 1) + 1);
                atualizarListasCelular();
                const nova = linhasDaLista(tabela).filter(tr => !tr.classList.contains('linha-oculta-celular')).pop();
                const campo = nova?.querySelector('input:not([readonly]):not([type="date"]), select:not([disabled])');
                if (campo) campo.focus();
                else nova?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        });
        atualizarListasCelular();
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
        // Grupo 1: Motorista (Definido pela Gestão no modo motorista)
        // (placa principal, placa secundária e KMs de saída/chegada ficam livres: motorista e gestão preenchem)
        const camposAdminVeiculo = [inputMotorista].filter(Boolean);

        // Grupo 2: Totais da Relação de fretes (Definido pela Frota no modo motorista)
        const camposFretesFrota = [
            document.getElementById('ml-total-relacao-frete'),
            document.getElementById('ml-total-relacao-comissao'),
            document.getElementById('ml-total-relacao-descarga')
        ].filter(Boolean);

        // Grupo 3: Campos Operacionais Corporativos
        // (datas, destinos e adiantamento ficam livres: o motorista preenche)
        const camposOperacionaisFrota = [
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
                inputPlacas.removeAttribute('tabindex');
                inputPlacas.classList.remove('campo-bloqueado-gestao');
                inputPlacas.placeholder = 'Ex: ABC-1D23';
            }
            if (inputPlacaSecundaria) {
                liberarCampoBloqueado(inputPlacaSecundaria);
                inputPlacaSecundaria.classList.remove('campo-bloqueado-gestao');
                inputPlacaSecundaria.placeholder = 'Opcional. Ex: XYZ-9A87';
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
            // Motorista dono da ficha (o tipo de veículo e as comissões especiais são dele, não da gestão)
            let motoristaIdDaFicha = null;

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
                            if (registro && registro.motorista_id) motoristaIdDaFicha = registro.motorista_id;
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

                    // Coluna "Veículo" e cálculo automático com o tipo do motorista DA FICHA.
                    // As comissões gravadas não são recalculadas ao abrir (a gestão pode ter ajustado).
                    const idMotorista = motoristaIdDaFicha || fichaCarregada.motorista_id || fichaCarregada.motoristaId;
                    if (idMotorista && idMotorista !== 'anonimo') carregarVeiculoMotorista(idMotorista, false);

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
                    if (!validarKmCombustivelDespesas(true)) return;

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
                    if (!validarKmCombustivelDespesas(true)) return;

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
                        if (registro.motorista_id) fichaView.motorista_id = registro.motorista_id;
                    }
                } catch (e) {
                    console.warn('Erro ao carregar ficha no modo view via Supabase:', e);
                }
            }

            if (fichaView) {
                atualizarDisplayNumeroFicha(fichaView.id);
                carregarFichaEmCampos(fichaView);
                toggleFormularioUnificado(true, false);
                // Coluna "Veículo" de quem enviou a ficha (só exibição; nada é recalculado)
                const idMotoristaView = fichaView.motorista_id || fichaView.motoristaId;
                if (idMotoristaView && idMotoristaView !== 'anonimo') carregarVeiculoMotorista(idMotoristaView, false);

                // Bloqueia todos os inputs para leitura
                document.querySelectorAll('#form-relatorio input, #form-relatorio select').forEach(el => {
                    el.setAttribute('readonly', 'true');
                    el.setAttribute('disabled', 'true');
                });
                document.querySelectorAll('table.tabela-abastecimento').forEach(t => t.setAttribute('data-somente-leitura', ''));
                atualizarListasCelular();

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

        // 1. TAREFA 2: Bloqueio rigoroso do Motorista com "Definido pela Administração"
        camposAdminVeiculo.forEach(input => {
            aplicarBloqueioCampo(input, 'Definido pela Administração');
            input.setAttribute('readonly', 'true');
        });

        // Placa principal: o motorista preenche (obrigatória no envio)
        if (inputPlacas) {
            liberarCampoBloqueado(inputPlacas);
            inputPlacas.placeholder = 'Ex: ABC-1D23';
            if (inputPlacas.value.trim() === 'A definir pela Gestão') inputPlacas.value = '';
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
        // (valor do frete e descarga ficam livres; a comissão é calculada sozinha)
        camposFretesFrota.forEach(input => aplicarBloqueioCampo(input, 'Definido pela Frota'));
        camposTabelaFretes.filter(input => input.classList.contains('input-comissao-frete-ml')).forEach(input => {
            input.setAttribute('readonly', 'true');
            input.classList.add('campo-bloqueado-gestao');
        });
        [inputDestinoInicial, inputDestinoFinal, inputAdiantamento].forEach(input => liberarCampoBloqueado(input));
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

        // 7. Desabilita seletores de data (menos os da data de saída e de chegada, que o motorista preenche)
        const camposDatasViagem = [inputDataSaida, inputDataChegada].filter(Boolean);
        botoesPickerData.forEach(btn => {
            if (camposDatasViagem.some(input => input.parentElement === btn.parentElement)) return;
            btn.setAttribute('disabled', 'true');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        });
        camposDatasViagem.forEach(input => liberarCampoBloqueado(input));

        // Abre automaticamente o formulário oficial para lançamento de fretes e diesel
        toggleFormularioUnificado(true, false);

        // Tipo de veículo e comissões especiais do próprio motorista (coluna "Veículo" e comissão)
        carregarVeiculoMotorista(null, true);

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

            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Olá, <strong>${nomeMotoristaValido || 'Motorista'}</strong> • Conectado via Portal`;
            }
        } else {
            if (motoristaSaudacao) {
                motoristaSaudacao.innerHTML = `Portal da Frota • Modo Motorista`;
            }
        }
    }

    function extrairMediaCombustivelMlParaSalvar() {
        const el = document.getElementById('ml-indicador-media-combustivel');
        if (el) {
            const texto = el.textContent || '';
            const match = texto.match(/(\d+(?:[.,]\d+)?)/);
            if (match) {
                const val = parseFloat(match[1].replace(',', '.'));
                if (!isNaN(val) && val > 0) {
                    return val.toFixed(2);
                }
            }
        }
        // Mesma regra do indicador: KM da viagem ÷ litros de diesel
        const kmTotal = kmsDaViagem().viagem || 0;
        const litrosDiesel = litrosDieselPorPlaca().total;
        if (kmTotal > 0 && litrosDiesel > 0) {
            const med = kmTotal / litrosDiesel;
            if (!isNaN(med) && isFinite(med) && med > 0) {
                return med.toFixed(2);
            }
        }
        return '0.00';
    }

    // Média de cada placa para gravar em dados_completos (só exibição; o dashboard recalcula).
    // Sem placa secundária, a principal é a viagem toda e a secundária fica vazia.
    function mediasPorPlacaParaSalvar() {
        const kms = kmsDaViagem();
        const diesel = litrosDieselPorPlaca();
        const texto = (km, litros) => (km > 0 && litros > 0) ? (km / litros).toFixed(2) : '';
        if (!segundoTrechoAtivo()) return { mediaPrincipal: texto(kms.t1.total || 0, diesel.total), mediaSecundaria: '' };
        return {
            mediaPrincipal: texto(kms.t1.total || 0, diesel.principal),
            mediaSecundaria: texto(kms.t2.total || 0, diesel.secundaria)
        };
    }

    // Placa secundária é opcional; se preenchida, precisa ser uma placa válida (antiga ou Mercosul)
    function placaSecundariaValida() {
        if (!inputPlacaSecundaria || inputPlacaSecundaria.readOnly || inputPlacaSecundaria.disabled) return true;
        const limpo = limparPlaca(inputPlacaSecundaria.value);
        if (limpo.length === 0 || placaValida(limpo)) return true;
        exibirToast('A placa secundária deve ter 7 caracteres, no formato ABC-1234 ou ABC-1D23, ou ficar em branco.', 'erro');
        inputPlacaSecundaria.focus();
        return false;
    }

    // Modal de revisão: destinos, adiantamento, KMs, placa secundária, fretes (veículo e
    // comissão calculada) e combustível/placa de cada abastecimento com os totais diesel e ARLA
    function preencherDetalhesRevisao() {
        const caixa = document.getElementById('revisar-detalhes-viagem');
        if (!caixa) return;
        const esc = escapeHTMLAutocomplete;
        const km = (valor) => (valor === null || valor === '' ? '—' : `${formatarMilhar(valor)} km`);
        const kms = kmsDaViagem();
        const secundaria = placaSecundariaAtual();
        const principal = placaPrincipalAtual();
        const linha = (rotulo, valor) => `<div class="revisar-linha"><span>${esc(rotulo)}</span><strong>${esc(valor)}</strong></div>`;

        let html = '<h3>Viagem</h3>';
        html += linha('Saída / chegada', `${(inputDataSaida?.value || '').trim() || '—'} → ${(inputDataChegada?.value || '').trim() || '—'}`);
        html += linha('Destino inicial', (inputDestinoInicial?.value || '').trim() || '—');
        html += linha('Destino final', (inputDestinoFinal?.value || '').trim() || '—');
        html += linha('Adiantamento', inputAdiantamento?.value ? `R$ ${inputAdiantamento.value}` : '—');

        html += '<h3>Quilometragem</h3>';
        html += linha('Placa principal', principal ? formatarPlaca(principal) : '—');
        html += linha('KM saída / chegada', `${km(inputKmSaida?.value)} → ${km(inputKmChegada?.value)}`);
        html += linha(secundaria ? 'KM total (principal)' : 'KM total', km(kms.t1.total));
        if (secundaria) {
            html += linha('Placa secundária', formatarPlaca(secundaria));
            html += linha('KM saída / chegada (secundária)', `${km(inputKmSaida2?.value)} → ${km(inputKmChegada2?.value)}`);
            html += linha('KM total (secundária)', km(kms.t2.total));
            html += linha('KM total da viagem', km(kms.viagem));
        }

        // Média de combustível (km ÷ litros de diesel) e, abaixo, a média ARLA (km ÷ litros de ARLA,
        // só informativa): uma de cada por placa quando há placa secundária
        const diesel = litrosDieselPorPlaca();
        const arla = litrosArlaPorPlaca();
        const mediaTexto = (kmTrecho, litros) => (kmTrecho > 0 && litros > 0)
            ? `${formatarDecimal(kmTrecho / litros, 2)} km/l (${formatarMilhar(kmTrecho)} km ÷ ${formatarLitros(litros)} L)`
            : '—';
        if (secundaria) {
            const rotuloPrincipal = principal ? formatarPlaca(principal) : 'principal';
            html += linha(`Média de combustível ${rotuloPrincipal}`, mediaTexto(kms.t1.total || 0, diesel.principal));
            html += linha(`Média ARLA ${rotuloPrincipal}`, mediaTexto(kms.t1.total || 0, arla.principal));
            html += linha(`Média de combustível ${formatarPlaca(secundaria)}`, mediaTexto(kms.t2.total || 0, diesel.secundaria));
            html += linha(`Média ARLA ${formatarPlaca(secundaria)}`, mediaTexto(kms.t2.total || 0, arla.secundaria));
        } else {
            html += linha('Média de combustível (só diesel)', mediaTexto(kms.viagem || 0, diesel.total));
            html += linha('Média ARLA', mediaTexto(kms.viagem || 0, arla.total));
        }

        const rotulosCliente = { alimenticio: 'Alimentício', shopee: 'Shopee', mercado_livre: 'Mercado Livre' };
        const fretes = [];
        for (let i = 1; i <= 8; i++) {
            const valorEl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
            if (!linhaEmUso(valorEl) || !verificarLinhaFretePreenchida(i)) continue;
            const cliente = document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '';
            const comissao = document.querySelector(`input[name="comissao_frete_ml_${i}"]`)?.value || '';
            const partes = [rotulosCliente[cliente] || 'Sem operação'];
            if (motoristaEscolheVeiculo()) partes.push(ROTULOS_VEICULO[veiculoDaLinhaFrete(i)] || 'Veículo não escolhido');
            partes.push(valorEl.value ? `Frete R$ ${valorEl.value}` : 'Sem valor');
            partes.push(`Comissão ${comissao ? `R$ ${comissao}` : '—'}`);
            fretes.push(linha(`#${fretes.length + 1}`, partes.join(' · ')));
        }
        if (fretes.length) {
            const totaisFrete = calcularTotaisFreteMl();
            html += '<h3>Fretes</h3>' + fretes.join('');
            html += linha('Total frete', formatarMoeda(totaisFrete.frete));
            html += linha('Total comissão', formatarMoeda(totaisFrete.comissao));
        }

        const abasts = [];
        for (let i = 1; i <= 10; i++) {
            if (!verificarLinhaAbastPreenchida(i)) continue;
            const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`)?.value || '';
            const valor = document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '';
            const litros = document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '';
            const partes = [ROTULOS_COMBUSTIVEL[comb] || 'Sem combustível'];
            if (secundaria) partes.push(rotuloPlacaAbast(placaDaLinhaAbast(i)));
            if (valor) partes.push(`R$ ${valor}`);
            if (litros) partes.push(`${litros} L`);
            abasts.push(linha(`#${abasts.length + 1}`, partes.join(' · ')));
        }
        if (abasts.length) {
            const totaisAbast = calcularTotaisAbastecimentoMl();
            html += '<h3>Abastecimentos</h3>' + abasts.join('');
            html += linha('Total diesel', `${formatarMoeda(totaisAbast.diesel.valor)} · ${formatarLitros(totaisAbast.diesel.litros)} L`);
            html += linha('Total ARLA', `${formatarMoeda(totaisAbast.arla.valor)} · ${formatarLitros(totaisAbast.arla.litros)} L`);
        }
        caixa.innerHTML = html;
    }

    // Aviso logo abaixo do campo (some quando o campo é corrigido). Nos litros do abastecimento
    // o aviso fica embaixo do campo com o "L" (tabela-litros-wrap)
    function marcarErroCampo(el, mensagem) {
        if (!el) return;
        const ancora = el.closest('.input-wrapper, .tabela-litros-wrap') || el;
        let aviso = ancora.nextElementSibling;
        if (!aviso || !aviso.classList.contains('erro-campo-celular')) {
            aviso = document.createElement('small');
            aviso.className = 'erro-campo-celular';
            aviso.setAttribute('role', 'alert');
            ancora.after(aviso);
        }
        aviso.textContent = mensagem;
        el.setAttribute('aria-invalid', 'true');
    }

    function limparErroCampo(el) {
        if (!el) return;
        const ancora = el.closest('.input-wrapper, .tabela-litros-wrap') || el;
        const aviso = ancora.nextElementSibling;
        if (aviso && aviso.classList.contains('erro-campo-celular')) aviso.remove();
        el.removeAttribute('aria-invalid');
    }

    if (form) {
        ['input', 'change'].forEach(evento => form.addEventListener(evento, (e) => {
            if (e.target && e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') limparErroCampo(e.target);
        }));
    }

    // DD/MM/AAAA válida (ano de 2020 a 2100, como public._data do passo 14) -> 'AAAA-MM-DD'; senão null
    function dataDoCampo(input) {
        const m = (input?.value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return null;
        const [, d, mes, a] = m.map(Number);
        const data = new Date(Date.UTC(a, mes - 1, d));
        if (a < 2020 || a > 2100 || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d) return null;
        return `${m[3]}-${m[2]}-${m[1]}`;
    }

    function falharValidacao(el, mensagem) {
        marcarErroCampo(el, mensagem);
        exibirToast(mensagem, 'erro');
        if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.focus({ preventScroll: true });
        }
        return false;
    }

    // Validação dos campos novos antes de gravar. O motorista precisa da placa principal,
    // dos KMs (dos dois trechos, com placa secundária) e do combustível; a gestão pode
    // salvar fichas antigas sem eles. As mesmas regras estão no banco (passo 12).
    function validarKmCombustivelDespesas(modoAdmin) {
        if (!modoAdmin && !placaPrincipalAtual()) {
            return falharValidacao(inputPlacas, 'Informe a placa principal (ex.: ABC-1D23).');
        }
        if (!placaSecundariaValida()) return false;
        const secundaria = placaSecundariaAtual();
        if (secundaria && secundaria === limparPlaca(inputPlacas?.value)) {
            return falharValidacao(inputPlacaSecundaria, 'A placa secundária não pode ser igual à principal.');
        }

        if (!modoAdmin) {
            if (!(inputKmSaida?.value || '').trim()) return falharValidacao(inputKmSaida, 'Informe o KM de saída.');
            if (!(inputKmChegada?.value || '').trim()) return falharValidacao(inputKmChegada, 'Informe o KM de chegada.');
            if (secundaria) {
                const semKm2 = [inputKmSaida2, inputKmChegada2].find(input => !(input?.value || '').trim());
                if (semKm2) return falharValidacao(semKm2, 'Informe o KM de saída e o KM de chegada da placa secundária.');
            }
        }
        const kms = kmsDaViagem();
        if (kms.t1.invalido) return falharValidacao(inputKmChegada, 'O KM de chegada não pode ser menor que o de saída.');
        if (kms.t2.invalido) return falharValidacao(inputKmChegada2, 'O KM de chegada não pode ser menor que o de saída.');

        // Datas, destino inicial e adiantamento: o motorista preenche (adiantamento 0,00 se não houve;
        // destino final é opcional). Mensagens iguais às do banco (passo 14).
        if (!modoAdmin) {
            const saida = dataDoCampo(inputDataSaida);
            const chegada = dataDoCampo(inputDataChegada);
            if (!saida || !chegada) {
                return falharValidacao(!saida ? inputDataSaida : inputDataChegada, 'Informe a data de saída e a data de chegada.');
            }
            if (chegada < saida) return falharValidacao(inputDataChegada, 'A data de chegada não pode ser antes da data de saída.');
            if (!(inputDestinoInicial?.value || '').trim()) return falharValidacao(inputDestinoInicial, 'Informe o destino inicial.');
            if (!(inputAdiantamento?.value || '').trim()) return falharValidacao(inputAdiantamento, 'Informe o valor do adiantamento (0,00 se não houve).');

            // Cada frete preenchido precisa do valor; no Alimentício, o rodotrem escolhe o veículo
            for (let i = 1; i <= 8; i++) {
                const valor = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                if (!valor || !linhaEmUso(valor) || !verificarLinhaFretePreenchida(i)) continue;
                if (!(parseMoeda(valor.value) > 0)) return falharValidacao(valor, 'Informe o valor do frete');
                const cliente = document.querySelector(`select[name="cliente_frete_ml_${i}"]`)?.value || '';
                const veiculo = document.querySelector(`select[name="veiculo_frete_ml_${i}"]`);
                if (cliente === 'alimenticio' && motoristaEscolheVeiculo() && !veiculoDaLinhaFrete(i)) {
                    return falharValidacao(veiculo, 'Escolha o veículo (carreta ou rodotrem) em cada frete do Alimentício.');
                }
            }
        }

        if (!modoAdmin) {
            for (let i = 1; i <= 10; i++) {
                const comb = document.querySelector(`select[name="combustivel_ml_${i}"]`);
                const valor = document.querySelector(`input[name="valor_ml_${i}"]`)?.value || '';
                const litros = document.querySelector(`input[name="litros_ml_${i}"]`)?.value || '';
                const preenchida = parseMoeda(valor) > 0 || parseLitros(litros) > 0;
                if (comb && linhaEmUso(comb) && !comb.value && preenchida) {
                    return falharValidacao(comb, 'Escolha o combustível');
                }
                // Com placa secundária, cada linha preenchida diz de qual placa é
                const selPlaca = document.querySelector(`select[name="placa_abast_ml_${i}"]`);
                if (secundaria && selPlaca && linhaEmUso(selPlaca) && preenchida && !['principal', 'secundaria'].includes(selPlaca.value)) {
                    return falharValidacao(selPlaca, 'Escolha a placa');
                }
            }
        }

        // Litros acima do limite da linha (provável falta da vírgula): o motorista não envia;
        // a gestão só vê o aviso nos campos e pode salvar
        for (let i = 1; i <= 10; i++) {
            const litros = document.querySelector(`input[name="litros_ml_${i}"]`);
            if (!litros || !linhaEmUso(litros) || !litrosForaDoLimite(i)) continue;
            const mensagem = `Confira os litros do abastecimento ${i}: use vírgula para os decimais (ex.: 312,924).`;
            if (!modoAdmin) return falharValidacao(litros, mensagem);
            conferirLitrosDaLinha(i);
        }

        // Outras despesas 2 e 3: tipo e valor andam juntos (os dois vazios = linha ignorada)
        const pares = [[inputMlDespesaDesc2, inputMlDespesaValor2], [inputMlDespesaDesc3, inputMlDespesaValor3]];
        for (const [desc, valor] of pares) {
            if (!desc || !valor) continue;
            const temDesc = (desc.value || '').trim() !== '';
            const temValor = parseMoeda(valor.value || '') > 0;
            if (temValor && !temDesc) return falharValidacao(desc, 'Escolha o tipo da despesa');
            if (temDesc && !temValor) return falharValidacao(valor, 'Informe o valor');
        }
        return true;
    }

    async function atualizarFichaNaBase(idFicha, marcarComoAprovado = false) {
        await enviarComprovantesPendentesMl(idFicha);
        let todas = obterListaFichasCentral();
        let index = todas.findIndex(f => f.id === idFicha);

        const usuarioAtivoStr = localStorage.getItem(STORAGE_USER_ACTIVE);
        let usuarioAtivoSessao = null;
        if (usuarioAtivoStr) {
            try { usuarioAtivoSessao = JSON.parse(usuarioAtivoStr); } catch (e) { }
        }

        const kmPlaca = coletarKmEPlacaSecundaria();
        const totais = totaisParaGravar();
        const dadosAtualizados = {
            id: idFicha,
            protocolo: idFicha,
            motorista: inputMotorista?.value.trim() || (index >= 0 ? todas[index].motorista : '') || usuarioAtivoSessao?.nome || 'Motorista',
            motorista_cpf: (index >= 0 ? (todas[index].motorista_cpf || todas[index].motoristaCpf) : '') || usuarioAtivoSessao?.cpf || '',
            motoristaCpf: (index >= 0 ? (todas[index].motoristaCpf || todas[index].motorista_cpf) : '') || usuarioAtivoSessao?.cpf || '',
            placas: (inputPlacas?.value?.trim() && inputPlacas.value.trim() !== 'A definir pela Gestão') ? inputPlacas.value.trim() : ((index >= 0 ? todas[index].placas : '') || ''),
            // KMs dos dois trechos, totais e placa secundária (sem hífen; vazio apaga)
            ...kmPlaca,
            dataSaida: inputDataSaida?.value || '',
            data_saida: inputDataSaida?.value || '',
            dataChegada: inputDataChegada?.value || '',
            data_chegada: inputDataChegada?.value || '',
            km_saida: kmPlaca.kmSaida,
            kmChegada: kmPlaca.kmEntrada,
            km_chegada: kmPlaca.kmEntrada,
            km_total: kmPlaca.kmTotal,
            destinoInicial: inputDestinoInicial?.value?.trim() || '',
            destino_inicial: inputDestinoInicial?.value?.trim() || '',
            destinoFinal: inputDestinoFinal?.value?.trim() || '',
            destino_final: inputDestinoFinal?.value?.trim() || '',
            totalFrete: totais.totalFrete,
            total_frete: totais.totalFrete,
            vrComissao: totais.vrComissao,
            vr_comissao: totais.vrComissao,
            valorAdiantamento: inputAdiantamento?.value || '',
            valor_adiantamento: inputAdiantamento?.value || '',
            fretes: coletarFretesAtuais(),
            abastecimentos: coletarAbastecimentosAtuais(),
            totalAbastecimento: totais.totalAbastecimento,
            totalLitros: totais.totalLitros,
            totalDiesel: totais.totalDiesel,
            totalArla: totais.totalArla,
            mediaKmL: extrairMediaCombustivelMlParaSalvar(),
            media_km_l: extrairMediaCombustivelMlParaSalvar(),
            ...mediasPorPlacaParaSalvar(),
            status_acerto: (index >= 0 && todas[index].status_acerto) ? todas[index].status_acerto : 'nao_confirmado',
            statusAcerto: (index >= 0 && todas[index].statusAcerto) ? todas[index].statusAcerto : 'nao_confirmado',
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

        // Persistência obrigatória no Supabase: se falhar, NÃO finge que salvou
        if (typeof window.salvarFichaSupabase !== 'function') {
            throw new Error('Serviço de dados indisponível.');
        }
        const resultadoNuvem = await window.salvarFichaSupabase(dadosAtualizados);
        if (!resultadoNuvem || !resultadoNuvem.success) {
            throw new Error('O banco recusou a gravação da ficha.');
        }

        salvarListaFichasCentral(todas);

        // Limpar a chave temporária de rascunho
        localStorage.removeItem(STORAGE_ML_KEY);

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

        // Modal Com Login - Voltar à página principal
        const btnNovoEnvioComLogin = document.getElementById('btn-novo-envio-com-login');
        if (btnNovoEnvioComLogin) {
            btnNovoEnvioComLogin.addEventListener('click', () => {
                localStorage.removeItem(STORAGE_ML_KEY);
                window.location.href = 'index.html';
            });
        }

        // =========================================================================
        // FINALIZAR E ENVIAR RELATÓRIO DE VIAGEM (MOTORISTA / GESTÃO ADMIN)
        // =========================================================================
        const btnFinalizarRelatorioMl = document.getElementById('btn-finalizar-relatorio-ml');
        if (btnFinalizarRelatorioMl) {
            const processarEnvioRelatorioMl = async () => {
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

                    if (!validarKmCombustivelDespesas(true)) return;
                    const textoOriginal = btnFinalizarRelatorioMl.innerHTML;
                    btnFinalizarRelatorioMl.innerHTML = `<span>⏳ Salvando pela Gestão...</span>`;
                    btnFinalizarRelatorioMl.disabled = true;

                    let idSalvar = fichaIdUrl || (fichaCarregada ? fichaCarregada.id : null);
                    try {
                        if (!idSalvar) {
                            idSalvar = await window.reservarNumeroFichaSupabase();
                            atualizarDisplayNumeroFicha(idSalvar);
                        }
                        await atualizarFichaNaBase(idSalvar, false);
                        sessionStorage.setItem('ajborges_toast_mensagem', `Ficha ${idSalvar} salva! Status: Esperando Confirmação`);
                        window.location.href = 'dashboard-admin.html#fichas';
                    } catch (err) {
                        console.error('Erro ao salvar ficha pelo administrador:', err);
                        exibirToast(`Erro ao salvar a ficha ${idSalvar || ''}: ${err.message || 'tente novamente.'}`, 'erro');
                        btnFinalizarRelatorioMl.innerHTML = textoOriginal;
                        btnFinalizarRelatorioMl.disabled = false;
                    }
                    return;
                }

                const isComLogin = usuarioAtivo && usuarioAtivo.role === 'motorista';

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
                if (!validarKmCombustivelDespesas(false)) return;

                const textoOriginalEnvio = btnFinalizarRelatorioMl.innerHTML;
                const restaurarBotaoEnvio = () => {
                    btnFinalizarRelatorioMl.innerHTML = textoOriginalEnvio;
                    btnFinalizarRelatorioMl.disabled = false;
                };
                btnFinalizarRelatorioMl.innerHTML = `<span>⏳ Enviando ficha...</span>`;
                btnFinalizarRelatorioMl.disabled = true;

                // Número único da ficha gerado pelo banco (ex: AJB-2026-004)
                let novoIdFicha;
                try {
                    novoIdFicha = await window.reservarNumeroFichaSupabase();
                    atualizarDisplayNumeroFicha(novoIdFicha);
                } catch (errNumero) {
                    console.error('Erro ao reservar número da ficha:', errNumero);
                    exibirToast('Não foi possível gerar o número da ficha. Verifique a conexão e tente novamente.', 'erro');
                    restaurarBotaoEnvio();
                    return;
                }

                // Envia os comprovantes para a pasta do motorista no Storage
                try {
                    await enviarComprovantesPendentesMl(novoIdFicha);
                } catch (errUpload) {
                    exibirToast(errUpload.message, 'erro');
                    restaurarBotaoEnvio();
                    return;
                }

                // Monta objeto completo da nova ficha com todas as colunas requeridas
                const agoraDataHora = new Date().toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                const nomeFinalMotorista = inputMotorista?.value.trim() || (isComLogin ? usuarioAtivo?.nome : '') || 'Motorista';
                const kmPlaca = coletarKmEPlacaSecundaria();
                // Totais da tela; o banco recalcula total frete, comissão e saldo do motorista
                const totais = totaisParaGravar();

                const novaFicha = {
                    id: novoIdFicha,
                    protocolo: novoIdFicha,
                    dataEnvio: agoraDataHora,
                    motorista: nomeFinalMotorista,
                    motorista_cpf: usuarioAtivo?.cpf || '',
                    motoristaCpf: usuarioAtivo?.cpf || '',
                    motoristaId: isComLogin ? usuarioAtivo.id : 'anonimo',
                    origemEnvio: isComLogin ? 'motorista_com_login' : 'motorista_sem_login',
                    placas: (inputPlacas?.value?.trim() && inputPlacas.value.trim() !== 'A definir pela Gestão') ? inputPlacas.value.trim() : '',
                    data_saida: inputDataSaida?.value || '',
                    dataSaida: inputDataSaida?.value || '',
                    data_chegada: inputDataChegada?.value || '',
                    dataChegada: inputDataChegada?.value || '',
                    // KMs dos dois trechos e placa secundária (o banco recalcula os totais do motorista)
                    ...kmPlaca,
                    km_saida: kmPlaca.kmSaida,
                    km_chegada: kmPlaca.kmEntrada,
                    kmChegada: kmPlaca.kmEntrada,
                    km_total: kmPlaca.kmTotal,
                    destino_inicial: inputDestinoInicial?.value?.trim() || '',
                    destinoInicial: inputDestinoInicial?.value?.trim() || '',
                    destino_final: inputDestinoFinal?.value?.trim() || '',
                    destinoFinal: inputDestinoFinal?.value?.trim() || '',
                    total_frete: totais.totalFrete,
                    totalFrete: totais.totalFrete,
                    vr_comissao: totais.vrComissao,
                    vrComissao: totais.vrComissao,
                    valor_adiantamento: inputAdiantamento?.value || '',
                    valorAdiantamento: inputAdiantamento?.value || '',
                    fretes: fretesAtuais,
                    abastecimentos: abastsAtuais,
                    totalAbastecimento: totais.totalAbastecimento,
                    totalLitros: totais.totalLitros,
                    totalDiesel: totais.totalDiesel,
                    totalArla: totais.totalArla,
                    media_km_l: extrairMediaCombustivelMlParaSalvar(),
                    mediaKmL: extrairMediaCombustivelMlParaSalvar(),
                    ...mediasPorPlacaParaSalvar(),
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
                    status_acerto: 'nao_confirmado',
                    statusAcerto: 'nao_confirmado',
                    status: 'pendente'
                };
                novaFicha.dados_completos = { ...novaFicha };

                // Envia para o Supabase e só confirma ao motorista se gravou de verdade
                const resultadoEnvio = (typeof window.salvarFichaSupabase === 'function')
                    ? await window.salvarFichaSupabase(novaFicha)
                    : null;
                if (!resultadoEnvio || !resultadoEnvio.success) {
                    exibirToast('A ficha NÃO foi enviada. Verifique a conexão e tente novamente; seus dados continuam na tela.', 'erro');
                    restaurarBotaoEnvio();
                    return;
                }

                // Cópia local apenas para exibição
                const todasFichas = obterListaFichasCentral();
                todasFichas.unshift(novaFicha);
                salvarListaFichasCentral(todasFichas);
                restaurarBotaoEnvio();

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
            };

            // Mesmo critério de modo admin usado em processarEnvioRelatorioMl
            const ehModoAdminFichaMl = () => {
                let usuarioAtivo = null;
                try { usuarioAtivo = JSON.parse(localStorage.getItem(STORAGE_USER_ACTIVE) || 'null'); } catch (e) { }
                const modeUrl = new URLSearchParams(window.location.search).get('mode');
                return (modeUrl === 'admin') || !!(usuarioAtivo && (usuarioAtivo.role === 'admin' || usuarioAtivo.role === 'diretoria') && modeUrl !== 'motorista');
            };

            // Modal de revisão antes do envio (somente modo motorista)
            const modalRevisarEnvio = document.getElementById('modal-revisar-envio');
            const btnRevisarVoltar = document.getElementById('btn-revisar-voltar');
            const btnRevisarConfirmar = document.getElementById('btn-revisar-confirmar');

            const modalRevisarAberto = () => !!(modalRevisarEnvio && modalRevisarEnvio.classList.contains('ativo'));

            const abrirModalRevisarEnvio = () => {
                const qtdOutrasDespesas = inputsOutrasDespesasValorMl
                    .filter(input => input && parseMoeda(input.value || '') > 0).length;
                const definirTexto = (id, valor) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = String(valor);
                };
                definirTexto('revisar-qtd-abastecimentos', coletarAbastecimentosAtuais().length);
                definirTexto('revisar-qtd-fretes', coletarFretesAtuais().length);
                definirTexto('revisar-qtd-outras-despesas', qtdOutrasDespesas);
                definirTexto('revisar-qtd-comprovantes', (arquivosComprovantesMl || []).length);
                preencherDetalhesRevisao();

                modalRevisarEnvio.classList.add('ativo');
                modalRevisarEnvio.setAttribute('aria-hidden', 'false');
                if (btnRevisarVoltar) btnRevisarVoltar.focus();
            };

            const fecharModalRevisarEnvio = () => {
                modalRevisarEnvio.classList.remove('ativo');
                modalRevisarEnvio.setAttribute('aria-hidden', 'true');
                btnFinalizarRelatorioMl.focus();
            };

            btnFinalizarRelatorioMl.addEventListener('click', (e) => {
                e.preventDefault();
                if (btnFinalizarRelatorioMl.disabled) return;

                if (ehModoAdminFichaMl() || !modalRevisarEnvio) {
                    processarEnvioRelatorioMl();
                    return;
                }
                // Motorista: confere KMs, combustível e despesas antes de abrir a revisão
                if (!validarKmCombustivelDespesas(false)) return;
                abrirModalRevisarEnvio();
            });

            if (modalRevisarEnvio) {
                if (btnRevisarVoltar) btnRevisarVoltar.addEventListener('click', fecharModalRevisarEnvio);

                if (btnRevisarConfirmar) {
                    btnRevisarConfirmar.addEventListener('click', () => {
                        modalRevisarEnvio.classList.remove('ativo');
                        modalRevisarEnvio.setAttribute('aria-hidden', 'true');
                        processarEnvioRelatorioMl();
                    });
                }

                // Clique fora do card = voltar para a ficha
                modalRevisarEnvio.addEventListener('click', (e) => {
                    if (e.target === modalRevisarEnvio) fecharModalRevisarEnvio();
                });

                // Esc = voltar para a ficha
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && modalRevisarAberto()) {
                        e.preventDefault();
                        fecharModalRevisarEnvio();
                    }
                });
            }
        }

        // Salvar progresso ao digitar nos campos e prevenir submit padrão
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
            });

            // Enter nunca envia a ficha (em <textarea> continua quebrando linha;
            // em botões continua acionando o próprio botão)
            form.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || e.isComposing) return;
                const alvo = e.target;
                if (!alvo || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'BUTTON' || alvo.tagName === 'A') return;
                e.preventDefault();
            });
            form.addEventListener('input', () => {
                salvarProgressoMl();
            });
        }

        window.carregarProgressoMl = carregarProgressoMl;
        carregarProgressoMl();
        prepararListasCelular();

        // Dispara a configuração completa do ciclo de vida
        configurarCicloDeVidaViagem();
    });

