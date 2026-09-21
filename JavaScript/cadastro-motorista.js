/**
 * Cadastro de Motorista - AJBorges Transporte & Logística
 * Máscaras dinâmicas (CPF, Telefone), sugestão inteligente de senha
 * e validação da submissão do formulário.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const form = document.getElementById('form-cadastro-motorista');
    const inputNome = document.getElementById('nome-motorista');
    const inputCpf = document.getElementById('cpf-cadastro');
    const inputTelefone = document.getElementById('telefone-motorista');
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

    // Atualiza os 3 exemplos dinâmicos de senha com os 6 primeiros dígitos do CPF
    function atualizarSugestaoSenha() {
        const ex1 = document.getElementById('exemplo-senha-1');
        const ex2 = document.getElementById('exemplo-senha-2');
        const ex3 = document.getElementById('exemplo-senha-3');
        if (!ex1 && !ex2 && !ex3) return;

        const digitosCpf = (inputCpf?.value || '').replace(/\D/g, '');
        let prefix = '123456';
        if (digitosCpf.length >= 6) {
            prefix = digitosCpf.slice(0, 6);
        } else if (digitosCpf.length > 0) {
            prefix = digitosCpf.padEnd(6, '0');
        }

        if (ex1) ex1.textContent = `@${prefix}viagem`;
        if (ex2) ex2.textContent = `${prefix}#2026`;
        if (ex3) ex3.textContent = `${prefix}viagem@`;
    }

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
            atualizarSugestaoSenha();
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
    // 4. VALIDAÇÃO DE CONFERÊNCIA DE SENHA EM TEMPO REAL
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

        const regexEspecial = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/;

        if (senha === confirmar) {
            if (!regexEspecial.test(senha)) {
                senhaFeedback.textContent = 'ℹ As senhas coincidem, mas lembre-se de incluir um caractere especial (ex: @, #, !)';
                senhaFeedback.className = 'senha-feedback';
            } else {
                senhaFeedback.textContent = '✓ As senhas coincidem e atendem aos requisitos';
                senhaFeedback.className = 'senha-feedback sucesso';
            }
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
    // 5. SISTEMA DE TOAST DE NOTIFICAÇÃO
    // =========================================================================

    function showToast(message, type = 'success', duration = 4000) {
        if (!toast) return;

        const messageEl = toast.querySelector('.toast-message');
        const iconEl = toast.querySelector('.toast-icon');

        if (messageEl) messageEl.textContent = message;

        if (iconEl) {
            if (type === 'success') iconEl.textContent = '✓';
            else if (type === 'error') iconEl.textContent = '✕';
            else iconEl.textContent = 'ℹ';
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
    // 6. SUBMISSÃO DO FORMULÁRIO DE CADASTRO
    // =========================================================================

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validação: Nome Completo
            const nome = (inputNome?.value || '').trim();
            if (nome.length < 3) {
                showToast('Por favor, informe seu nome completo.', 'error');
                inputNome?.focus();
                return;
            }

            // Validação: CPF Obrigatório
            const cpf = (inputCpf?.value || '').trim();
            if (cpf.length < 14) {
                showToast('Informe um CPF válido no formato 000.000.000-00.', 'error');
                inputCpf?.focus();
                return;
            }

            // Validação: Telefone Opcional (se preenchido, valida formato)
            const telefone = (inputTelefone?.value || '').trim();
            if (telefone.length > 0 && telefone.length < 14) {
                showToast('O número de telefone informado está incompleto.', 'error');
                inputTelefone?.focus();
                return;
            }

            // Validação: Senha mínima 6 caracteres
            const senha = inputSenha?.value || '';
            if (senha.length < 6) {
                showToast('A senha deve conter no mínimo 6 caracteres.', 'error');
                inputSenha?.focus();
                return;
            }

            // Validação: Caractere especial obrigatório
            const regexEspecial = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/;
            if (!regexEspecial.test(senha)) {
                showToast('A senha deve conter pelo menos um caractere especial obrigatório (como @, #, $, !).', 'error');
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
                showToast('É necessário aceitar a declaração dos termos para concluir o cadastro.', 'error');
                checkboxTermos?.focus();
                return;
            }

            // Processamento do Cadastro
            const btnSubmit = form.querySelector('.btn-submit-cadastro');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span>Processando cadastro do motorista...</span>`;
            }

            // Salva o CPF para preencher automaticamente na tela de login
            sessionStorage.setItem('ajborges_cpf_cadastrado', cpf);

            showToast('Cadastro realizado com sucesso! Redirecionando para o login...', 'success');

            setTimeout(() => {
                window.location.href = 'Login.html#motorista';
            }, 1600);
        });
    }
});
