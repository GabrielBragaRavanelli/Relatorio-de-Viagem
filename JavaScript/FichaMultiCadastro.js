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
            .replace(/^([A-Z]{3})([0-9A-Z]{4})$/, '$1-$2');
    }

    applyMask(document.getElementById('pj-cnpj'), maskCNPJ);
    applyMask(document.getElementById('pj-cpf'), maskCPF);
    applyMask(document.getElementById('pj-telefone-empresa'), maskPhone);
    applyMask(document.getElementById('pj-celular'), maskPhone);
    applyMask(document.getElementById('pj-mot-cep'), maskCEP);
    applyMask(document.getElementById('pj-prop-cep'), maskCEP);
    applyMask(document.getElementById('pj-prop-doc'), maskCpfCnpj);

    const placaInput = document.getElementById('pj-veic-placa');
    if (placaInput) {
        placaInput.addEventListener('input', () => {
            placaInput.value = placaInput.value.toUpperCase();
        });
    }

    const renavamInput = document.getElementById('pj-veic-renavam');
    if (renavamInput) {
        renavamInput.addEventListener('input', () => {
            renavamInput.value = renavamInput.value.replace(/\D/g, '').slice(0, 11);
        });
    }

    const anoInput = document.getElementById('pj-veic-ano');
    if (anoInput) {
        anoInput.addEventListener('input', () => {
            anoInput.value = anoInput.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    const chassiInput = document.getElementById('pj-veic-chassi');
    if (chassiInput) {
        chassiInput.addEventListener('input', () => {
            chassiInput.value = chassiInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
        });
    }

    applyMask(document.getElementById('pj-prop-carreta-doc'), maskCpfCnpj);
    applyMask(document.getElementById('pj-prop-carreta-cep'), maskCEP);

    const carretaPlacaInput = document.getElementById('pj-carreta-placa');
    if (carretaPlacaInput) {
        carretaPlacaInput.addEventListener('input', () => {
            carretaPlacaInput.value = carretaPlacaInput.value.toUpperCase();
        });
    }

    const carretaChassiInput = document.getElementById('pj-carreta-chassi');
    if (carretaChassiInput) {
        carretaChassiInput.addEventListener('input', () => {
            carretaChassiInput.value = carretaChassiInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
        });
    }

    const carretaRenavamInput = document.getElementById('pj-carreta-renavam');
    if (carretaRenavamInput) {
        carretaRenavamInput.addEventListener('input', () => {
            if (carretaRenavamInput.value !== 'NA') {
                carretaRenavamInput.value = carretaRenavamInput.value.replace(/\D/g, '').slice(0, 11);
            }
        });
    }

    const carretaAnoInput = document.getElementById('pj-carreta-ano');
    if (carretaAnoInput) {
        carretaAnoInput.addEventListener('input', () => {
            if (carretaAnoInput.value !== 'NA') {
                carretaAnoInput.value = carretaAnoInput.value.replace(/\D/g, '').slice(0, 4);
            }
        });
    }

    applyMask(document.getElementById('pf-cpf'), maskCPF);
    applyMask(document.getElementById('pf-celular'), maskPhone);
    applyMask(document.getElementById('pf-mot-cep'), maskCEP);
    applyMask(document.getElementById('pf-prop-cep'), maskCEP);
    applyMask(document.getElementById('pf-prop-doc'), maskCpfCnpj);
    applyMask(document.getElementById('pf-prop-carreta-doc'), maskCpfCnpj);
    applyMask(document.getElementById('pf-prop-carreta-cep'), maskCEP);

    const pfPlacaInput = document.getElementById('pf-veic-placa');
    if (pfPlacaInput) {
        pfPlacaInput.addEventListener('input', () => {
            pfPlacaInput.value = pfPlacaInput.value.toUpperCase();
        });
    }

    const pfRenavamInput = document.getElementById('pf-veic-renavam');
    if (pfRenavamInput) {
        pfRenavamInput.addEventListener('input', () => {
            pfRenavamInput.value = pfRenavamInput.value.replace(/\D/g, '').slice(0, 11);
        });
    }

    const pfAnoInput = document.getElementById('pf-veic-ano');
    if (pfAnoInput) {
        pfAnoInput.addEventListener('input', () => {
            pfAnoInput.value = pfAnoInput.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    const pfChassiInput = document.getElementById('pf-veic-chassi');
    if (pfChassiInput) {
        pfChassiInput.addEventListener('input', () => {
            pfChassiInput.value = pfChassiInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
        });
    }

    const pfCarretaPlacaInput = document.getElementById('pf-carreta-placa');
    if (pfCarretaPlacaInput) {
        pfCarretaPlacaInput.addEventListener('input', () => {
            pfCarretaPlacaInput.value = pfCarretaPlacaInput.value.toUpperCase();
        });
    }

    const pfCarretaChassiInput = document.getElementById('pf-carreta-chassi');
    if (pfCarretaChassiInput) {
        pfCarretaChassiInput.addEventListener('input', () => {
            pfCarretaChassiInput.value = pfCarretaChassiInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
        });
    }

    const pfCarretaRenavamInput = document.getElementById('pf-carreta-renavam');
    if (pfCarretaRenavamInput) {
        pfCarretaRenavamInput.addEventListener('input', () => {
            if (pfCarretaRenavamInput.value !== 'NA') {
                pfCarretaRenavamInput.value = pfCarretaRenavamInput.value.replace(/\D/g, '').slice(0, 11);
            }
        });
    }

    const pfCarretaAnoInput = document.getElementById('pf-carreta-ano');
    if (pfCarretaAnoInput) {
        pfCarretaAnoInput.addEventListener('input', () => {
            if (pfCarretaAnoInput.value !== 'NA') {
                pfCarretaAnoInput.value = pfCarretaAnoInput.value.replace(/\D/g, '').slice(0, 4);
            }
        });
    }

    const dropzones = document.querySelectorAll('.upload-dropzone');
    dropzones.forEach(zone => {
        const inputId = zone.getAttribute('data-target');
        const input = document.getElementById(inputId);
        const previewList = document.getElementById(`preview-${inputId}`);

        if (!input) return;

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
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                input.files = e.dataTransfer.files;
                renderFileList(input.files, previewList);
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        input.addEventListener('change', () => {
            renderFileList(input.files, previewList);
        });
    });

    function renderFileList(files, container) {
        if (!container) return;
        container.innerHTML = '';
        Array.from(files).forEach(file => {
            const item = document.createElement('span');
            item.className = 'file-preview-item';
            const sizeKb = (file.size / 1024).toFixed(0);
            item.textContent = `${file.name} (${sizeKb} KB)`;
            container.appendChild(item);
        });
    }

    const noNumberFields = [
        'pj-responsavel',
        'pj-motorista-nome',
        'pj-motorista-sobrenome',
        'pj-mae',
        'pj-prop-mae',
        'pj-prop-carreta-mae',
        'pf-motorista-nome',
        'pf-motorista-sobrenome',
        'pf-mae',
        'pf-prop-mae',
        'pf-prop-carreta-mae'
    ];

    noNumberFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key >= '0' && e.key <= '9') {
                    e.preventDefault();
                }
            });
            input.addEventListener('input', () => {
                input.value = input.value.replace(/[0-9]/g, '');
            });
        }
    });

    // =========================================================================
    // CADASTRO NO SUPABASE (edge function "solicitar-cadastro")
    //
    // Regra combinada com a Atlas: para cada documento, o motorista ANEXA o
    // arquivo OU PREENCHE os campos. Documento anexado -> campos opcionais.
    // A conta nasce PENDENTE: o login só funciona depois que a gestão aprovar.
    // =========================================================================

    const BLOCOS = {
        cnh: ['nascimento', 'rg', 'rg-uf', 'cidade-nasc', 'mae', 'cnh-registro', 'cnh-emissao',
            'cnh-primeira', 'cnh-uf', 'cnh-validade', 'cnh-categoria', 'cnh-seguranca'],
        cavalo: ['veic-placa', 'veic-marca', 'veic-modelo', 'veic-cor', 'veic-ano', 'veic-cidade-emp',
            'veic-uf', 'veic-tipologia', 'veic-carroceria', 'veic-renavam', 'veic-chassi'],
        carreta: ['carreta-placa', 'carreta-marca', 'carreta-modelo', 'carreta-cor', 'carreta-ano',
            'carreta-chassi', 'carreta-renavam', 'carreta-cidade-emp', 'carreta-uf']
    };
    const CARRETA_SEMPRE = ['carreta-rntrc', 'prop-carreta-doc', 'prop-carreta-mae', 'prop-carreta-endereco',
        'prop-carreta-cidade', 'prop-carreta-estado', 'prop-carreta-cep'];
    const CAMPOS_ENVIO = [
        'nome-empresa', 'cnpj', 'telefone-empresa', 'responsavel',
        'motorista-nome', 'motorista-sobrenome', 'cpf', 'celular',
        'mot-endereco', 'mot-cidade', 'mot-estado', 'mot-cep',
        'rastreador-pri', 'id-rastreador-pri', 'rastreador-sec', 'id-rastreador-sec', 'rntrc', 'val-rntrc',
        'prop-doc', 'prop-mae', 'prop-endereco', 'prop-cidade', 'prop-estado', 'prop-cep',
        ...BLOCOS.cnh, ...BLOCOS.cavalo, ...BLOCOS.carreta, ...CARRETA_SEMPRE
    ];
    // id do input de arquivo (sem o sufixo -pf) -> nome do documento no servidor
    const ARQUIVOS = {
        'file-doc-cnh': 'cnh',
        'file-doc-residencia': 'residencia',
        'file-doc-crlv-cavalo': 'crlv_cavalo',
        'file-doc-crlv-carreta': 'crlv_carreta',
        'file-doc-rntrc': 'rntrc',
        'file-doc-complementares': 'complementares'
    };
    const TIPOS_ARQUIVO = ['application/pdf', 'image/png', 'image/jpeg'];
    const TAMANHO_MAX = 10 * 1024 * 1024;

    function esc(v) {
        return String(v ?? '').replace(/[&<>"'`]/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
        }[c]));
    }

    function campo(prefixo, sufixo) {
        return document.getElementById(`${prefixo}-${sufixo}`);
    }

    function inputArquivo(prefixo, idBase) {
        return document.getElementById(prefixo === 'pf' ? `${idBase}-pf` : idBase);
    }

    function arquivosDe(prefixo, idBase) {
        const el = inputArquivo(prefixo, idBase);
        return el && el.files ? Array.from(el.files) : [];
    }

    function marcarObrigatorio(el, obrigatorio) {
        if (!el) return;
        el.required = !!obrigatorio;
        const grupo = el.closest('.form-group');
        const label = grupo ? grupo.querySelector('label') : null;
        const asterisco = label ? label.querySelector('.required-asterisk') : null;
        if (asterisco && label.getAttribute('for') === el.id) {
            asterisco.style.visibility = obrigatorio ? '' : 'hidden';
        }
    }

    // ---------- Montagem das partes novas do formulário ----------
    function montarAviso(form) {
        const aviso = document.createElement('div');
        aviso.className = 'aviso-regra-docs';
        aviso.innerHTML = `
            <strong>Como preencher mais rápido:</strong>
            anexe a <b>CNH</b> e o <b>CRLV</b> do cavalo (e da carreta, se tiver) na etapa
            <b>08 - Envio de Documentos</b>. Com o documento anexado, os campos dele ficam
            <b>opcionais</b>. Se não tiver o documento em mãos, preencha os campos normalmente.
            Use arquivos <b>legíveis</b> em PDF, JPG ou PNG (até 10 MB cada).`;
        form.insertBefore(aviso, form.firstElementChild);
    }

    function montarSemCarreta(form, prefixo) {
        const placa = campo(prefixo, 'carreta-placa');
        const etapa = placa ? placa.closest('.form-step') : null;
        if (!etapa) return null;
        const corpo = etapa.querySelector('.step-body');
        const caixa = document.createElement('label');
        caixa.className = 'opcao-sem-carreta';
        caixa.innerHTML = `<input type="checkbox" id="${prefixo}-sem-carreta"> Não possuo carreta`;
        corpo.insertBefore(caixa, corpo.firstChild);

        // Os campos da carreta vinham com "NA" preenchido; agora existe a caixa acima
        [...BLOCOS.carreta, ...CARRETA_SEMPRE].forEach((s) => {
            const el = campo(prefixo, s);
            if (el && el.value === 'NA') el.value = '';
        });
        return caixa.querySelector('input');
    }

    function montarAcesso(form, prefixo) {
        const etapa = document.createElement('div');
        etapa.className = 'form-step';
        etapa.innerHTML = `
            <div class="step-header">
                <div class="step-title-row">
                    <span class="step-bar"></span>
                    <h3 class="step-title">09 - Acesso ao Portal da Frota</h3>
                </div>
                <p class="step-subtitle">Depois que a gestão <strong>aprovar</strong> o seu cadastro, você entra no
                    Portal da Frota com o seu <strong>CPF</strong> e esta <strong>senha</strong>. O e-mail é usado
                    para recuperar a senha.</p>
            </div>
            <div class="step-body">
                <div class="form-group mb-2">
                    <label for="${prefixo}-email">E-mail: <span class="required-asterisk">*</span></label>
                    <input type="email" id="${prefixo}-email" autocomplete="email" placeholder="seuemail@exemplo.com" required>
                </div>
                <div class="dica-senha">
                    <strong>Dica para facilitar sua senha:</strong>
                    use os <b>6 primeiros dígitos do seu CPF</b> com um <b>caractere especial</b>
                    (como @, #, $ ou !) e uma <b>palavra de pelo menos 4 letras</b>. O caractere pode ficar no
                    início, no meio ou no final. Mínimo de 11 caracteres.
                    <div class="exemplos-senha">
                        <div><span>Exemplo 1:</span> <code data-exemplo="0"></code> <em>caractere no início + CPF + palavra</em></div>
                        <div><span>Exemplo 2:</span> <code data-exemplo="1"></code> <em>palavra + caractere no meio + CPF</em></div>
                        <div><span>Exemplo 3:</span> <code data-exemplo="2"></code> <em>palavra + CPF + caractere no final</em></div>
                    </div>
                </div>
                <div class="form-row col-2">
                    <div class="form-group">
                        <label for="${prefixo}-senha">Criar senha: <span class="required-asterisk">*</span></label>
                        <div class="campo-senha">
                            <input type="password" id="${prefixo}-senha" autocomplete="new-password" required minlength="11" maxlength="72">
                            <button type="button" class="btn-ver-senha" aria-label="Mostrar senha">👁</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="${prefixo}-senha2">Confirmar senha: <span class="required-asterisk">*</span></label>
                        <div class="campo-senha">
                            <input type="password" id="${prefixo}-senha2" autocomplete="new-password" required maxlength="72">
                            <button type="button" class="btn-ver-senha" aria-label="Mostrar senha">👁</button>
                        </div>
                    </div>
                </div>
                <ul class="checklist-senha" id="${prefixo}-checklist-senha">
                    <li data-regra="tamanho">Pelo menos 11 caracteres</li>
                    <li data-regra="cpf">Os 6 primeiros dígitos do seu CPF</li>
                    <li data-regra="especial">Um caractere especial (@, #, $, !...)</li>
                    <li data-regra="palavra">Uma palavra com 4 letras ou mais</li>
                    <li data-regra="iguais">As duas senhas iguais</li>
                </ul>
            </div>`;
        const linhaEnviar = form.querySelector('.form-submit-row');
        form.insertBefore(etapa, linhaEnviar);

        etapa.querySelectorAll('.btn-ver-senha').forEach((btn) => {
            btn.addEventListener('click', () => {
                const inp = btn.parentElement.querySelector('input');
                inp.type = inp.type === 'password' ? 'text' : 'password';
            });
        });

        const atualizar = () => {
            const cpf = campo(prefixo, 'cpf')?.value || '';
            const senha = document.getElementById(`${prefixo}-senha`).value;
            const senha2 = document.getElementById(`${prefixo}-senha2`).value;
            const exemplos = window.ajbSenha.exemplos(cpf);
            etapa.querySelectorAll('[data-exemplo]').forEach((el) => {
                el.textContent = exemplos[Number(el.getAttribute('data-exemplo'))];
            });
            const r = window.ajbSenha.regras(senha, cpf);
            r.iguais = senha.length > 0 && senha === senha2;
            etapa.querySelectorAll('.checklist-senha li').forEach((li) => {
                const ok = r[li.getAttribute('data-regra')];
                li.classList.toggle('ok', ok === true);
            });
        };
        ['cpf'].forEach((s) => campo(prefixo, s)?.addEventListener('input', atualizar));
        etapa.querySelectorAll('input').forEach((el) => el.addEventListener('input', atualizar));
        atualizar();
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
                    <p id="texto-sucesso-cadastro">Recebemos seus dados e documentos. Assim que a gestão da AJBorges
                        aprovar o cadastro, você poderá entrar no Portal da Frota com o seu CPF e a senha que criou.</p>
                    <div class="modal-cadastro-botoes">
                        <a class="btn-modal-sec" href="index.html">Página principal</a>
                        <a class="btn-modal-pri" href="Login.html#motorista">Ir para o login</a>
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

    // ---------- Regra "anexo OU campos" ----------
    function aplicarRegra(prefixo) {
        const temCnh = arquivosDe(prefixo, 'file-doc-cnh').length > 0;
        const temCavalo = arquivosDe(prefixo, 'file-doc-crlv-cavalo').length > 0;
        const temCarreta = arquivosDe(prefixo, 'file-doc-crlv-carreta').length > 0;
        const semCarreta = !!document.getElementById(`${prefixo}-sem-carreta`)?.checked;

        BLOCOS.cnh.forEach((s) => marcarObrigatorio(campo(prefixo, s), !temCnh));
        BLOCOS.cavalo.forEach((s) => marcarObrigatorio(campo(prefixo, s), !temCavalo));
        BLOCOS.carreta.forEach((s) => marcarObrigatorio(campo(prefixo, s), !semCarreta && !temCarreta));
        CARRETA_SEMPRE.forEach((s) => marcarObrigatorio(campo(prefixo, s), !semCarreta));

        // Etapas da carreta (06 e 07) ficam esmaecidas e desativadas sem carreta
        const etapaCarreta = campo(prefixo, 'carreta-placa')?.closest('.form-step');
        const etapaPropCarreta = campo(prefixo, 'prop-carreta-doc')?.closest('.form-step');
        [etapaCarreta, etapaPropCarreta].forEach((etapa) => {
            if (!etapa) return;
            etapa.classList.toggle('etapa-desativada', semCarreta);
            etapa.querySelectorAll('input:not([type="checkbox"]), select, textarea').forEach((el) => {
                el.disabled = semCarreta;
            });
        });
        const crlvCarreta = inputArquivo(prefixo, 'file-doc-crlv-carreta');
        if (crlvCarreta) crlvCarreta.closest('.form-group')?.classList.toggle('etapa-desativada', semCarreta);

        // Selos "documento anexado" nas etapas
        const selo = (el, ativo, texto) => {
            const etapa = el?.closest('.form-step');
            if (!etapa) return;
            let badge = etapa.querySelector('.selo-doc-anexado');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'selo-doc-anexado';
                etapa.querySelector('.step-title-row')?.appendChild(badge);
            }
            badge.textContent = texto;
            badge.style.display = ativo ? '' : 'none';
        };
        selo(campo(prefixo, 'cnh-registro'), temCnh, 'CNH anexada · campos da CNH opcionais');
        selo(campo(prefixo, 'veic-placa'), temCavalo, 'CRLV anexado · campos opcionais');
        selo(campo(prefixo, 'carreta-placa'), temCarreta && !semCarreta, 'CRLV anexado · campos opcionais');
    }

    function validarArquivos(prefixo) {
        for (const idBase of Object.keys(ARQUIVOS)) {
            for (const f of arquivosDe(prefixo, idBase)) {
                if (!TIPOS_ARQUIVO.includes(f.type)) return `O arquivo "${f.name}" não é PDF, JPG ou PNG.`;
                if (f.size > TAMANHO_MAX) return `O arquivo "${f.name}" passa de 10 MB.`;
            }
        }
        if (arquivosDe(prefixo, 'file-doc-residencia').length === 0) {
            return 'Anexe o comprovante de residência na etapa 08.';
        }
        return null;
    }

    function montarEnvio(prefixo) {
        const dados = {};
        CAMPOS_ENVIO.forEach((s) => {
            const el = campo(prefixo, s);
            if (el && !el.disabled && el.value.trim()) dados[s] = el.value.trim();
        });
        const documentos = [];
        const arquivos = [];
        Object.entries(ARQUIVOS).forEach(([idBase, nomeDoc]) => {
            arquivosDe(prefixo, idBase).forEach((f) => {
                documentos.push({ campo: nomeDoc, nome: f.name, tipo: f.type, tamanho: f.size });
                arquivos.push(f);
            });
        });
        return {
            corpo: {
                tipo: prefixo,
                email: (document.getElementById(`${prefixo}-email`)?.value || '').trim().toLowerCase(),
                senha: document.getElementById(`${prefixo}-senha`)?.value || '',
                sem_carreta: !!document.getElementById(`${prefixo}-sem-carreta`)?.checked,
                dados,
                documentos
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
        montarAviso(form);
        const caixaSemCarreta = montarSemCarreta(form, prefixo);
        montarAcesso(form, prefixo);

        Object.keys(ARQUIVOS).forEach((idBase) => {
            inputArquivo(prefixo, idBase)?.addEventListener('change', () => aplicarRegra(prefixo));
        });
        caixaSemCarreta?.addEventListener('change', () => aplicarRegra(prefixo));
        aplicarRegra(prefixo);

        // Enter num campo não envia o cadastro
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
                e.preventDefault();
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            aplicarRegra(prefixo);
            if (!form.reportValidity()) return;

            const cpf = campo(prefixo, 'cpf')?.value || '';
            const senha = document.getElementById(`${prefixo}-senha`).value;
            const senha2 = document.getElementById(`${prefixo}-senha2`).value;
            const problemaSenha = window.ajbSenha.erro(senha, cpf);
            if (problemaSenha) return mostrarErro(problemaSenha);
            if (senha !== senha2) return mostrarErro('As duas senhas não são iguais.');
            const problemaArquivo = validarArquivos(prefixo);
            if (problemaArquivo) return mostrarErro(problemaArquivo);

            const { corpo } = montarEnvio(prefixo);
            const conta = (c) => corpo.documentos.filter((d) => d.campo === c).length;
            const via = (c, rotulo) => conta(c) > 0 ? `${rotulo}: <b>documento anexado</b>` : `${rotulo}: <b>preenchido no formulário</b>`;
            const nome = `${corpo.dados['motorista-nome'] || ''} ${corpo.dados['motorista-sobrenome'] || ''}`.trim();
            document.getElementById('resumo-cadastro').innerHTML = `
                <div>Tipo: <b>${prefixo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</b></div>
                <div>Motorista: <b>${esc(nome)}</b> · CPF <b>${esc(corpo.dados.cpf || '')}</b></div>
                <div>E-mail: <b>${esc(corpo.email)}</b></div>
                <div>${via('cnh', 'CNH')}</div>
                <div>${via('crlv_cavalo', 'Cavalo')}</div>
                <div>${corpo.sem_carreta ? 'Carreta: <b>não possui</b>' : via('crlv_carreta', 'Carreta')}</div>
                <div>Arquivos anexados: <b>${corpo.documentos.length}</b></div>`;
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
            aplicarRegra(prefixo);
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
