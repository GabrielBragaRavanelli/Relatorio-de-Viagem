/**
 * Login - AJBorges Transporte & Logística
 * Gerenciamento de alternância de abas (Motorista / Administrador),
 * máscara de CPF, visualização de senha e validação de login.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const toast = document.getElementById('login-toast');
    const formMotorista = document.getElementById('form-motorista');
    const formAdmin = document.getElementById('form-admin');
    const inputCpf = document.getElementById('cpf-motorista');
    const togglePasswordButtons = document.querySelectorAll('.btn-toggle-password');

    let toastTimer = null;

    // =========================================================================
    // 1. ALTERNÂNCIA DE ABAS (MOTORISTA / ADMINISTRADOR)
    // =========================================================================

    /**
     * Alterna para a aba correspondente ao targetId especificado
     * @param {string} targetFormId - ID do formulário a ser exibido ('form-motorista' ou 'form-admin')
     */
    function switchTab(targetFormId) {
        if (!targetFormId) return;

        // Atualiza estado visual e de acessibilidade de cada botão de aba
        tabButtons.forEach(button => {
            const isTarget = button.getAttribute('data-target') === targetFormId;
            button.classList.toggle('active', isTarget);
            button.setAttribute('aria-selected', isTarget ? 'true' : 'false');
            if (isTarget) {
                button.focus();
            }
        });

        // Atualiza exibição dos formulários com animação
        tabContents.forEach(content => {
            const isTarget = content.id === targetFormId;
            content.classList.toggle('active', isTarget);
        });

        // Foca automaticamente no primeiro campo do formulário ativo
        const activeForm = document.getElementById(targetFormId);
        if (activeForm) {
            const firstInput = activeForm.querySelector('input:not([type="checkbox"])');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 150);
            }
        }
    }

    // Registra evento de clique nas abas
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.getAttribute('data-target');
            switchTab(targetId);

            // Atualiza hash da URL de forma limpa (ex: #motorista ou #admin)
            const profile = targetId === 'form-admin' ? 'admin' : 'motorista';
            if (window.location.hash !== `#${profile}`) {
                history.replaceState(null, '', `#${profile}`);
            }
        });

        // Suporte a navegação por teclado nas abas (Seta Esquerda / Seta Direita)
        button.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const otherButton = Array.from(tabButtons).find(btn => btn !== button);
                if (otherButton) {
                    otherButton.click();
                }
            }
        });
    });

    // Lê a hash da URL ao carregar a página (ex: Login.html#admin)
    const currentHash = window.location.hash.toLowerCase();
    if (currentHash === '#admin' || currentHash === '#administrador') {
        switchTab('form-admin');
    } else {
        switchTab('form-motorista');
    }

    // Preenche automaticamente o CPF caso o motorista tenha acabado de se cadastrar
    const cpfRecemCadastrado = sessionStorage.getItem('ajborges_cpf_cadastrado');
    if (cpfRecemCadastrado && inputCpf) {
        inputCpf.value = cpfRecemCadastrado;
        sessionStorage.removeItem('ajborges_cpf_cadastrado');
        showToast('Cadastro realizado! Digite sua senha para acessar.', 'info', 4500);
        setTimeout(() => {
            const senhaInput = document.getElementById('senha-motorista');
            if (senhaInput) senhaInput.focus();
        }, 300);
    }

    // Preenche automaticamente o CPF caso o motorista tenha acabado de redefinir sua senha
    const cpfRecemRecuperado = sessionStorage.getItem('ajborges_cpf_recuperado');
    if (cpfRecemRecuperado && inputCpf) {
        inputCpf.value = cpfRecemRecuperado;
        sessionStorage.removeItem('ajborges_cpf_recuperado');
        showToast('Senha redefinida com sucesso! Entre com sua nova senha.', 'success', 5000);
        setTimeout(() => {
            const senhaInput = document.getElementById('senha-motorista');
            if (senhaInput) senhaInput.focus();
        }, 300);
    }

    // =========================================================================
    // 2. MÁSCARA AUTOMÁTICA DE CPF (MOTORISTA)
    // =========================================================================

    if (inputCpf) {
        inputCpf.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não for dígito

            if (value.length > 11) {
                value = value.slice(0, 11);
            }

            // Aplica a formatação: 000.000.000-00
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }

            e.target.value = value;
        });

        // Bloqueia teclas não numéricas
        inputCpf.addEventListener('keypress', (e) => {
            if (!/\d/.test(e.key) && e.key !== 'Enter') {
                e.preventDefault();
            }
        });
    }

    // =========================================================================
    // 3. EXIBIR / OCULTAR SENHA
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
    // 4. SISTEMA DE TOAST DE FEEDBACK
    // =========================================================================

    /**
     * Exibe um toast moderno na tela com mensagem e tipo
     * @param {string} message - Texto da notificação
     * @param {'success'|'info'|'error'} type - Tipo da notificação
     * @param {number} duration - Duração em ms
     */
    function showToast(message, type = 'success', duration = 3500) {
        if (!toast) return;

        const messageEl = toast.querySelector('.toast-message');
        const iconEl = toast.querySelector('.toast-icon');

        if (messageEl) messageEl.textContent = message;

        if (iconEl) {
            if (type === 'success') iconEl.textContent = '✓';
            else if (type === 'error') iconEl.textContent = '✕';
            else iconEl.textContent = 'ℹ';
        }

        // Reseta classes
        toast.className = 'login-toast show';
        toast.classList.add(`toast-${type}`);
        toast.setAttribute('aria-hidden', 'false');

        if (toastTimer) clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toast.setAttribute('aria-hidden', 'true');
        }, duration);
    }

    // =========================================================================
    // 5. ENVIO E VALIDAÇÃO DOS FORMULÁRIOS
    // =========================================================================

    // Formulário do Motorista
    if (formMotorista) {
        formMotorista.addEventListener('submit', (e) => {
            e.preventDefault();

            const cpfVal = (inputCpf?.value || '').trim();
            const senhaVal = formMotorista.querySelector('#senha-motorista')?.value || '';

            // Validação simples de CPF completo
            if (cpfVal.length < 14) {
                showToast('Por favor, informe um CPF válido no formato 000.000.000-00.', 'error');
                inputCpf?.focus();
                return;
            }

            if (!senhaVal) {
                showToast('Por favor, digite sua senha de acesso.', 'error');
                return;
            }

            // Simulação de login bem-sucedido
            const submitBtn = formMotorista.querySelector('.btn-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>Entrando no sistema...</span>`;
            }

            // Salva dados da sessão do motorista logado
            localStorage.setItem('ajborges_usuario_ativo', JSON.stringify({
                role: 'motorista',
                id: 'MOT-104',
                nome: 'Carlos Eduardo Ferreira',
                cpf: cpfVal
            }));

            showToast('Login de Motorista realizado com sucesso! Redirecionando...', 'success');

            setTimeout(() => {
                // Redireciona para o formulário de relatório de viagem vinculado
                window.location.href = 'relatorio-viagem.html';
            }, 1200);
        });
    }

    // Formulário do Administrador
    if (formAdmin) {
        formAdmin.addEventListener('submit', (e) => {
            e.preventDefault();

            const emailVal = formAdmin.querySelector('#email-admin')?.value.trim() || '';
            const senhaVal = formAdmin.querySelector('#senha-admin')?.value || '';

            if (!emailVal || !emailVal.includes('@')) {
                showToast('Informe um e-mail corporativo válido.', 'error');
                return;
            }

            if (!senhaVal) {
                showToast('Informe a senha de gestor.', 'error');
                return;
            }

            const submitBtn = formAdmin.querySelector('.btn-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>Autenticando gestão...</span>`;
            }

            // Salva sessão administrativa
            localStorage.setItem('ajborges_usuario_ativo', JSON.stringify({
                role: 'admin',
                nome: 'Administrador AJBorges',
                email: emailVal || 'operacional@ajborges.com'
            }));

            showToast('Autenticação de Administrador aprovada! Acessando painel...', 'success');

            setTimeout(() => {
                // Redireciona diretamente para o Dashboard Administrativo da AJBorges
                window.location.href = 'dashboard-admin.html';
            }, 1000);
        });
    }
});
