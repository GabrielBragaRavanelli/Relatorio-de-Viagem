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

    // Seletor de Tipo de Relatório
    const btnOpcaoPadrao = document.getElementById('btn-opcao-padrao');
    const btnOpcaoMl = document.getElementById('btn-opcao-ml');
    const secaoPadrao = document.getElementById('secao-formulario-padrao');
    const secaoMl = document.getElementById('secao-formulario-ml');

    // Toast
    const toast = document.getElementById('toast-notificacao');

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
    // 4. Cálculo Automático do KM / HM Total
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

        if (typeof calcularIndicadoresViagem === 'function') {
            calcularIndicadoresViagem();
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
        inputRetorno3,
        inputTotalFrete,
        inputVrComissao
    ];

    camposMoedaTopo.forEach(campo => {
        aplicarMascaraMoeda(campo, () => {
            calcularTotalFrete();
            calcularIndicadoresViagem();
            if (typeof calcularIndicadoresViagemMl === 'function') {
                calcularIndicadoresViagemMl();
            }
        });
    });

    // ------------------------------------------
    // 4. Cálculo Automático do Total de Fretes
    // ------------------------------------------
    function calcularTotalFrete() {
        if (!inputTotalFrete) return;

        const valOrigem = parseMoeda(inputFreteOrigem ? inputFreteOrigem.value : '');
        const valRetorno1 = parseMoeda(inputRetorno1 ? inputRetorno1.value : '');
        const valRetorno2 = parseMoeda(inputRetorno2 ? inputRetorno2.value : '');
        const valRetorno3 = parseMoeda(inputRetorno3 ? inputRetorno3.value : '');

        const total = valOrigem + valRetorno1 + valRetorno2 + valRetorno3;

        if (total > 0) {
            inputTotalFrete.value = formatarMoedaSemPrefixo(total);
        } else {
            inputTotalFrete.value = '';
        }
    }

    // ------------------------------------------
    // 5. Cálculos da Tabela de Abastecimentos (10 Linhas)
    // ------------------------------------------
    const inputsValorAbast = [];
    const inputsLitrosAbast = [];

    for (let i = 1; i <= 10; i++) {
        const inputNf = document.querySelector(`input[name="nf_${i}"]`);
        const inputKm = document.querySelector(`input[name="km_${i}"]`);
        const inputValor = document.querySelector(`input[name="valor_${i}"]`);
        const inputLitros = document.querySelector(`input[name="litros_${i}"]`);

        if (inputNf) {
            aplicarMascaraMilhar(inputNf, salvarProgressoAutomatico);
        }

        if (inputKm) {
            aplicarMascaraMilhar(inputKm, () => {
                calcularIndicadoresViagem();
                salvarProgressoAutomatico();
            });
        }

        if (inputValor) {
            inputsValorAbast.push(inputValor);
            aplicarMascaraMoeda(inputValor, () => {
                calcularTotaisAbastecimento();
                calcularIndicadoresViagem();
                salvarProgressoAutomatico();
            });
        }

        if (inputLitros) {
            inputsLitrosAbast.push(inputLitros);
            aplicarMascaraLitros(inputLitros, () => {
                calcularTotaisAbastecimento();
                calcularIndicadoresViagem();
                salvarProgressoAutomatico();
            });
        }
    }

    function calcularTotaisAbastecimento() {
        let somaValor = 0;
        let somaLitros = 0;

        for (let i = 1; i <= 10; i++) {
            const inputValor = document.querySelector(`input[name="valor_${i}"]`);
            const inputLitros = document.querySelector(`input[name="litros_${i}"]`);

            if (inputValor && inputValor.value) {
                somaValor += parseMoeda(inputValor.value);
            }
            if (inputLitros && inputLitros.value) {
                somaLitros += parseLitros(inputLitros.value);
            }
        }

        const totalValorEl = document.getElementById('total-valor-combustivel');
        const totalLitrosEl = document.getElementById('total-litros-combustivel');

        if (totalValorEl) {
            totalValorEl.value = formatarMoedaSemPrefixo(somaValor);
        }
        if (totalLitrosEl) {
            totalLitrosEl.value = formatarLitros(somaLitros);
        }

        return { somaValor, somaLitros };
    }

    // ------------------------------------------
    // 6. Cálculos de Pedágios (3 Linhas)
    // ------------------------------------------
    const inputsPedagio = [
        document.getElementById('pedagio-1'),
        document.getElementById('pedagio-2'),
        document.getElementById('pedagio-3')
    ];

    inputsPedagio.forEach(input => {
        if (input) {
            aplicarMascaraMoeda(input, calcularIndicadoresViagem);
        }
    });

    function calcularTotalPedagio() {
        let total = 0;
        inputsPedagio.forEach(input => {
            if (input && input.value) {
                total += parseMoeda(input.value);
            }
        });

        const totalPedagioEl = document.getElementById('total-pedagio');
        if (totalPedagioEl) {
            totalPedagioEl.value = formatarDecimal(total, 2);
        }
        return total;
    }

    // ------------------------------------------
    // 7. Cálculos de Outras Despesas (3 Linhas, Linha 1 Imposto Federal)
    // ------------------------------------------
    const inputsOutrasDespesasValor = [
        document.getElementById('despesa-valor-1'),
        document.getElementById('despesa-valor-2'),
        document.getElementById('despesa-valor-3')
    ];

    inputsOutrasDespesasValor.forEach(input => {
        if (input) {
            aplicarMascaraMoeda(input, calcularIndicadoresViagem);
        }
    });

    function calcularTotalOutrasDespesas() {
        let total = 0;
        inputsOutrasDespesasValor.forEach(input => {
            if (input && input.value) {
                total += parseMoeda(input.value);
            }
        });

        const totalOutrasEl = document.getElementById('total-outras-despesas');
        if (totalOutrasEl) {
            totalOutrasEl.value = formatarDecimal(total, 2);
        }
        return total;
    }

    // ------------------------------------------
    // 8. Indicadores Finais Consolidados da Viagem
    // ------------------------------------------
    function calcularIndicadoresViagem() {
        const { somaValor: totalCombustivel, somaLitros: totalLitros } = calcularTotaisAbastecimento();
        const totalPedagio = calcularTotalPedagio();
        const totalOutras = calcularTotalOutrasDespesas();

        // 1. Média de Combustível (KM Total / Total Litros)
        let kmTotal = 0;
        if (inputKmTotal && inputKmTotal.value) {
            kmTotal = parseFloat(inputKmTotal.value.toString().replace(/\D/g, '')) || 0;
        }

        const cardMedia = document.getElementById('indicador-media-combustivel');
        const baseKmEl = document.getElementById('calc-base-km');
        const baseLitrosEl = document.getElementById('calc-base-litros');

        if (baseKmEl) baseKmEl.textContent = kmTotal > 0 ? formatarMilhar(kmTotal) : '0';
        if (baseLitrosEl) baseLitrosEl.textContent = totalLitros > 0 ? formatarLitros(totalLitros) : '0';

        if (cardMedia) {
            if (kmTotal > 0 && totalLitros > 0) {
                const media = kmTotal / totalLitros;
                cardMedia.innerHTML = `${formatarDecimal(media, 2)} <span class="indicador-unidade">km/l</span>`;
            } else {
                cardMedia.innerHTML = `0,00 <span class="indicador-unidade">km/l</span>`;
            }
        }

        // 2. Despesa Total = Combustível + Pedágio + Outras Despesas
        const despesaTotal = totalCombustivel + totalPedagio + totalOutras;
        const cardDespesa = document.getElementById('indicador-despesa-total');
        if (cardDespesa) {
            cardDespesa.textContent = formatarMoeda(despesaTotal);
        }

        // 3. Resultado da Viagem = Total Frete - Despesa Total
        let totalFrete = 0;
        if (inputTotalFrete && inputTotalFrete.value) {
            totalFrete = parseMoeda(inputTotalFrete.value);
        }
        const resultadoViagem = totalFrete - despesaTotal;
        const cardResultado = document.getElementById('indicador-resultado-viagem');
        if (cardResultado) {
            cardResultado.textContent = formatarMoeda(resultadoViagem);
            if (resultadoViagem < 0) {
                cardResultado.style.color = '#e11d48';
            } else {
                cardResultado.style.color = '#047857';
            }
        }

        // 4. Saldo de Comissão = VR Comissão - Adiantamento
        let vrComissao = 0;
        if (inputVrComissao && inputVrComissao.value) {
            vrComissao = parseMoeda(inputVrComissao.value);
        }
        let adiantamento = 0;
        if (inputAdiantamento && inputAdiantamento.value) {
            adiantamento = parseMoeda(inputAdiantamento.value);
        }

        // Saldo líquido a acertar da comissão
        const saldoComissao = vrComissao > 0 ? (vrComissao - adiantamento) : 0;
        const cardComissao = document.getElementById('indicador-saldo-comissao');
        if (cardComissao) {
            cardComissao.textContent = formatarMoeda(saldoComissao > 0 ? saldoComissao : vrComissao);
        }
    }

    // ------------------------------------------
    // 9. Upload de Arquivos / Comprovantes
    // ------------------------------------------
    const dropzoneBox = document.getElementById('dropzone-comprovantes');
    const inputFileDespesas = document.getElementById('input-arquivos-despesas');
    const listaAnexosPreview = document.getElementById('lista-anexos-preview');
    const contadorAnexos = document.getElementById('contador-anexos');
    let arquivosComprovantes = [];

    function formatarTamanhoArquivo(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const tamanhos = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + tamanhos[i];
    }

    function renderizarListaAnexos() {
        if (!listaAnexosPreview) return;
        listaAnexosPreview.innerHTML = '';

        arquivosComprovantes.forEach((arq, index) => {
            const item = document.createElement('div');
            item.className = 'item-anexo-card';
            const ehPdf = arq.name.toLowerCase().endsWith('.pdf');
            const iconeSvg = ehPdf ?
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

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
            listaAnexosPreview.appendChild(item);
        });

        if (contadorAnexos) {
            contadorAnexos.textContent = `${arquivosComprovantes.length} arquivo(s)`;
        }

        listaAnexosPreview.querySelectorAll('.btn-remover-anexo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                arquivosComprovantes.splice(idx, 1);
                renderizarListaAnexos();
                salvarProgressoAutomatico();
            });
        });
    }

    function adicionarArquivos(novosArquivos) {
        let adicionados = 0;
        for (let i = 0; i < novosArquivos.length; i++) {
            const file = novosArquivos[i];
            if (file.size > 15 * 1024 * 1024) {
                exibirToast(`Arquivo "${file.name}" excede 15MB.`, 'erro');
                continue;
            }
            arquivosComprovantes.push({
                name: file.name,
                size: file.size,
                type: file.type
            });
            adicionados++;
        }

        if (adicionados > 0) {
            renderizarListaAnexos();
            salvarProgressoAutomatico();
            exibirToast(`${adicionados} comprovante(s) anexado(s) com sucesso.`, 'sucesso');
        }
    }

    if (dropzoneBox && inputFileDespesas) {
        dropzoneBox.addEventListener('click', () => inputFileDespesas.click());

        inputFileDespesas.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                adicionarArquivos(e.target.files);
                e.target.value = '';
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzoneBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneBox.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzoneBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneBox.classList.remove('dragover');
            });
        });

        dropzoneBox.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                adicionarArquivos(e.dataTransfer.files);
            }
        });
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

    // ------------------------------------------
    // 11. Alternância do Tipo de Relatório
    // ------------------------------------------
    const STORAGE_TIPO_KEY = 'ajborges_tipo_relatorio_escolhido';

    function selecionarTipoRelatorio(tipo, dispararToast = true) {
        if (tipo === 'padrao') {
            if (btnOpcaoPadrao) btnOpcaoPadrao.classList.add('opcao-selecionada');
            if (btnOpcaoMl) btnOpcaoMl.classList.remove('opcao-selecionada');

            if (secaoPadrao) {
                secaoPadrao.classList.remove('oculto');
                secaoPadrao.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            if (secaoMl) secaoMl.classList.add('oculto');

            if (dispararToast) {
                exibirToast('Opção selecionada: Relatório de viagem', 'info');
            }
            calcularIndicadoresViagem();
        } else if (tipo === 'ml') {
            if (btnOpcaoMl) btnOpcaoMl.classList.add('opcao-selecionada');
            if (btnOpcaoPadrao) btnOpcaoPadrao.classList.remove('opcao-selecionada');

            if (secaoMl) {
                secaoMl.classList.remove('oculto');
                secaoMl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            if (secaoPadrao) secaoPadrao.classList.add('oculto');

            if (dispararToast) {
                exibirToast('Opção selecionada: Relatório de viagem - ML', 'info');
            }
            if (typeof calcularTotaisFreteMl === 'function') {
                calcularTotaisFreteMl();
            }
            if (typeof calcularIndicadoresViagemMl === 'function') {
                calcularIndicadoresViagemMl();
            }
        }

        localStorage.setItem(STORAGE_TIPO_KEY, tipo);
    }

    if (btnOpcaoPadrao) {
        btnOpcaoPadrao.addEventListener('click', () => selecionarTipoRelatorio('padrao', true));
    }

    if (btnOpcaoMl) {
        btnOpcaoMl.addEventListener('click', () => selecionarTipoRelatorio('ml', true));
    }

    // ------------------------------------------
    // 12. Salvar e Carregar Dados em Andamento (LocalStorage)
    // ------------------------------------------
    const STORAGE_KEY = 'ajborges_relatorio_viagem_rascunho';

    function salvarProgressoAutomatico() {
        const abastecimentos = [];
        for (let i = 1; i <= 10; i++) {
            const posto = document.querySelector(`input[name="posto_${i}"]`);
            const nf = document.querySelector(`input[name="nf_${i}"]`);
            const km = document.querySelector(`input[name="km_${i}"]`);
            const valor = document.querySelector(`input[name="valor_${i}"]`);
            const litros = document.querySelector(`input[name="litros_${i}"]`);

            abastecimentos.push({
                posto: posto ? posto.value : '',
                nf: nf ? nf.value : '',
                km: km ? km.value : '',
                valor: valor ? valor.value : '',
                litros: litros ? litros.value : ''
            });
        }

        const pedagios = [
            document.getElementById('pedagio-1') ? document.getElementById('pedagio-1').value : '',
            document.getElementById('pedagio-2') ? document.getElementById('pedagio-2').value : '',
            document.getElementById('pedagio-3') ? document.getElementById('pedagio-3').value : ''
        ];

        const outrasDespesas = [
            {
                desc: 'Imposto Federal',
                valor: document.getElementById('despesa-valor-1') ? document.getElementById('despesa-valor-1').value : ''
            },
            {
                desc: document.getElementById('despesa-desc-2') ? document.getElementById('despesa-desc-2').value : '',
                valor: document.getElementById('despesa-valor-2') ? document.getElementById('despesa-valor-2').value : ''
            },
            {
                desc: document.getElementById('despesa-desc-3') ? document.getElementById('despesa-desc-3').value : '',
                valor: document.getElementById('despesa-valor-3') ? document.getElementById('despesa-valor-3').value : ''
            }
        ];

        const dados = {
            motorista: inputMotorista ? inputMotorista.value : '',
            placas: inputPlacas ? inputPlacas.value : '',
            dataSaida: inputDataSaida ? inputDataSaida.value : '',
            dataChegada: inputDataChegada ? inputDataChegada.value : '',
            kmSaida: inputKmSaida ? inputKmSaida.value : '',
            kmChegada: inputKmChegada ? inputKmChegada.value : '',
            kmTotal: inputKmTotal ? inputKmTotal.value : '',
            destinoInicial: inputDestinoInicial ? inputDestinoInicial.value : '',
            destinoFinal: inputDestinoFinal ? inputDestinoFinal.value : '',
            valorAdiantamento: inputAdiantamento ? inputAdiantamento.value : '',
            freteOrigem: inputFreteOrigem ? inputFreteOrigem.value : '',
            retorno1: inputRetorno1 ? inputRetorno1.value : '',
            retorno2: inputRetorno2 ? inputRetorno2.value : '',
            retorno3: inputRetorno3 ? inputRetorno3.value : '',
            totalFrete: inputTotalFrete ? inputTotalFrete.value : '',
            vrComissao: inputVrComissao ? inputVrComissao.value : '',
            abastecimentos,
            pedagios,
            outrasDespesas,
            anexos: arquivosComprovantes
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    }

    function carregarProgresso() {
        try {
            const rascunhoSalvo = localStorage.getItem(STORAGE_KEY);
            if (rascunhoSalvo) {
                const dados = JSON.parse(rascunhoSalvo);
                if (dados) {
                    if (inputMotorista && dados.motorista) inputMotorista.value = dados.motorista;
                    if (inputPlacas && dados.placas) inputPlacas.value = dados.placas;
                    if (inputDataSaida && dados.dataSaida) inputDataSaida.value = dados.dataSaida;
                    if (inputDataChegada && dados.dataChegada) inputDataChegada.value = dados.dataChegada;
                    if (inputKmSaida && dados.kmSaida) inputKmSaida.value = dados.kmSaida;
                    if (inputKmChegada && dados.kmChegada) inputKmChegada.value = dados.kmChegada;
                    if (inputKmTotal && dados.kmTotal) inputKmTotal.value = dados.kmTotal;
                    if (inputDestinoInicial && dados.destinoInicial) inputDestinoInicial.value = dados.destinoInicial;
                    if (inputDestinoFinal && dados.destinoFinal) inputDestinoFinal.value = dados.destinoFinal;
                    if (inputAdiantamento && dados.valorAdiantamento) inputAdiantamento.value = dados.valorAdiantamento;

                    if (inputFreteOrigem && dados.freteOrigem) inputFreteOrigem.value = dados.freteOrigem;
                    if (inputRetorno1 && dados.retorno1) inputRetorno1.value = dados.retorno1;
                    if (inputRetorno2 && dados.retorno2) inputRetorno2.value = dados.retorno2;
                    if (inputRetorno3 && dados.retorno3) inputRetorno3.value = dados.retorno3;
                    if (inputTotalFrete && dados.totalFrete) inputTotalFrete.value = dados.totalFrete;
                    if (inputVrComissao && dados.vrComissao) inputVrComissao.value = dados.vrComissao;

                    // Restaurar abastecimentos
                    if (Array.isArray(dados.abastecimentos)) {
                        dados.abastecimentos.forEach((ab, idx) => {
                            const i = idx + 1;
                            const posto = document.querySelector(`input[name="posto_${i}"]`);
                            const nf = document.querySelector(`input[name="nf_${i}"]`);
                            const km = document.querySelector(`input[name="km_${i}"]`);
                            const valor = document.querySelector(`input[name="valor_${i}"]`);
                            const litros = document.querySelector(`input[name="litros_${i}"]`);

                            if (posto && ab.posto) posto.value = ab.posto;
                            if (nf && ab.nf) nf.value = ab.nf;
                            if (km && ab.km) km.value = ab.km;
                            if (valor && ab.valor) valor.value = ab.valor;
                            if (litros && ab.litros) litros.value = ab.litros;
                        });
                    }

                    // Restaurar pedágios
                    if (Array.isArray(dados.pedagios)) {
                        dados.pedagios.forEach((ped, idx) => {
                            const inputPed = document.getElementById(`pedagio-${idx + 1}`);
                            if (inputPed && ped) inputPed.value = ped;
                        });
                    }

                    // Restaurar outras despesas
                    if (Array.isArray(dados.outrasDespesas)) {
                        if (dados.outrasDespesas[0] && dados.outrasDespesas[0].valor) {
                            const val1 = document.getElementById('despesa-valor-1');
                            if (val1) val1.value = dados.outrasDespesas[0].valor;
                        }
                        if (dados.outrasDespesas[1]) {
                            const desc2 = document.getElementById('despesa-desc-2');
                            const val2 = document.getElementById('despesa-valor-2');
                            if (desc2 && dados.outrasDespesas[1].desc) desc2.value = dados.outrasDespesas[1].desc;
                            if (val2 && dados.outrasDespesas[1].valor) val2.value = dados.outrasDespesas[1].valor;
                        }
                        if (dados.outrasDespesas[2]) {
                            const desc3 = document.getElementById('despesa-desc-3');
                            const val3 = document.getElementById('despesa-valor-3');
                            if (desc3 && dados.outrasDespesas[2].desc) desc3.value = dados.outrasDespesas[2].desc;
                            if (val3 && dados.outrasDespesas[2].valor) val3.value = dados.outrasDespesas[2].valor;
                        }
                    }

                    // Restaurar anexos salvos
                    if (Array.isArray(dados.anexos)) {
                        arquivosComprovantes = dados.anexos;
                        renderizarListaAnexos();
                    }

                    calcularKmTotal();
                    calcularTotalFrete();
                    calcularIndicadoresViagem();
                }
            }

            // Restaurar tipo de relatório selecionado
            const tipoSalvo = localStorage.getItem(STORAGE_TIPO_KEY);
            if (tipoSalvo) {
                selecionarTipoRelatorio(tipoSalvo, false);
            }
        } catch (e) {
            console.error('Erro ao carregar dados salvos:', e);
        }
    }

    // Ouvir alterações em todos os campos do formulário para salvar automaticamente
    if (form) {
        form.addEventListener('change', salvarProgressoAutomatico);
        form.addEventListener('input', () => {
            calcularIndicadoresViagem();
        });
    }

    // ------------------------------------------
    // 13. Ações do Formulário (Salvar e Finalizar)
    // ------------------------------------------
    const btnSalvarRascunhoCompleto = document.getElementById('btn-salvar-rascunho-completo');
    if (btnSalvarRascunhoCompleto) {
        btnSalvarRascunhoCompleto.addEventListener('click', () => {
            salvarProgressoAutomatico();
            exibirToast('Rascunho do relatório salvo com sucesso!', 'sucesso');
        });
    }

    const btnFinalizarRelatorio = document.getElementById('btn-finalizar-relatorio');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validação dos campos essenciais
            const motoristaPreenchido = inputMotorista && inputMotorista.value.trim() !== '';
            const placasPreenchida = inputPlacas && inputPlacas.value.trim() !== '';
            const impostoFederalValor = document.getElementById('despesa-valor-1');
            const impostoPreenchido = impostoFederalValor && impostoFederalValor.value.trim() !== '';

            if (!motoristaPreenchido || !placasPreenchida) {
                exibirToast('Preencha os dados do motorista e placa para finalizar.', 'erro');
                if (!motoristaPreenchido && inputMotorista) inputMotorista.focus();
                else if (!placasPreenchida && inputPlacas) inputPlacas.focus();
                return;
            }

            if (!impostoPreenchido) {
                exibirToast('O valor do Imposto Federal é obrigatório.', 'erro');
                if (impostoFederalValor) impostoFederalValor.focus();
                return;
            }

            salvarProgressoAutomatico();
            exibirToast('Relatório de Viagem finalizado e emitido com sucesso!', 'sucesso');
        });
    }

    // ------------------------------------------
    // 14. Limpeza de Linhas e Seções (Lixeiras)
    // ------------------------------------------
    const btnLixeiraAbast = document.getElementById('btn-lixeira-abastecimento');
    const popoverLimparAbast = document.getElementById('popover-limpar-abast');
    const fecharPopoverAbast = document.getElementById('fechar-popover-abast');
    const btnLimparAbastPreenchidas = document.getElementById('btn-limpar-abast-preenchidas');
    const btnLimparAbastTodas = document.getElementById('btn-limpar-abast-todas');

    const btnLixeiraDespesas = document.getElementById('btn-lixeira-despesas');
    const popoverLimparDespesas = document.getElementById('popover-limpar-despesas');
    const fecharPopoverDespesas = document.getElementById('fechar-popover-despesas');
    const btnLimparApenasPedagios = document.getElementById('btn-limpar-apenas-pedagios');
    const btnLimparApenasOutrasDespesas = document.getElementById('btn-limpar-apenas-outras-despesas');
    const btnLimparTodasDespesasPedagios = document.getElementById('btn-limpar-todas-despesas-pedagios');

    // Abre/fecha popover de abastecimento
    if (btnLixeiraAbast && popoverLimparAbast) {
        btnLixeiraAbast.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverLimparDespesas) popoverLimparDespesas.classList.add('oculto');
            popoverLimparAbast.classList.toggle('oculto');
        });
    }

    if (fecharPopoverAbast && popoverLimparAbast) {
        fecharPopoverAbast.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverLimparAbast.classList.add('oculto');
        });
    }

    // Abre/fecha popover de despesas e pedágios
    if (btnLixeiraDespesas && popoverLimparDespesas) {
        btnLixeiraDespesas.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverLimparAbast) popoverLimparAbast.classList.add('oculto');
            popoverLimparDespesas.classList.toggle('oculto');
        });
    }

    if (fecharPopoverDespesas && popoverLimparDespesas) {
        fecharPopoverDespesas.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverLimparDespesas.classList.add('oculto');
        });
    }

    // Fechar popover ao clicar fora
    document.addEventListener('click', (e) => {
        if (popoverLimparAbast && !popoverLimparAbast.contains(e.target) && e.target !== btnLixeiraAbast && !btnLixeiraAbast.contains(e.target)) {
            popoverLimparAbast.classList.add('oculto');
        }
        if (popoverLimparDespesas && !popoverLimparDespesas.contains(e.target) && e.target !== btnLixeiraDespesas && !btnLixeiraDespesas.contains(e.target)) {
            popoverLimparDespesas.classList.add('oculto');
        }
    });

    // Ação: Limpar apenas linhas preenchidas de abastecimento
    if (btnLimparAbastPreenchidas) {
        btnLimparAbastPreenchidas.addEventListener('click', () => {
            let linhasLimpas = 0;
            for (let i = 1; i <= 10; i++) {
                const posto = document.querySelector(`input[name="posto_${i}"]`);
                const nf = document.querySelector(`input[name="nf_${i}"]`);
                const km = document.querySelector(`input[name="km_${i}"]`);
                const valor = document.querySelector(`input[name="valor_${i}"]`);
                const litros = document.querySelector(`input[name="litros_${i}"]`);

                const temDados = (posto && posto.value.trim() !== '') ||
                    (nf && nf.value.trim() !== '') ||
                    (km && km.value.trim() !== '') ||
                    (valor && valor.value.trim() !== '') ||
                    (litros && litros.value.trim() !== '');

                if (temDados) {
                    if (posto) posto.value = '';
                    if (nf) nf.value = '';
                    if (km) km.value = '';
                    if (valor) valor.value = '';
                    if (litros) litros.value = '';
                    linhasLimpas++;
                }
            }

            if (popoverLimparAbast) popoverLimparAbast.classList.add('oculto');
            calcularIndicadoresViagem();
            salvarProgressoAutomatico();

            if (linhasLimpas > 0) {
                exibirToast(`${linhasLimpas} linha(s) de abastecimento limpa(s)!`, 'sucesso');
            } else {
                exibirToast('Nenhuma linha preenchida para limpar.', 'info');
            }
        });
    }

    // Ação: Limpar todas as 10 linhas de abastecimento
    if (btnLimparAbastTodas) {
        btnLimparAbastTodas.addEventListener('click', () => {
            for (let i = 1; i <= 10; i++) {
                const posto = document.querySelector(`input[name="posto_${i}"]`);
                const nf = document.querySelector(`input[name="nf_${i}"]`);
                const km = document.querySelector(`input[name="km_${i}"]`);
                const valor = document.querySelector(`input[name="valor_${i}"]`);
                const litros = document.querySelector(`input[name="litros_${i}"]`);

                if (posto) posto.value = '';
                if (nf) nf.value = '';
                if (km) km.value = '';
                if (valor) valor.value = '';
                if (litros) litros.value = '';
            }

            if (popoverLimparAbast) popoverLimparAbast.classList.add('oculto');
            calcularIndicadoresViagem();
            salvarProgressoAutomatico();
            exibirToast('Todas as 10 linhas de abastecimento foram limpas!', 'sucesso');
        });
    }

    // Ação: Limpar apenas pedágios
    if (btnLimparApenasPedagios) {
        btnLimparApenasPedagios.addEventListener('click', () => {
            inputsPedagio.forEach(input => {
                if (input) input.value = '';
            });

            if (popoverLimparDespesas) popoverLimparDespesas.classList.add('oculto');
            calcularIndicadoresViagem();
            salvarProgressoAutomatico();
            exibirToast('Campos de pedágio limpos!', 'sucesso');
        });
    }

    // Ação: Limpar apenas outras despesas
    if (btnLimparApenasOutrasDespesas) {
        btnLimparApenasOutrasDespesas.addEventListener('click', () => {
            const val1 = document.getElementById('despesa-valor-1');
            const desc2 = document.getElementById('despesa-desc-2');
            const val2 = document.getElementById('despesa-valor-2');
            const desc3 = document.getElementById('despesa-desc-3');
            const val3 = document.getElementById('despesa-valor-3');

            if (val1) val1.value = '';
            if (desc2) desc2.value = '';
            if (val2) val2.value = '';
            if (desc3) desc3.value = '';
            if (val3) val3.value = '';

            if (popoverLimparDespesas) popoverLimparDespesas.classList.add('oculto');
            calcularIndicadoresViagem();
            salvarProgressoAutomatico();
            exibirToast('Campos de outras despesas limpos!', 'sucesso');
        });
    }

    // Ação: Limpar todas as despesas e pedágios
    if (btnLimparTodasDespesasPedagios) {
        btnLimparTodasDespesasPedagios.addEventListener('click', () => {
            inputsPedagio.forEach(input => {
                if (input) input.value = '';
            });

            const val1 = document.getElementById('despesa-valor-1');
            const desc2 = document.getElementById('despesa-desc-2');
            const val2 = document.getElementById('despesa-valor-2');
            const desc3 = document.getElementById('despesa-desc-3');
            const val3 = document.getElementById('despesa-valor-3');

            if (val1) val1.value = '';
            if (desc2) desc2.value = '';
            if (val2) val2.value = '';
            if (desc3) desc3.value = '';
            if (val3) val3.value = '';

            if (popoverLimparDespesas) popoverLimparDespesas.classList.add('oculto');
            calcularIndicadoresViagem();
            salvarProgressoAutomatico();
            exibirToast('Pedágios e outras despesas foram totalmente limpos!', 'sucesso');
        });
    }

    // ==========================================
    // 15. MÓDULO OPERACIONAL: RELATÓRIO DE VIAGEM - ML
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
        } else if (tipoOperacao === 'shopee') {
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

        // Sincronizar com o total geral de frete se o campo de topo não estiver preenchido com retornos avulsos
        if (somaFrete > 0 && inputTotalFrete) {
            const fretesTopo = parseMoeda(inputFreteOrigem ? inputFreteOrigem.value : '') +
                parseMoeda(inputRetorno1 ? inputRetorno1.value : '') +
                parseMoeda(inputRetorno2 ? inputRetorno2.value : '') +
                parseMoeda(inputRetorno3 ? inputRetorno3.value : '');
            if (fretesTopo === 0) {
                inputTotalFrete.value = formatarMoedaSemPrefixo(somaFrete);
            }
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

    // 15.3. Imposto Federal, Pedágio e Outras Despesas ML (Sem Arla)
    const inputMlImpFederal = document.getElementById('ml-imp-federal-valor');
    const inputMlImpAdic = document.getElementById('ml-imp-adic-valor');
    const inputMlPedagio1 = document.getElementById('ml-pedagio-valor-1');
    const inputMlPedagio2 = document.getElementById('ml-pedagio-valor-2');
    const inputMlPedagio3 = document.getElementById('ml-pedagio-valor-3');
    const inputTotalImpostoPedagio = document.getElementById('ml-total-imposto-pedagio');

    const inputsImpostoPedagioMl = [
        inputMlImpFederal,
        inputMlImpAdic,
        inputMlPedagio1,
        inputMlPedagio2,
        inputMlPedagio3
    ];

    inputsImpostoPedagioMl.forEach(input => {
        if (input) {
            aplicarMascaraMoeda(input, () => {
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }
    });

    // Outras Despesas ML
    const inputsValorOutrasMl = [];
    const inputTotalOutrasDespesas = document.getElementById('ml-total-outras-despesas');

    for (let i = 1; i <= 5; i++) {
        const descOutra = document.querySelector(`input[name="ml_outra_desc_${i}"]`);
        const valOutra = document.querySelector(`input[name="ml_outra_valor_${i}"]`);

        if (descOutra) {
            descOutra.addEventListener('input', salvarProgressoMl);
        }

        if (valOutra) {
            inputsValorOutrasMl.push(valOutra);
            aplicarMascaraMoeda(valOutra, () => {
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
                salvarProgressoMl();
            });
        }
    }

    function calcularTotaisDespesasMl() {
        // Total Imposto e Pedágio
        let totalImpPed = 0;
        inputsImpostoPedagioMl.forEach(input => {
            if (input) totalImpPed += parseMoeda(input.value);
        });
        if (inputTotalImpostoPedagio) {
            inputTotalImpostoPedagio.value = formatarMoedaSemPrefixo(totalImpPed);
        }

        // Total Outras Despesas
        let totalOutras = 0;
        inputsValorOutrasMl.forEach(input => {
            totalOutras += parseMoeda(input.value);
        });
        if (inputTotalOutrasDespesas) {
            inputTotalOutrasDespesas.value = formatarMoedaSemPrefixo(totalOutras);
        }

        return {
            impostoPedagio: totalImpPed,
            outras: totalOutras,
            totalGeralDespesas: totalImpPed + totalOutras
        };
    }

    // 15.4. Cards de Indicadores da Viagem ML
    const mlIndicadorMedia = document.getElementById('ml-indicador-media-combustivel');
    const mlCalcBaseKm = document.getElementById('ml-calc-base-km');
    const mlCalcBaseLitros = document.getElementById('ml-calc-base-litros');
    const mlIndicadorDespesa = document.getElementById('ml-indicador-despesa-total');
    const mlIndicadorResultado = document.getElementById('ml-indicador-resultado-viagem');
    const mlIndicadorSaldoComissao = document.getElementById('ml-indicador-saldo-comissao');

    function calcularIndicadoresViagemMl() {
        const kmTotalNum = parseMilhar(inputKmTotal ? inputKmTotal.value : 0);
        const totaisCombustivel = calcularTotaisAbastecimentoMl();
        const totaisDespesas = calcularTotaisDespesasMl();
        const totalFreteRelacao = calcularTotaisFreteMl();

        // 1. Média de Combustível ML
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

        // 2. Despesa Total ML = Combustível + Impostos/Pedágios + Outras Despesas + Vr Comissão
        const vrComissaoNum = parseMoeda(inputVrComissao ? inputVrComissao.value : '');

        const despesaTotalCalculada = totaisCombustivel.valor +
            totaisDespesas.totalGeralDespesas +
            vrComissaoNum;

        if (mlIndicadorDespesa) {
            mlIndicadorDespesa.textContent = formatarMoeda(despesaTotalCalculada);
        }

        // 3. Resultado da Viagem ML = Total Frete - Despesa Total
        let totalFreteFinal = parseMoeda(inputTotalFrete ? inputTotalFrete.value : '');
        if (totalFreteFinal === 0 && totalFreteRelacao > 0) {
            totalFreteFinal = totalFreteRelacao;
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
    const btnLimparDespesasMlPreenchidas = document.getElementById('btn-limpar-despesas-ml-preenchidas');
    const btnLimparDespesasMlTodas = document.getElementById('btn-limpar-despesas-ml-todas');

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

    // Ações de Limpeza de Despesas ML (Sem Arla)
    if (btnLimparDespesasMlPreenchidas) {
        btnLimparDespesasMlPreenchidas.addEventListener('click', () => {
            inputsImpostoPedagioMl.forEach(input => {
                if (input) input.value = '';
            });
            for (let i = 1; i <= 5; i++) {
                const desc = document.querySelector(`input[name="ml_outra_desc_${i}"]`);
                const vl = document.querySelector(`input[name="ml_outra_valor_${i}"]`);
                if (desc) desc.value = '';
                if (vl) vl.value = '';
            }

            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            calcularTotaisDespesasMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Despesas preenchidas foram limpas!', 'sucesso');
        });
    }

    if (btnLimparDespesasMlTodas) {
        btnLimparDespesasMlTodas.addEventListener('click', () => {
            inputsImpostoPedagioMl.forEach(input => {
                if (input) input.value = '';
            });
            for (let i = 1; i <= 5; i++) {
                const desc = document.querySelector(`input[name="ml_outra_desc_${i}"]`);
                const vl = document.querySelector(`input[name="ml_outra_valor_${i}"]`);
                if (desc) desc.value = '';
                if (vl) vl.value = '';
            }

            if (popoverLimparDespesasMl) popoverLimparDespesasMl.classList.add('oculto');
            calcularTotaisDespesasMl();
            calcularIndicadoresViagemMl();
            salvarProgressoMl();
            exibirToast('Todas as despesas operacionais ML foram redefinidas!', 'sucesso');
        });
    }

    // 15.8. Persistência de Dados ML (Salvar e Restaurar Rascunho)
    function salvarProgressoMl() {
        try {
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

            const outrasDespesasMl = [];
            for (let i = 1; i <= 5; i++) {
                outrasDespesasMl.push({
                    desc: document.querySelector(`input[name="ml_outra_desc_${i}"]`)?.value || '',
                    valor: document.querySelector(`input[name="ml_outra_valor_${i}"]`)?.value || ''
                });
            }

            const dadosMl = {
                fretes: fretesMl,
                abastecimentos: abastecimentosMl,
                impFederal: inputMlImpFederal?.value || '',
                impAdic: inputMlImpAdic?.value || '',
                pedagio1: inputMlPedagio1?.value || '',
                pedagio2: inputMlPedagio2?.value || '',
                pedagio3: inputMlPedagio3?.value || '',
                outrasDespesas: outrasDespesasMl,
                anexos: arquivosComprovantesMl
            };

            localStorage.setItem(STORAGE_ML_KEY, JSON.stringify(dadosMl));
        } catch (e) {
            console.error('Erro ao salvar progresso ML:', e);
        }
    }

    function carregarProgressoMl() {
        try {
            const salvo = localStorage.getItem(STORAGE_ML_KEY);
            if (salvo) {
                const dados = JSON.parse(salvo);

                // Restaurar fretes
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

                        if (f.cliente === 'mercado_livre') {
                            if (vl) {
                                vl.value = f.valor || '400,00';
                                vl.setAttribute('readonly', 'readonly');
                            }
                            if (com) {
                                com.value = f.comissao || '400,00';
                            }
                        } else if (f.cliente === 'shopee') {
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
                if (Array.isArray(dados.abastecimentos)) {
                    dados.abastecimentos.forEach((ab, idx) => {
                        const i = idx + 1;
                        const posto = document.querySelector(`input[name="posto_ml_${i}"]`);
                        const nf = document.querySelector(`input[name="nf_ml_${i}"]`);
                        const km = document.querySelector(`input[name="km_ml_${i}"]`);
                        const valor = document.querySelector(`input[name="valor_ml_${i}"]`);
                        const litros = document.querySelector(`input[name="litros_ml_${i}"]`);

                        if (posto && ab.posto) posto.value = ab.posto;
                        if (nf && ab.nf) nf.value = ab.nf;
                        if (km && ab.km) km.value = ab.km;
                        if (valor && ab.valor) valor.value = ab.valor;
                        if (litros && ab.litros) litros.value = ab.litros;
                    });
                }

                // Restaurar Impostos e Pedágios
                if (inputMlImpFederal && dados.impFederal) inputMlImpFederal.value = dados.impFederal;
                if (inputMlImpAdic && dados.impAdic) inputMlImpAdic.value = dados.impAdic;
                if (inputMlPedagio1 && dados.pedagio1) inputMlPedagio1.value = dados.pedagio1;
                if (inputMlPedagio2 && dados.pedagio2) inputMlPedagio2.value = dados.pedagio2;
                if (inputMlPedagio3 && dados.pedagio3) inputMlPedagio3.value = dados.pedagio3;

                // Restaurar Outras Despesas
                if (Array.isArray(dados.outrasDespesas)) {
                    dados.outrasDespesas.forEach((od, idx) => {
                        const i = idx + 1;
                        const desc = document.querySelector(`input[name="ml_outra_desc_${i}"]`);
                        const vl = document.querySelector(`input[name="ml_outra_valor_${i}"]`);
                        if (desc && od.desc) desc.value = od.desc;
                        if (vl && od.valor) vl.value = od.valor;
                    });
                }

                // Restaurar Anexos
                if (Array.isArray(dados.anexos)) {
                    arquivosComprovantesMl = dados.anexos;
                    renderizarListaAnexosMl();
                }

                calcularTotaisFreteMl();
                calcularTotaisAbastecimentoMl();
                calcularTotaisDespesasMl();
                calcularIndicadoresViagemMl();
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho ML:', e);
        }
    }

    // Botões de ação ML
    const btnSalvarRascunhoMl = document.getElementById('btn-salvar-rascunho-ml');
    if (btnSalvarRascunhoMl) {
        btnSalvarRascunhoMl.addEventListener('click', () => {
            salvarProgressoMl();
            salvarProgressoAutomatico();
            exibirToast('Rascunho do Relatório de viagem - ML salvo com sucesso!', 'sucesso');
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
                exibirToast('O valor do Imposto Federal é obrigatório no Relatório ML.', 'erro');
                if (inputMlImpFederal) inputMlImpFederal.focus();
                return;
            }

            salvarProgressoMl();
            salvarProgressoAutomatico();
            exibirToast('Relatório de Viagem - ML finalizado e emitido com sucesso!', 'sucesso');
        });
    }

    carregarProgresso();
    carregarProgressoMl();
});
