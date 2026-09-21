/**
 * Cadastro de Motorista - AJBorges Transporte & Logística
 * Máscaras dinâmicas (CPF, Telefone, CNH, Placa), verificação de senha
 * e feedback de submissão do formulário.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const form = document.getElementById('form-cadastro-motorista');
    const inputNome = document.getElementById('nome-motorista');
    const inputCpf = document.getElementById('cpf-cadastro');
    const inputTelefone = document.getElementById('telefone-motorista');
    const inputCnh = document.getElementById('cnh-motorista');
    const selectCategoria = document.getElementById('categoria-cnh');
    const inputPlaca = document.getElementById('placa-veiculo');
    const inputSenha = document.getElementById('senha-cadastro');
    const inputConfirmarSenha = document.getElementById('confirmar-senha-cadastro');
    const senhaFeedback = document.getElementById('senha-feedback');
    const checkboxTermos = document.getElementById('termos-aceite');
    const togglePasswordButtons = document.querySelectorAll('.btn-toggle-password');
    const toast = document.getElementById('cadastro-toast');

    let toastTimer = null;

    // =========================================================================
    // 1. MÁSCARAS DE ENTRADA
    // =========================================================================

    // Máscara de CPF (000.000.000-00)
    if (inputCpf) {
        inputCpf.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }

            e.target.value = value;
        });

        inputCpf.addEventListener('keypress', (e) => {
            if (!/\d/.test(e.key) && e.key !== 'Enter') e.preventDefault();
        });
    }

    // Máscara de WhatsApp / Telefone ((00) 00000-0000 ou (00) 0000-0000)
    if (inputTelefone) {
        inputTelefone.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 10) {
                // Celular com 9 dígitos: (00) 00000-0000
                value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
            } else if (value.length > 6) {
                value = value.replace(/^(\d{2})(\d{4,5})(\d{0,4})$/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
            } else if (value.length > 0) {
                value = value.replace(/^(\d*)$/, '($1');
            }

            e.target.value = value;
        });
    }

    // Máscara de CNH (apenas números, até 11 dígitos)
    if (inputCnh) {
        inputCnh.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            e.target.value = value;
        });
    }

    // Máscara e Formatação de Placa de Veículo (ABC-1234 ou Padrão Mercosul BRA2E19)
    if (inputPlaca) {
        inputPlaca.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (value.length > 7) value = value.slice(0, 7);

            // Se for padrão antigo (3 letras + 4 números), adiciona o hífen
            if (/^[A-Z]{3}\d{4}$/.test(value)) {
                value = value.replace(/^([A-Z]{3})(\d{4})$/, '$1-$2');
            }

            e.target.value = value;
        });
    }

    // =========================================================================
    // 2. EXIBIR / OCULTAR SENHA
    // =========================================================================

    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const wrapper = button.closest('.input-wrapper');
            if (!wrapper) return;

            const passwordInput = wrapper.querySelector('.input-password');
            const iconEye = button.querySelector('.icon-eye');
            const iconEyeOff = button.querySelector('.icon-eye-off');

            if (passwordInput) {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';

                if (iconEye && iconEyeOff) {
                    iconEye.classList.toggle('hidden', isPassword);
                    iconEyeOff.classList.toggle('hidden', !isPassword);
                }

                button.setAttribute('title', isPassword ? 'Ocultar senha' : 'Exibir senha');
            }
        });
    });

    // =========================================================================
    // 3. VALIDAÇÃO DE CONFERÊNCIA DE SENHA EM TEMPO REAL
    // =========================================================================

    function verificarSenhas() {
        const senha = inputSenha ? inputSenha.value : '';
        const confirmar = inputConfirmarSenha ? inputConfirmarSenha.value : '';

        if (!senhaFeedback) return;

        if (!confirmar) {
            senhaFeedback.textContent = '';
            senhaFeedback.className = 'senha-feedback';
            return;
        }

        if (senha === confirmar) {
            senhaFeedback.textContent = '✓ As senhas coincidem';
            senhaFeedback.className = 'senha-feedback sucesso';
        } else {
            senhaFeedback.textContent = '✕ As senhas não coincidem';
            senhaFeedback.className = 'senha-feedback erro';
        }
    }

    if (inputSenha && inputConfirmarSenha) {
        inputSenha.addEventListener('input', verificarSenhas);
        inputConfirmarSenha.addEventListener('input', verificarSenhas);
    }

    // =========================================================================
    // 4. SISTEMA DE TOAST DE NOTIFICAÇÃO
    // =========================================================================

    function showToast(message, type = 'success', duration = 3500) {
        if (!toast) return;

        const messageEl = toast.querySelector('.toast-message');
        const iconEl = toast.querySelector('.toast-icon');

        if (messageEl) messageEl.textContent = message;

        if (iconEl) {
            iconEl.textContent = type === 'success' ? '✓' : '✕';
        }

        toast.className = 'cadastro-toast show';
        toast.classList.add(`toast-${type}`);
        toast.setAttribute('aria-hidden', 'false');

        if (toastTimer) clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toast.setAttribute('aria-hidden', 'true');
        }, duration);
    }

    // =========================================================================
    // 5. SUBMISSÃO DO FORMULÁRIO DE CADASTRO
    // =========================================================================

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validação: Nome
            const nome = (inputNome?.value || '').trim();
            if (nome.length < 3) {
                showToast('Por favor, informe seu nome completo.', 'error');
                inputNome?.focus();
                return;
            }

            // Validação: CPF
            const cpf = (inputCpf?.value || '').trim();
            if (cpf.length < 14) {
                showToast('Informe um CPF válido no formato 000.000.000-00.', 'error');
                inputCpf?.focus();
                return;
            }

            // Validação: Telefone
            const telefone = (inputTelefone?.value || '').trim();
            if (telefone.length < 14) {
                showToast('Informe um número de telefone com DDD válido.', 'error');
                inputTelefone?.focus();
                return;
            }

            // Validação: CNH
            const cnh = (inputCnh?.value || '').trim();
            if (cnh.length < 9) {
                showToast('Informe o número da sua CNH.', 'error');
                inputCnh?.focus();
                return;
            }

            // Validação: Categoria
            const categoria = selectCategoria?.value || '';
            if (!categoria) {
                showToast('Selecione a categoria da sua CNH.', 'error');
                selectCategoria?.focus();
                return;
            }

            // Validação: Placa
            const placa = (inputPlaca?.value || '').trim();
            if (placa.length < 7) {
                showToast('Informe a placa do veículo principal.', 'error');
                inputPlaca?.focus();
                return;
            }

            // Validação: Senha
            const senha = inputSenha?.value || '';
            if (senha.length < 6) {
                showToast('A senha deve conter no mínimo 6 caracteres.', 'error');
                inputSenha?.focus();
                return;
            }

            // Validação: Confirmação de Senha
            const confirmarSenha = inputConfirmarSenha?.value || '';
            if (senha !== confirmarSenha) {
                showToast('As senhas digitadas não coincidem. Verifique e tente novamente.', 'error');
                inputConfirmarSenha?.focus();
                return;
            }

            // Validação: Termos
            if (!checkboxTermos?.checked) {
                showToast('É necessário aceitar os termos para prosseguir com o cadastro.', 'error');
                checkboxTermos?.focus();
                return;
            }

            // Sucesso na validação
            const btnSubmit = form.querySelector('.btn-submit-cadastro');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span>Processando cadastro...</span>`;
            }

            // Salva o CPF para facilitar o login automático na tela de login
            sessionStorage.setItem('ajborges_cpf_cadastrado', cpf);

            showToast('Cadastro realizado com sucesso! Redirecionando para o login...', 'success');

            setTimeout(() => {
                window.location.href = 'Login.html#motorista';
            }, 1600);
        });
    }
});
