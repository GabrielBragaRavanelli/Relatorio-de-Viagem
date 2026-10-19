document.addEventListener('DOMContentLoaded', () => {
    const cardPJ = document.getElementById('card-pj');
    const cardPF = document.getElementById('card-pf');
    const formPJ = document.getElementById('form-pj');
    const formPF = document.getElementById('form-pf');

    function selectType(type) {
        if (type === 'pj') {
            cardPJ.classList.add('active');
            cardPF.classList.remove('active');
            formPJ.classList.remove('hidden');
            formPF.classList.add('hidden');
            formPJ.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (type === 'pf') {
            cardPF.classList.add('active');
            cardPJ.classList.remove('active');
            formPF.classList.remove('hidden');
            formPJ.classList.add('hidden');
            formPF.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    cardPJ.addEventListener('click', () => selectType('pj'));
    cardPF.addEventListener('click', () => selectType('pf'));

    cardPJ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectType('pj');
        }
    });

    cardPF.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectType('pf');
        }
    });

    function applyMask(input, maskFn) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            const cursorPosition = input.selectionStart;
            const prevLength = input.value.length;
            input.value = maskFn(input.value);
            const newLength = input.value.length;
            if (cursorPosition !== null && prevLength !== newLength) {
                const diff = newLength - prevLength;
                input.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
            }
        });
    }

    function maskCNPJ(value) {
        return value
            .replace(/\D/g, '')
            .slice(0, 14)
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }

    function maskCPF(value) {
        return value
            .replace(/\D/g, '')
            .slice(0, 11)
            .replace(/^(\d{3})(\d)/, '$1.$2')
            .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1-$2');
    }

    function maskPhone(value) {
        const clean = value.replace(/\D/g, '').slice(0, 11);
        if (clean.length <= 10) {
            return clean
                .replace(/^(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
        return clean
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2');
    }

    function maskCEP(value) {
        return value
            .replace(/\D/g, '')
            .slice(0, 8)
            .replace(/^(\d{5})(\d)/, '$1-$2');
    }

    function maskCpfCnpj(value) {
        const clean = value.replace(/\D/g, '');
        if (clean.length <= 11) {
            return maskCPF(clean);
        }
        return maskCNPJ(clean);
    }


    function maskPlaca(value) {
        return value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 7)
            .replace(/^([A-Z]{3})([0-9]{4})$/, '$1-$2');
    }

    function soDigitos(max) {
        return (value) => value.replace(/\D/g, '').slice(0, max);
    }

    function maskChassi(value) {
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
    }

    function bloquearNumeros(input) {
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
            }
        });
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[0-9]/g, '');
        });
    }

    ['pj', 'pf'].forEach((p) => {
        applyMask(document.getElementById(`${p}-cpf`), maskCPF);
        applyMask(document.getElementById(`${p}-celular`), maskPhone);
        applyMask(document.getElementById(`${p}-mot-cep`), maskCEP);
        applyMask(document.getElementById(`${p}-rntrc`), soDigitos(12));
        ['motorista-nome', 'motorista-sobrenome', 'mae'].forEach((s) => bloquearNumeros(document.getElementById(`${p}-${s}`)));
    });
    applyMask(document.getElementById('pj-cnpj'), maskCNPJ);
    applyMask(document.getElementById('pj-telefone-empresa'), maskPhone);
    bloquearNumeros(document.getElementById('pj-responsavel'));

    // Mesma checagem para "Choose Files" e para arrastar e soltar
    function conferirArquivos(files) {
        const lista = Array.from(files || []);
        if (lista.length > MAX_ARQUIVOS) return `Envie no máximo ${MAX_ARQUIVOS} arquivos por documento.`;
        for (const f of lista) {
            if (!TIPOS_ARQUIVO.includes(f.type)) return `O arquivo "${f.name}" não é PDF, JPG ou PNG.`;
            if (f.size > TAMANHO_MAX) return `O arquivo "${f.name}" passa de 10 MB.`;
        }
        return null;
    }

    // Busca o input e a prévia dentro da própria zona: funciona também com
    // cartões criados pelo JS que ainda não entraram na página (CRLVs).
    function ligarDropzone(zone) {
        if (!zone || zone.dataset.ligada === '1') return;
        const input = zone.querySelector('input[type="file"]');
        const previewList = zone.querySelector('.file-preview-list');

        if (!input) return;
        zone.dataset.ligada = '1';

        zone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                input.click();
            }
        });

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const arquivos = e.dataTransfer && e.dataTransfer.files;
            if (!arquivos || arquivos.length === 0) return;
            const problema = conferirArquivos(arquivos);
            if (problema) return alert(problema);
            input.files = arquivos;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        input.addEventListener('change', () => {
            const problema = conferirArquivos(input.files);
            if (problema) {
                alert(problema);
                input.value = '';
            }
            renderFileList(input, previewList);
        });
    }

    document.querySelectorAll('.upload-dropzone').forEach((zone) => ligarDropzone(zone));

    // Arquivo solto fora de uma zona não abre no navegador
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    function renderFileList(input, container) {
        if (!container) return;
        container.innerHTML = '';
        Array.from(input.files || []).forEach((file, i) => {
            const item = document.createElement('span');
            item.className = 'file-preview-item';
            const sizeKb = (file.size / 1024).toFixed(0);
            item.textContent = `${file.name} (${sizeKb} KB)`;
            const remover = document.createElement('button');
            remover.type = 'button';
            remover.className = 'file-preview-remover';
            remover.setAttribute('aria-label', `Remover ${file.name}`);
            remover.textContent = '×';
            remover.addEventListener('click', (e) => {
                e.stopPropagation(); // não abre o seletor de arquivos da zona
                const restantes = new DataTransfer();
                Array.from(input.files).forEach((f, j) => { if (j !== i) restantes.items.add(f); });
                input.files = restantes.files;
                renderFileList(input, container);
            });
            item.appendChild(remover);
            container.appendChild(item);
        });
    }

    // =========================================================================
    // CADASTRO NO SUPABASE (edge function "solicitar-cadastro")
    //
    // Para cada documento (CNH, um CRLV por veículo da tipologia, RNTRC e
    // comprovante de residência) o motorista ANEXA o arquivo ou marca "Não tenho o PDF" e
    // PREENCHE o formulário daquele documento. A conta nasce PENDENTE: o login
    // só funciona depois que a gestão aprovar.
    // =========================================================================

    // Tipo de veículo -> veículos (um CRLV por veículo, na ordem; o mesmo da edge function)
    const TIPOLOGIAS = {
        'VUC/¾': ['Caminhão'],
        'Toco (4×2)': ['Caminhão'],
        'Truck (6×2)': ['Caminhão'],
        'Bitruck (8×2)': ['Caminhão'],
        'Cavalo 4×2': ['Cavalo'],
        'Cavalo 6×2': ['Cavalo'],
        'Cavalo 6×4': ['Cavalo'],
        'Carreta simples (2e)': ['Cavalo', 'Carreta'],
        'Carreta LS 3e': ['Cavalo', 'Carreta'],
        'Romeu e Julieta': ['Caminhão', 'Reboque'],
        'Bitrem': ['Cavalo', '1ª carreta', '2ª carreta'],
        'Rodotrem': ['Cavalo', '1ª carreta', '2ª carreta'],
        'Treminhão/Tritrem': ['Caminhão', '1º reboque', '2º reboque', '3º reboque']
    };
    const CAMPOS_ACESSO = ['motorista-nome', 'motorista-sobrenome', 'cpf', 'celular'];
    const CAMPOS_EMPRESA = ['nome-empresa', 'cnpj', 'telefone-empresa', 'responsavel'];
    const CAMPOS_CNH = ['nascimento', 'rg', 'rg-uf', 'uf-nasc', 'cidade-nasc', 'mae', 'cnh-registro', 'cnh-emissao',
        'cnh-primeira', 'cnh-uf', 'cnh-validade', 'cnh-categoria', 'cnh-seguranca'];
    const CAMPOS_RNTRC = ['rntrc', 'val-rntrc'];
    const CAMPOS_RESIDENCIA = ['mot-endereco', 'mot-cidade', 'mot-estado', 'mot-cep'];
    const UFS = ['Acre (AC)', 'Alagoas (AL)', 'Amapá (AP)', 'Amazonas (AM)', 'Bahia (BA)', 'Ceará (CE)',
        'Distrito Federal (DF)', 'Espírito Santo (ES)', 'Goiás (GO)', 'Maranhão (MA)', 'Mato Grosso (MT)',
        'Mato Grosso do Sul (MS)', 'Minas Gerais (MG)', 'Pará (PA)', 'Paraíba (PB)', 'Paraná (PR)',
        'Pernambuco (PE)', 'Piauí (PI)', 'Rio de Janeiro (RJ)', 'Rio Grande do Norte (RN)',
        'Rio Grande do Sul (RS)', 'Rondônia (RO)', 'Roraima (RR)', 'Santa Catarina (SC)', 'São Paulo (SP)',
        'Sergipe (SE)', 'Tocantins (TO)'];
    const MAX_ARQUIVOS = 3;
    const TIPOS_ARQUIVO = ['application/pdf', 'image/png', 'image/jpeg'];
    const TAMANHO_MAX = 10 * 1024 * 1024;
    // Data da "Última atualização" da Política de Privacidade (HTML/politica-privacidade.html)
    const VERSAO_POLITICA = '2026-10-19';

    // "CRLV do Cavalo", "CRLV da 1ª carreta"
    const nomeCrlv = (papel) => `CRLV ${/carreta$/i.test(papel) ? 'da' : 'do'} ${papel}`;
    const camposCrlv = (n) => ['placa', 'renavam', 'chassi', 'marca', 'modelo', 'ano', 'cor', 'cidade-emp', 'uf',
        'prop-nome', 'prop-doc'].map((s) => `crlv${n}-${s}`);

    function esc(v) {
        return String(v ?? '').replace(/[&<>"'`]/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
        }[c]));
    }

    function campo(prefixo, sufixo) {
        return document.getElementById(`${prefixo}-${sufixo}`);
    }

    function papeisDe(prefixo) {
        return TIPOLOGIAS[campo(prefixo, 'tipologia')?.value] || [];
    }

    // Documentos do envio, na ordem da tela: [{ doc, titulo, obrigatorio, campos }]
    function documentosDe(prefixo) {
        return [
            { doc: 'cnh', titulo: 'CNH', obrigatorio: true, campos: CAMPOS_CNH },
            ...papeisDe(prefixo).map((papel, i) => ({
                doc: `crlv_${i + 1}`, titulo: nomeCrlv(papel), obrigatorio: true, campos: camposCrlv(i + 1)
            })),
            { doc: 'rntrc', titulo: 'RNTRC', obrigatorio: true, campos: CAMPOS_RNTRC },
            { doc: 'residencia', titulo: 'Comprovante de residência', obrigatorio: false, campos: CAMPOS_RESIDENCIA }
        ];
    }

    const cartaoDe = (prefixo, doc) => campo(prefixo, 'docs')?.querySelector(`.cartao-doc[data-doc="${doc}"]`);
    const semPdf = (prefixo, doc) => !!campo(prefixo, `sem-pdf-${doc}`)?.checked;
    const anexoDe = (prefixo, doc) => campo(prefixo, `anexo-${doc.replace('_', '-')}`);
    const arquivosDe = (prefixo, doc) => {
        const el = anexoDe(prefixo, doc);
        return el && el.files ? Array.from(el.files) : [];
    };

    // ---------- Estado -> Cidade (municípios da API do IBGE) ----------
    // A cidade é um campo de texto com <datalist> dos municípios do estado.
    // Se a API falhar, vira texto livre: o cadastro nunca trava por causa dela.
    const URL_MUNICIPIOS = (sigla) =>
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`;
    const municipiosPorUf = {}; // cache em memória: sigla -> nomes oficiais
    const buscasMunicipios = {}; // sigla -> busca em andamento
    const AVISO_SEM_LISTA = 'Não foi possível carregar a lista de cidades; digite o nome da cidade.';

    const opcoesUf = () => '<option value="">--- Selecione a escolha ---</option>' +
        UFS.map((uf) => `<option value="${esc(uf)}">${esc(uf)}</option>`).join('');
    const siglaDe = (uf) => (/\(([A-Z]{2})\)$/.exec(uf || '') || [])[1] || '';
    const semAcento = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/’/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    // Funciona também nos cartões de CRLV que ainda não entraram na página
    const cidadeDe = (select) => select.closest('.cartao-doc-form').querySelector(`#${select.dataset.cidade}`);

    function buscarMunicipios(sigla) {
        if (!buscasMunicipios[sigla]) {
            const controle = new AbortController();
            const prazo = setTimeout(() => controle.abort(), 10000);
            buscasMunicipios[sigla] = fetch(URL_MUNICIPIOS(sigla), { signal: controle.signal })
                .then((r) => {
                    if (!r.ok) throw new Error(`IBGE respondeu ${r.status}`);
                    return r.json();
                })
                .then((lista) => {
                    const nomes = Array.isArray(lista) ? lista.map((m) => m && m.nome).filter(Boolean) : [];
                    if (nomes.length === 0) throw new Error('IBGE devolveu lista vazia');
                    return nomes;
                })
                .finally(() => {
                    clearTimeout(prazo);
                    delete buscasMunicipios[sigla];
                });
        }
        return buscasMunicipios[sigla];
    }

    // Habilita a cidade só com estado escolhido (e lista já buscada)
    function sincronizarCidade(select) {
        const cidade = cidadeDe(select);
        if (!cidade) return;
        if (!select.value) {
            cidade.value = '';
            cidade.dataset.lista = '';
            cidade.parentElement.querySelector('datalist').innerHTML = '';
            cidade.parentElement.querySelector('.aviso-cidade').hidden = true;
        }
        const carregando = cidade.dataset.lista === 'carregando';
        cidade.disabled = select.disabled || !select.value || carregando;
        cidade.placeholder = !select.value ? 'Escolha o estado primeiro'
            : carregando ? 'Carregando cidades…'
            : cidade.dataset.lista === 'ok' ? 'Digite e escolha da lista' : 'Digite o nome da cidade';
    }

    async function carregarCidades(select) {
        const cidade = cidadeDe(select);
        const lista = cidade.parentElement.querySelector('datalist');
        const aviso = cidade.parentElement.querySelector('.aviso-cidade');
        const sigla = siglaDe(select.value);
        cidade.value = '';
        cidade.setCustomValidity('');
        lista.innerHTML = '';
        aviso.hidden = true;
        cidade.dataset.lista = '';
        if (sigla && !municipiosPorUf[sigla]) {
            cidade.dataset.lista = 'carregando';
            sincronizarCidade(select);
            try {
                municipiosPorUf[sigla] = await buscarMunicipios(sigla);
            } catch (err) {
                console.warn(`Municípios de ${sigla} indisponíveis:`, err);
            }
            if (siglaDe(select.value) !== sigla) return; // estado trocado durante a busca
        }
        const nomes = municipiosPorUf[sigla];
        if (sigla && nomes) {
            lista.innerHTML = nomes.map((n) => `<option value="${esc(n)}"></option>`).join('');
            cidade.dataset.lista = 'ok';
        } else if (sigla) {
            cidade.dataset.lista = 'falhou';
            aviso.textContent = AVISO_SEM_LISTA;
            aviso.hidden = false;
        }
        sincronizarCidade(select);
    }

    function ligarEstadoCidade(select) {
        if (!select || select.dataset.ligado === '1') return;
        select.dataset.ligado = '1';
        if (select.options.length === 0) select.innerHTML = opcoesUf();
        const cidade = cidadeDe(select);
        const lista = document.createElement('datalist');
        lista.id = `${cidade.id}-lista`;
        const aviso = document.createElement('small');
        aviso.className = 'aviso-cidade';
        aviso.hidden = true;
        cidade.setAttribute('list', lista.id);
        cidade.autocomplete = 'off';
        cidade.after(lista, aviso);
        cidade.addEventListener('input', () => cidade.setCustomValidity(''));
        cidade.addEventListener('change', () => conferirCidade(select));
        select.addEventListener('change', () => carregarCidades(select));
        sincronizarCidade(select);
    }

    // Com a lista carregada, a cidade tem que ser um município do estado
    // (sem diferenciar acentos/maiúsculas) e fica com o nome oficial do IBGE.
    function conferirCidade(select) {
        const cidade = cidadeDe(select);
        if (!cidade) return;
        cidade.setCustomValidity('');
        if (cidade.disabled || cidade.dataset.lista !== 'ok' || !cidade.value.trim()) return;
        const alvo = semAcento(cidade.value);
        const oficial = (municipiosPorUf[siglaDe(select.value)] || []).find((n) => semAcento(n) === alvo);
        if (oficial) cidade.value = oficial;
        else cidade.setCustomValidity('Escolha uma cidade da lista.');
    }

    function validarCidades(form) {
        const selects = Array.from(form.querySelectorAll('select[data-cidade]'));
        selects.forEach(conferirCidade);
        const carregando = selects.some((s) => !s.disabled && cidadeDe(s)?.dataset.lista === 'carregando');
        return carregando ? 'Aguarde: a lista de cidades ainda está carregando.' : null;
    }

    // ---------- Cartões de CRLV (um por veículo da tipologia) ----------
    function criarCartaoCrlv(prefixo, n, papel) {
        const id = (s) => `${prefixo}-crlv${n}-${s}`;
        const anexo = `${prefixo}-anexo-crlv-${n}`;
        const ast = '<span class="required-asterisk">*</span>';
        const texto = (s, rotulo, extra = '') => `
            <div class="form-group">
                <label for="${id(s)}">${rotulo}: ${ast}</label>
                <input type="text" id="${id(s)}" ${extra}>
            </div>`;
        const cartao = document.createElement('div');
        cartao.className = 'cartao-doc';
        cartao.dataset.doc = `crlv_${n}`;
        cartao.dataset.papel = papel;
        cartao.innerHTML = `
            <div class="cartao-doc-topo">
                <h4 class="cartao-doc-titulo">${esc(nomeCrlv(papel))}</h4>
                <span class="etiqueta-doc etiqueta-obrigatorio">Obrigatório</span>
            </div>
            <div class="cartao-doc-anexo">
                <div class="upload-dropzone" data-target="${anexo}">
                    <div class="upload-inner-card">
                        <svg class="upload-icon" viewBox="0 0 24 24" width="28" height="28" fill="none"
                            stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span class="upload-text">Drag & Drop Files, <label for="${anexo}"
                                class="upload-action-link">Choose Files to Upload</label></span>
                        <span class="upload-subtext">PDF, PNG ou JPG, até 10 MB. Você pode enviar até 3 arquivos.</span>
                        <input type="file" id="${anexo}" class="file-input-hidden" multiple accept=".pdf,.jpg,.jpeg,.png">
                    </div>
                    <div class="file-preview-list" id="preview-${anexo}"></div>
                </div>
            </div>
            <label class="caixa-sem-pdf">
                <input type="checkbox" id="${prefixo}-sem-pdf-crlv_${n}" data-doc="crlv_${n}">
                <span class="caixa-sem-pdf-quadrado" aria-hidden="true"></span>
                <span class="caixa-sem-pdf-texto">Não tenho o PDF do ${esc(nomeCrlv(papel))}</span>
            </label>
            <div class="cartao-doc-form" hidden>
                <div class="form-row col-3">
                    ${texto('placa', 'Placa', 'placeholder="ABC-1234 ou ABC1D23"')}
                    ${texto('renavam', 'RENAVAM')}
                    ${texto('chassi', 'Chassi')}
                </div>
                <div class="form-row col-4">
                    ${texto('marca', 'Marca')}
                    ${texto('modelo', 'Modelo')}
                    ${texto('ano', 'Ano', 'placeholder="AAAA"')}
                    ${texto('cor', 'Cor')}
                </div>
                <div class="form-row col-2">
                    <div class="form-group">
                        <label for="${id('uf')}">Estado: ${ast}</label>
                        <select id="${id('uf')}" data-cidade="${id('cidade-emp')}">${opcoesUf()}</select>
                    </div>
                    ${texto('cidade-emp', 'Cidade de Emplacamento')}
                </div>
                <div class="form-row col-2">
                    ${texto('prop-nome', 'Nome do Proprietário (como no CRLV)')}
                    ${texto('prop-doc', 'CPF/CNPJ do Proprietário')}
                </div>
            </div>`;
        const el = (s) => cartao.querySelector(`#${id(s)}`);
        applyMask(el('placa'), maskPlaca);
        applyMask(el('renavam'), soDigitos(11));
        applyMask(el('ano'), soDigitos(4));
        applyMask(el('chassi'), maskChassi);
        applyMask(el('prop-doc'), maskCpfCnpj);
        ligarEstadoCidade(el('uf'));
        ligarDropzone(cartao.querySelector('.upload-dropzone'));
        return cartao;
    }

    function cartaoPreenchido(cartao) {
        if (!cartao) return false;
        const arquivo = cartao.querySelector('input[type="file"]');
        if (arquivo && arquivo.files && arquivo.files.length > 0) return true;
        return Array.from(cartao.querySelectorAll('.cartao-doc-form input, .cartao-doc-form select'))
            .some((el) => el.value.trim() !== '');
    }

    // Recria os cartões de CRLV para a tipologia escolhida. Os cartões que
    // continuam iguais (mesma posição e mesmo veículo) são mantidos.
    // Devolve false se o motorista desistir da troca.
    function montarCrlvs(prefixo) {
        const lista = campo(prefixo, 'crlvs');
        if (!lista) return true;
        const papeis = papeisDe(prefixo);
        const atuais = Array.from(lista.querySelectorAll('.cartao-doc'));
        const sairao = atuais.filter((c, i) => c.dataset.papel !== papeis[i]);
        if (sairao.some(cartaoPreenchido)) {
            const nomes = sairao.filter(cartaoPreenchido).map((c) => nomeCrlv(c.dataset.papel)).join(', ');
            if (!confirm(`Trocar o tipo de veículo apaga o que você já informou em: ${nomes}. Deseja continuar?`)) return false;
        }
        sairao.forEach((c) => c.remove());
        papeis.forEach((papel, i) => {
            const existente = lista.querySelector(`.cartao-doc[data-doc="crlv_${i + 1}"]`);
            if (existente) return;
            const novo = criarCartaoCrlv(prefixo, i + 1, papel);
            const proximo = Array.from(lista.children).find((c) => Number(c.dataset.doc.slice(5)) > i + 1);
            lista.insertBefore(novo, proximo || null);
        });
        return true;
    }

    // ---------- Caixinhas "Não tenho o PDF" ----------
    function aplicarCaixas(prefixo) {
        const temTipologia = papeisDe(prefixo).length > 0;
        const aviso = campo(prefixo, 'aviso-tipologia');
        const listaDocs = campo(prefixo, 'docs');
        if (aviso) aviso.hidden = temTipologia;
        if (listaDocs) listaDocs.hidden = !temTipologia;

        documentosDe(prefixo).forEach(({ doc, obrigatorio }) => {
            const cartao = cartaoDe(prefixo, doc);
            if (!cartao) return;
            const marcado = semPdf(prefixo, doc);
            const ativo = temTipologia;
            cartao.classList.toggle('sem-pdf', marcado);

            // Anexo: some e é limpo quando a caixa é marcada
            const anexo = cartao.querySelector('.cartao-doc-anexo');
            const arquivo = anexoDe(prefixo, doc);
            anexo.hidden = marcado;
            if (marcado && arquivo && arquivo.value) {
                arquivo.value = '';
                const previa = document.getElementById(`preview-${arquivo.id}`);
                if (previa) previa.innerHTML = '';
            }

            // Formulário do documento: só com a caixa marcada; escondido fica limpo e desativado
            const form = cartao.querySelector('.cartao-doc-form');
            form.hidden = !marcado;
            form.querySelectorAll('input, select').forEach((el) => {
                if (!marcado) el.value = '';
                el.disabled = !marcado || !ativo;
                el.required = marcado && ativo && obrigatorio;
            });
            form.querySelectorAll('select[data-cidade]').forEach(sincronizarCidade);
        });
    }

    function montarModais() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="modal-cadastro" id="modal-revisar-cadastro" role="dialog" aria-modal="true" aria-labelledby="titulo-revisar">
                <div class="modal-cadastro-caixa">
                    <h3 id="titulo-revisar">Revise antes de enviar</h3>
                    <p>Confira se todos os dados e documentos estão corretos. Depois de enviado, o cadastro vai para
                        análise da gestão.</p>
                    <div class="resumo-cadastro" id="resumo-cadastro"></div>
                    <div class="modal-cadastro-botoes">
                        <button type="button" class="btn-modal-sec" id="btn-voltar-revisar">Voltar e revisar</button>
                        <button type="button" class="btn-modal-pri" id="btn-confirmar-envio">Confirmar e enviar</button>
                    </div>
                </div>
            </div>
            <div class="modal-cadastro" id="modal-sucesso-cadastro" role="dialog" aria-modal="true" aria-labelledby="titulo-sucesso">
                <div class="modal-cadastro-caixa">
                    <div class="icone-sucesso">✓</div>
                    <h3 id="titulo-sucesso">Cadastro enviado!</h3>
                    <p id="texto-sucesso-cadastro">Cadastro enviado! O time de Cadastros da AJBorges vai conferir seus documentos e entrar em contato pelo celular informado.</p>
                    <div class="modal-cadastro-botoes">
                        <a class="btn-modal-pri" href="index.html">Página principal</a>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        const revisar = document.getElementById('modal-revisar-cadastro');
        const fechar = () => revisar.classList.remove('ativo');
        document.getElementById('btn-voltar-revisar').addEventListener('click', fechar);
        revisar.addEventListener('click', (e) => { if (e.target === revisar) fechar(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
    }

    function validarArquivos(prefixo) {
        for (const { doc, titulo, obrigatorio } of documentosDe(prefixo)) {
            if (semPdf(prefixo, doc)) continue;
            const arquivos = arquivosDe(prefixo, doc);
            const artigo = doc === 'cnh' ? 'a' : 'o';
            if (obrigatorio && arquivos.length === 0) return `Anexe ${artigo} ${titulo} ou marque que não tem o PDF.`;
            if (arquivos.length > MAX_ARQUIVOS) return `Envie no máximo ${MAX_ARQUIVOS} arquivos para ${artigo} ${titulo}.`;
            for (const f of arquivos) {
                if (!TIPOS_ARQUIVO.includes(f.type)) return `O arquivo "${f.name}" não é PDF, JPG ou PNG.`;
                if (f.size > TAMANHO_MAX) return `O arquivo "${f.name}" passa de 10 MB.`;
            }
        }
        return null;
    }

    function montarEnvio(prefixo) {
        const docs = documentosDe(prefixo);
        const chaves = [...CAMPOS_ACESSO, ...(prefixo === 'pj' ? CAMPOS_EMPRESA : [])];
        const sem_pdf = {};
        docs.forEach(({ doc, campos }) => {
            sem_pdf[doc] = semPdf(prefixo, doc);
            if (sem_pdf[doc]) chaves.push(...campos);
        });
        const dados = {};
        chaves.forEach((s) => {
            const el = campo(prefixo, s);
            if (el && !el.disabled && el.value.trim()) dados[s] = el.value.trim();
        });
        const documentos = {};
        const arquivos = [];
        docs.forEach(({ doc }) => {
            if (sem_pdf[doc]) return;
            const lista = arquivosDe(prefixo, doc);
            if (lista.length === 0) return;
            documentos[doc] = lista.map((f) => ({ nome: f.name, tipo: f.type, tamanho: f.size }));
            arquivos.push(...lista); // mesma ordem que o servidor usa em "indice"
        });
        return {
            corpo: {
                tipo: prefixo,
                tipologia: campo(prefixo, 'tipologia')?.value || '',
                email: (campo(prefixo, 'email')?.value || '').trim().toLowerCase() || null,
                sem_pdf,
                dados,
                documentos,
                aceite_lgpd: campo(prefixo, 'aceite-lgpd')?.checked === true,
                versao_politica: VERSAO_POLITICA
            },
            arquivos
        };
    }

    function mostrarErro(msg, lista) {
        const extra = Array.isArray(lista) && lista.length ? `\n\nFaltando: ${lista.join(', ')}.` : '';
        alert(msg + extra);
    }

    async function enviarArquivo(caminho, token, arquivo) {
        for (let tentativa = 1; tentativa <= 3; tentativa++) {
            const { error } = await window.supabaseClient.storage
                .from('documentos-cadastro')
                .uploadToSignedUrl(caminho, token, arquivo, { contentType: arquivo.type });
            if (!error) return true;
            console.warn(`Falha no envio de ${arquivo.name} (tentativa ${tentativa}):`, error);
        }
        return false;
    }

    let envioEmAndamento = null;

    function prepararFormulario(form, prefixo) {
        if (!form) return;

        const select = campo(prefixo, 'tipologia');
        let tipologiaAnterior = select ? select.value : '';
        select?.addEventListener('change', () => {
            if (!montarCrlvs(prefixo)) {
                select.value = tipologiaAnterior;
                return;
            }
            tipologiaAnterior = select.value;
            aplicarCaixas(prefixo);
        });
        // Caixinhas (inclusive as dos CRLVs criados depois)
        campo(prefixo, 'docs')?.addEventListener('change', (e) => {
            if (e.target.matches('.caixa-sem-pdf input')) aplicarCaixas(prefixo);
        });
        form.querySelectorAll('select[data-cidade]').forEach(ligarEstadoCidade);
        montarCrlvs(prefixo);
        aplicarCaixas(prefixo);

        // Enter num campo não envia o cadastro
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
                e.preventDefault();
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            aplicarCaixas(prefixo);
            const cidadesCarregando = validarCidades(form);
            if (!form.reportValidity()) return;
            if (cidadesCarregando) return mostrarErro(cidadesCarregando);

            const problemaArquivo = validarArquivos(prefixo);
            if (problemaArquivo) return mostrarErro(problemaArquivo);

            const aceite = campo(prefixo, 'aceite-lgpd');
            if (!aceite?.checked) {
                mostrarErro('Para enviar, marque que leu e concorda com a Política de Privacidade.');
                aceite?.focus();
                return;
            }

            const { corpo } = montarEnvio(prefixo);
            const situacao = ({ doc, campos, obrigatorio }) => {
                const anexos = corpo.documentos[doc] || [];
                if (anexos.length) return `Anexado (${esc(anexos.map((a) => a.nome).join(', '))})`;
                if (corpo.sem_pdf[doc] && (obrigatorio || campos.some((c) => corpo.dados[c]))) return 'Preenchido no formulário';
                return 'Não enviado (opcional)';
            };
            const nome = `${corpo.dados['motorista-nome'] || ''} ${corpo.dados['motorista-sobrenome'] || ''}`.trim();
            document.getElementById('resumo-cadastro').innerHTML = `
                <div>Tipo: <b>${prefixo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</b> · Veículo: <b>${esc(corpo.tipologia)}</b></div>
                <div>Motorista: <b>${esc(nome)}</b> · CPF <b>${esc(corpo.dados.cpf || '')}</b></div>
                <div>E-mail: <b>${esc(corpo.email || 'Não informado')}</b></div>
                ${documentosDe(prefixo).map((d) => `<div>${esc(d.titulo)}: <b>${situacao(d)}</b></div>`).join('')}
                <div>Política de Privacidade: <b>aceita</b></div>`;
            envioEmAndamento = { form, prefixo };
            document.getElementById('modal-revisar-cadastro').classList.add('ativo');
        });
    }

    async function confirmarEnvio() {
        if (!envioEmAndamento) return;
        const { form, prefixo } = envioEmAndamento;
        const btn = document.getElementById('btn-confirmar-envio');
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        const restaurar = () => { btn.disabled = false; btn.textContent = textoOriginal; };

        try {
            const { corpo, arquivos } = montarEnvio(prefixo);
            const r = await window.solicitarCadastroAgregado(corpo);
            if (!r.sucesso) {
                restaurar();
                document.getElementById('modal-revisar-cadastro').classList.remove('ativo');
                return mostrarErro(r.erro, r.faltando);
            }

            btn.textContent = 'Enviando documentos...';
            let falhas = 0;
            for (const up of r.uploads || []) {
                const arquivo = arquivos[up.indice];
                if (!arquivo || !(await enviarArquivo(up.path, up.token, arquivo))) falhas++;
            }

            document.getElementById('modal-revisar-cadastro').classList.remove('ativo');
            if (falhas > 0) {
                document.getElementById('texto-sucesso-cadastro').textContent =
                    `Seu cadastro foi registrado, mas ${falhas} documento(s) não puderam ser enviados. ` +
                    'Entre em contato com a gestão da AJBorges para completar o envio.';
            }
            form.reset();
            form.querySelectorAll('.file-preview-list').forEach((c) => { c.innerHTML = ''; });
            campo(prefixo, 'crlvs').innerHTML = '';
            aplicarCaixas(prefixo);
            document.getElementById('modal-sucesso-cadastro').classList.add('ativo');
        } catch (err) {
            console.error('Erro ao enviar cadastro:', err);
            mostrarErro('Não foi possível conectar ao servidor. Verifique a internet e tente novamente.');
        } finally {
            restaurar();
            envioEmAndamento = null;
        }
    }

    montarModais();
    document.getElementById('btn-confirmar-envio').addEventListener('click', confirmarEnvio);
    prepararFormulario(formPJ, 'pj');
    prepararFormulario(formPF, 'pf');
});
