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
    // 0. Identificador Sequencial da Ficha
    // ------------------------------------------
    function obterNumeroFichaAtual() {
        const salvo = localStorage.getItem(STORAGE_FICHA_KEY);
        const num = parseInt(salvo, 10);
        return (!isNaN(num) && num > 0) ? num : 1;
    }

    function formatarNumeroFicha(num) {
        return '#' + String(num).padStart(4, '0');
    }

    function atualizarDisplayNumeroFicha() {
        if (numeroFichaDisplay) {
            numeroFichaDisplay.textContent = formatarNumeroFicha(obterNumeroFichaAtual());
        }
    }

    function incrementarNumeroFicha() {
        const atual = obterNumeroFichaAtual();
        const proximo = atual + 1;
        localStorage.setItem(STORAGE_FICHA_KEY, proximo);
        atualizarDisplayNumeroFicha();
        return proximo;
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
    if (inputPlacas) {
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
    aplicarMascaraMilhar(inputKmSaida, () => calcularKmTotal());
    aplicarMascaraMilhar(inputKmChegada, () => calcularKmTotal());

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

    // Formatação de Litros: números inteiros (ex: 445675 -> 445.675) sem zeros extras no final (,000);
    // decimais digitados com vírgula mantêm suas casas decimais (ex: 445,675 -> 445,675).
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
        const s = str.toString().trim().replace(/\./g, '').replace(',', '.');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function formatarTextoLitros(val) {
        if (!val) return '';
        const texto = val.toString().trim();
        if (!texto) return '';

        // Se contém vírgula, o usuário informou casas decimais explicitamente
        if (texto.includes(',')) {
            const partes = texto.split(',');
            const parteInteiraLimpa = partes[0].replace(/\D/g, '');
            const parteDecimal = partes.slice(1).join('').replace(/\D/g, '').substring(0, 3);

            const numInteiro = parseInt(parteInteiraLimpa, 10);
            const parteInteiraFormatada = isNaN(numInteiro) ? '0' : numInteiro.toLocaleString('pt-BR');

            return parteDecimal.length > 0 ? `${parteInteiraFormatada},${parteDecimal}` : `${parteInteiraFormatada},`;
        }

        // Sem vírgula: número inteiro puro ou com pontos de milhar
        const digitos = texto.replace(/\D/g, '');
        if (!digitos) return '';
        const num = parseInt(digitos, 10);
        if (isNaN(num)) return '';
        return num.toLocaleString('pt-BR');
    }

    function aplicarMascaraLitros(input, callback) {
        if (!input) return;

        // Ao focar, remove pontos de milhar para facilitar a edição pelo usuário
        input.addEventListener('focus', (e) => {
            if (e.target.value) {
                if (e.target.value.includes(',')) {
                    const partes = e.target.value.split(',');
                    e.target.value = partes[0].replace(/\./g, '') + ',' + partes[1];
                } else {
                    e.target.value = e.target.value.replace(/\./g, '');
                }
            }
        });

        // Durante a digitação: aceita dígitos e até 1 separador decimal (vírgula ou ponto convertido)
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

        // Ao perder o foco (blur): formata com separador de milhar e preserva decimais se houver vírgula
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
    const selectsClienteFreteMl = [];
    const inputTotalRelacaoFrete = document.getElementById('ml-total-relacao-frete');
    const inputTotalRelacaoComissao = document.getElementById('ml-total-relacao-comissao');

    function atualizarLinhaFreteMl(index, acaoDisparadaPorSelect = false) {
        const selectCli = document.querySelector(`select[name="cliente_frete_ml_${index}"]`);
        const inputValFrete = document.querySelector(`input[name="valor_frete_ml_${index}"]`);
        const inputComissao = document.querySelector(`input[name="comissao_frete_ml_${index}"]`);

        if (!selectCli || !inputValFrete || !inputComissao) return;

        const tipoOperacao = selectCli.value;

        if (tipoOperacao === 'mercado_livre') {
            inputValFrete.value = '400,00';
            inputValFrete.setAttribute('readonly', 'readonly');
            inputComissao.value = '400,00';
        } else if (tipoOperacao === 'alimenticio' || tipoOperacao === 'shopee') {
            inputValFrete.removeAttribute('readonly');
            if (acaoDisparadaPorSelect && inputValFrete.value === '400,00') {
                inputValFrete.value = '';
            }
            const valorNum = parseMoeda(inputValFrete.value);
            if (valorNum > 0) {
                const comissao11 = valorNum * 0.11;
                inputComissao.value = formatarMoedaSemPrefixo(comissao11);
            } else {
                inputComissao.value = '';
            }
        } else {
            // Vazio / Desmarcado
            inputValFrete.removeAttribute('readonly');
            if (acaoDisparadaPorSelect) {
                inputValFrete.value = '';
            }
            inputComissao.value = '';
        }
    }

    for (let i = 1; i <= 8; i++) {
        const inputValFrete = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
        const inputComissao = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);
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
            });
        }

        if (inputValFrete) {
            inputsValorFreteMl.push(inputValFrete);
            aplicarMascaraMoeda(inputValFrete, () => {
                atualizarLinhaFreteMl(i, false);
                calcularTotaisFreteMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }

        if (inputComissao) {
            inputsComissaoFreteMl.push(inputComissao);
        }

        if (inputDataFrete) {
            inputDataFrete.addEventListener('input', salvarProgressoMl);
        }
        if (inputOrigemFrete) {
            inputOrigemFrete.addEventListener('input', salvarProgressoMl);
        }
        if (inputDestinoFrete) {
            inputDestinoFrete.addEventListener('input', salvarProgressoMl);
        }
    }

    function calcularTotaisFreteMl() {
        let somaFrete = 0;
        let somaComissao = 0;

        inputsValorFreteMl.forEach(input => {
            somaFrete += parseMoeda(input.value);
        });

        inputsComissaoFreteMl.forEach(input => {
            somaComissao += parseMoeda(input.value);
        });

        if (inputTotalRelacaoFrete) {
            inputTotalRelacaoFrete.value = formatarMoedaSemPrefixo(somaFrete);
        }

        if (inputTotalRelacaoComissao) {
            inputTotalRelacaoComissao.value = formatarMoedaSemPrefixo(somaComissao);
        }

        // Sincroniza automaticamente a soma total de comissões com o campo "VR COMISSÃO" do cabeçalho
        if (inputVrComissao) {
            inputVrComissao.value = somaComissao > 0 ? formatarMoedaSemPrefixo(somaComissao) : '';
        }

        // Sincroniza automaticamente com o campo "TOTAL FRETE" do cabeçalho
        if (inputTotalFrete) {
            inputTotalFrete.value = somaFrete > 0 ? formatarMoedaSemPrefixo(somaFrete) : '';
        }

        return { frete: somaFrete, comissao: somaComissao };
    }

    // 15.2. Abastecimento ML (10 Linhas - Sem Média)
    const inputsValorAbastMl = [];
    const inputsLitrosAbastMl = [];
    const inputTotalValorCombustivelMl = document.getElementById('ml-total-valor-combustivel');
    const inputTotalLitrosCombustivelMl = document.getElementById('ml-total-litros-combustivel');

    for (let i = 1; i <= 10; i++) {
        const inputPosto = document.querySelector(`input[name="posto_ml_${i}"]`);
        const inputNf = document.querySelector(`input[name="nf_ml_${i}"]`);
        const inputKm = document.querySelector(`input[name="km_ml_${i}"]`);
        const inputValor = document.querySelector(`input[name="valor_ml_${i}"]`);
        const inputLitros = document.querySelector(`input[name="litros_ml_${i}"]`);

        if (inputPosto) inputPosto.addEventListener('input', salvarProgressoMl);

        if (inputNf) {
            aplicarMascaraMilhar(inputNf, salvarProgressoMl);
        }

        if (inputKm) {
            aplicarMascaraMilhar(inputKm, () => {
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }

        if (inputValor) {
            inputsValorAbastMl.push(inputValor);
            aplicarMascaraMoeda(inputValor, () => {
                calcularTotaisAbastecimentoMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }

        if (inputLitros) {
            inputsLitrosAbastMl.push(inputLitros);
            aplicarMascaraLitros(inputLitros, () => {
                calcularTotaisAbastecimentoMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
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
                mlIndicadorMedia.innerHTML = `${formatarDecimal(mediaGeral, 2)} <span class="indicador-unidade">km/l</span>`;
            } else {
                mlIndicadorMedia.innerHTML = `0,00 <span class="indicador-unidade">km/l</span>`;
            }
        }
        if (mlCalcBaseKm) mlCalcBaseKm.textContent = kmTotalNum > 0 ? formatarMilhar(kmTotalNum) : '0';
        if (mlCalcBaseLitros) mlCalcBaseLitros.textContent = formatarLitros(totaisCombustivel.litros);

        // 2. Despesa Total = Combustível + Impostos/Pedágios + Outras Despesas + Vr Comissão
        const vrComissaoNum = parseMoeda(inputVrComissao ? inputVrComissao.value : '');

        const despesaTotalCalculada = totaisCombustivel.valor +
            totaisDespesas.totalGeralDespesas +
            vrComissaoNum;

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
            mlIndicadorResultado.textContent = formatarMoeda(resultadoViagemCalculado);
            if (resultadoViagemCalculado >= 0) {
                mlIndicadorResultado.style.color = '#065f46';
            } else {
                mlIndicadorResultado.style.color = '#b91c1c';
            }
        }

        // 4. Saldo de Comissão ML = VR Comissão
        const saldoComissao = vrComissaoNum;

        if (mlIndicadorSaldoComissao) {
            mlIndicadorSaldoComissao.textContent = formatarMoeda(saldoComissao);
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
    const btnLimparFretesMlPreenchidas = document.getElementById('btn-limpar-fretes-ml-preenchidas');
    const btnLimparFretesMlTodas = document.getElementById('btn-limpar-fretes-ml-todas');

    const btnLixeiraAbastMl = document.getElementById('btn-lixeira-abast-ml');
    const popoverLimparAbastMl = document.getElementById('popover-limpar-abast-ml');
    const fecharPopoverAbastMl = document.getElementById('fechar-popover-abast-ml');
    const btnLimparAbastMlPreenchidas = document.getElementById('btn-limpar-abast-ml-preenchidas');
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

    // Ações de Limpeza de Fretes
    if (btnLimparFretesMlPreenchidas) {
        btnLimparFretesMlPreenchidas.addEventListener('click', () => {
            let limpos = 0;
            for (let i = 1; i <= 8; i++) {
                const dt = document.querySelector(`input[name="data_frete_ml_${i}"]`);
                const selCli = document.querySelector(`select[name="cliente_frete_ml_${i}"]`);
                const og = document.querySelector(`input[name="origem_frete_ml_${i}"]`);
                const dst = document.querySelector(`input[name="destino_frete_ml_${i}"]`);
                const vl = document.querySelector(`input[name="valor_frete_ml_${i}"]`);
                const com = document.querySelector(`input[name="comissao_frete_ml_${i}"]`);

                if ((dt && dt.value) || (selCli && selCli.value) || (og && og.value) || (dst && dst.value) || (vl && vl.value) || (com && com.value)) {
                    if (dt) dt.value = '';
                    if (selCli) selCli.value = '';
                    if (og) og.value = '';
                    if (dst) dst.value = '';
                    if (vl) {
                        vl.value = '';
                        vl.removeAttribute('readonly');
                    }
                    if (com) com.value = '';
                    limpos++;
                }
            }
            if (popoverLimparFretesMl) popoverLimparFretesMl.classList.add('oculto');
            calcularTotaisFreteMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast(`${limpos} frete(s) limpo(s)!`, 'sucesso');
        });
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

                if (dt) dt.value = '';
                if (selCli) selCli.value = '';
                if (og) og.value = '';
                if (dst) dst.value = '';
                if (vl) {
                    vl.value = '';
                    vl.removeAttribute('readonly');
                }
                if (com) com.value = '';
            }
            if (popoverLimparFretesMl) popoverLimparFretesMl.classList.add('oculto');
            calcularTotaisFreteMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Todas as 8 linhas de frete foram limpas!', 'sucesso');
        });
    }

    // Ações de Limpeza de Abastecimento ML
    if (btnLimparAbastMlPreenchidas) {
        btnLimparAbastMlPreenchidas.addEventListener('click', () => {
            let limpos = 0;
            for (let i = 1; i <= 10; i++) {
                const posto = document.querySelector(`input[name="posto_ml_${i}"]`);
                const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                const km = document.querySelector(`input[name="km_ml_${i}"]`);
                const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                if ((posto && posto.value) || (nf && nf.value) || (km && km.value) || (valor && valor.value) || (litros && litros.value)) {
                    if (posto) posto.value = '';
                    if (nf) nf.value = '';
                    if (km) km.value = '';
                    if (valor) valor.value = '';
                    if (litros) litros.value = '';
                    limpos++;
                }
            }
            if (popoverLimparAbastMl) popoverLimparAbastMl.classList.add('oculto');
            calcularTotaisAbastecimentoMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast(`${limpos} linha(s) de abastecimento ML limpa(s)!`, 'sucesso');
        });
    }

    if (btnLimparAbastMlTodas) {
        btnLimparAbastMlTodas.addEventListener('click', () => {
            for (let i = 1; i <= 10; i++) {
                const posto = document.querySelector(`input[name="posto_ml_${i}"]`);
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
                    comissao: document.querySelector(`input[name="comissao_frete_ml_${i}"]`)?.value || ''
                });
            }

            const abastecimentosMl = [];
            for (let i = 1; i <= 10; i++) {
                abastecimentosMl.push({
                    posto: document.querySelector(`input[name="posto_ml_${i}"]`)?.value || '',
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
                    if (inputMotorista && dados.cabecalho.motorista) inputMotorista.value = dados.cabecalho.motorista;
                    if (inputPlacas && dados.cabecalho.placas) inputPlacas.value = dados.cabecalho.placas;
                    if (inputDataSaida && dados.cabecalho.dataSaida) inputDataSaida.value = dados.cabecalho.dataSaida;
                    if (inputDataChegada && dados.cabecalho.dataChegada) inputDataChegada.value = dados.cabecalho.dataChegada;
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

                        if (dt && f.data) dt.value = f.data;
                        if (selCli && f.cliente !== undefined) selCli.value = f.cliente;
                        if (og && f.origem) og.value = f.origem;
                        if (dst && f.destino) dst.value = f.destino;

                        if (f.cliente || f.valor || f.origem || f.destino) {
                            temFretePreenchido = true;
                        }

                        if (f.cliente === 'mercado_livre') {
                            if (vl) {
                                vl.value = f.valor || '400,00';
                                vl.setAttribute('readonly', 'readonly');
                            }
                            if (com) {
                                com.value = f.comissao || '400,00';
                            }
                        } else if (f.cliente === 'alimenticio' || f.cliente === 'shopee') {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com) {
                                if (f.comissao) {
                                    com.value = f.comissao;
                                } else if (vl && vl.value) {
                                    const vNum = parseMoeda(vl.value);
                                    com.value = vNum > 0 ? formatarMoedaSemPrefixo(vNum * 0.11) : '';
                                }
                            }
                        } else {
                            if (vl) {
                                vl.removeAttribute('readonly');
                                if (f.valor) vl.value = f.valor;
                            }
                            if (com && f.comissao) com.value = f.comissao;
                        }
                    });
                }

                // Restaurar abastecimento
                let temAbastPreenchido = false;
                if (Array.isArray(dados.abastecimentos)) {
                    dados.abastecimentos.forEach((ab, idx) => {
                        const i = idx + 1;
                        const posto = document.querySelector(`input[name="posto_ml_${i}"]`);
                        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                        const km = document.querySelector(`input[name="km_ml_${i}"]`);
                        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                        if (posto && ab.posto) { posto.value = ab.posto; temAbastPreenchido = true; }
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

    const btnFinalizarRelatorioMl = document.getElementById('btn-finalizar-relatorio-ml');
    if (btnFinalizarRelatorioMl) {
        btnFinalizarRelatorioMl.addEventListener('click', (e) => {
            e.preventDefault();

            const motoristaPreenchido = inputMotorista && inputMotorista.value.trim() !== '';
            const placasPreenchida = inputPlacas && inputPlacas.value.trim() !== '';
            const impostoFederalPreenchido = inputMlImpFederal && inputMlImpFederal.value.trim() !== '';

            if (!motoristaPreenchido || !placasPreenchida) {
                exibirToast('Preencha os dados do motorista e placa no cabeçalho.', 'erro');
                if (!motoristaPreenchido && inputMotorista) inputMotorista.focus();
                else if (!placasPreenchida && inputPlacas) inputPlacas.focus();
                return;
            }

            if (!impostoFederalPreenchido) {
                exibirToast('O valor do Imposto Federal é obrigatório no relatório.', 'erro');
                if (inputMlImpFederal) inputMlImpFederal.focus();
                return;
            }

            salvarProgressoMl();
            const fichaAtual = formatarNumeroFicha(obterNumeroFichaAtual());
            const proximoNumero = incrementarNumeroFicha();
            const proximaFicha = formatarNumeroFicha(proximoNumero);
            exibirToast(`Relatório de Viagem ${fichaAtual} finalizado e enviado com sucesso! Próxima ficha: ${proximaFicha}.`, 'sucesso');
        });
    }

    // Salvar progresso ao digitar nos campos de cabeçalho e prevenir submit padrão
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
        form.addEventListener('input', () => {
            salvarProgressoMl();
        });
    }

    carregarProgressoMl();
});
