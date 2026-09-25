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
    // SALVAMENTO REAL NO LOCALSTORAGE (CONEXÃO COM DASHBOARD DE MOTORISTAS)
    // =========================================================================
    const STORAGE_CADASTROS_KEY = 'ajborges_cadastros_agregados';

    function salvarNovoCadastro(cadastro) {
        try {
            const existentes = JSON.parse(localStorage.getItem(STORAGE_CADASTROS_KEY) || '[]');
            existentes.unshift(cadastro);
            localStorage.setItem(STORAGE_CADASTROS_KEY, JSON.stringify(existentes));
            return true;
        } catch (e) {
            console.error('Erro ao salvar cadastro no localStorage:', e);
            return false;
        }
    }

    if (formPJ) {
        formPJ.addEventListener('submit', (e) => {
            e.preventDefault();

            const nomeEmpresa = (document.getElementById('pj-nome-empresa')?.value || '').trim();
            const cnpj = (document.getElementById('pj-cnpj')?.value || '').trim();
            const telEmpresa = (document.getElementById('pj-telefone-empresa')?.value || '').trim();
            const motoristaNome = (document.getElementById('pj-motorista-nome')?.value || '').trim();
            const motoristaSobrenome = (document.getElementById('pj-motorista-sobrenome')?.value || '').trim();
            const nomeCompleto = `${motoristaNome} ${motoristaSobrenome}`.trim() || nomeEmpresa;
            const cpf = (document.getElementById('pj-cpf')?.value || '').trim();
            const celular = (document.getElementById('pj-celular')?.value || telEmpresa).trim();
            const cnh = (document.getElementById('pj-cnh')?.value || '').trim();
            const catCnh = (document.getElementById('pj-cnh-categoria')?.value || 'E').trim();
            const veiculoModelo = (document.getElementById('pj-veic-modelo')?.value || 'Caminhão Pesado').trim();
            const veiculoPlaca = (document.getElementById('pj-veic-placa')?.value || '').trim();
            const carretaPlaca = (document.getElementById('pj-carreta-placa')?.value || '').trim();

            const novoRegistro = {
                id: 'AGR-PJ-' + Date.now(),
                tipo: 'Pessoa Jurídica (PJ)',
                tipoCodigo: 'pj',
                empresa: nomeEmpresa,
                documentoEmpresa: cnpj,
                nome: nomeCompleto,
                documento: cpf || cnpj,
                telefone: celular || telEmpresa,
                categoria: catCnh,
                cnh: cnh || 'Informada',
                veiculo: veiculoModelo,
                placa: veiculoPlaca,
                carretaPlaca: carretaPlaca,
                data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                status: 'pendente',
                origem: 'Seja um Agregado Conosco (PJ)'
            };

            if (salvarNovoCadastro(novoRegistro)) {
                alert('Ficha cadastral de Pessoa Jurídica enviada com sucesso! Os dados foram encaminhados diretamente ao Dashboard de Homologação.');
                formPJ.reset();
            }
        });
    }

    if (formPF) {
        formPF.addEventListener('submit', (e) => {
            e.preventDefault();

            const motoristaNome = (document.getElementById('pf-motorista-nome')?.value || '').trim();
            const motoristaSobrenome = (document.getElementById('pf-motorista-sobrenome')?.value || '').trim();
            const nomeCompleto = `${motoristaNome} ${motoristaSobrenome}`.trim();
            const cpf = (document.getElementById('pf-cpf')?.value || '').trim();
            const celular = (document.getElementById('pf-celular')?.value || '').trim();
            const cnh = (document.getElementById('pf-cnh')?.value || '').trim();
            const catCnh = (document.getElementById('pf-cnh-categoria')?.value || 'E').trim();
            const veiculoModelo = (document.getElementById('pf-veic-modelo')?.value || 'Cavalo Mecânico').trim();
            const veiculoPlaca = (document.getElementById('pf-veic-placa')?.value || '').trim();
            const carretaPlaca = (document.getElementById('pf-carreta-placa')?.value || '').trim();

            const novoRegistro = {
                id: 'AGR-PF-' + Date.now(),
                tipo: 'Pessoa Física (PF)',
                tipoCodigo: 'pf',
                empresa: 'Autônomo',
                documentoEmpresa: '',
                nome: nomeCompleto,
                documento: cpf,
                telefone: celular,
                categoria: catCnh,
                cnh: cnh || 'Informada',
                veiculo: veiculoModelo,
                placa: veiculoPlaca,
                carretaPlaca: carretaPlaca,
                data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                status: 'pendente',
                origem: 'Seja um Agregado Conosco (PF)'
            };

            if (salvarNovoCadastro(novoRegistro)) {
                alert('Ficha cadastral de Pessoa Física enviada com sucesso! Os dados foram encaminhados diretamente ao Dashboard de Homologação.');
                formPF.reset();
            }
        });
    }
});


