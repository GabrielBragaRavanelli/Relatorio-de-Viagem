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

    // Abrir a tela de login encerra qualquer sessão anterior neste aparelho
    // (importante em celular/computador compartilhado)
    if (window.supabaseClient) {
        window.supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    if (window.ajbAuth) window.ajbAuth.limparDadosLocais();

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
            e.stopPropagation();
            const wrapper = button.closest('.input-wrapper');
            if (!wrapper) return;

            const passwordInput = wrapper.querySelector('.input-password') || wrapper.querySelector('input');
            const iconEye = button.querySelector('.icon-eye');
            const iconEyeOff = button.querySelector('.icon-eye-off');

            if (passwordInput) {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';

                if (iconEye) {
                    iconEye.classList.toggle('hidden', isPassword);
                    iconEye.style.display = isPassword ? 'none' : 'block';
                }
                if (iconEyeOff) {
                    iconEyeOff.classList.toggle('hidden', !isPassword);
                    iconEyeOff.style.display = isPassword ? 'block' : 'none';
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
    //    O login passa pela edge function 'login' (limite de tentativas e papel
    //    conferido no servidor). O navegador não consulta a tabela perfis.
    // =========================================================================

    function travarBotao(form, texto) {
        const btn = form.querySelector('.btn-submit');
        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>${texto}</span>`;
        }
        return () => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        };
    }

    async function entrar(form, dadosLogin, textoAguarde, destino, mensagemOk) {
        if (typeof window.loginSupabase !== 'function' || !window.supabaseClient) {
            showToast('Servidor de autenticação indisponível no momento.', 'error');
            return;
        }
        const destravar = travarBotao(form, textoAguarde);
        try {
            const r = await window.loginSupabase(dadosLogin);
            if (!r.sucesso) {
                destravar();
                showToast(r.erro, 'error', 4500);
                return;
            }
            showToast(mensagemOk, 'success');
            setTimeout(() => { window.location.href = destino; }, 800);
        } catch (err) {
            console.error('Erro inesperado no login:', err);
            destravar();
            showToast('Não foi possível conectar ao servidor de login.', 'error');
        }
    }

    // Formulário do Motorista
    if (formMotorista) {
        formMotorista.addEventListener('submit', async (e) => {
            e.preventDefault();

            const cpfVal = (inputCpf?.value || '').trim();
            const senhaVal = formMotorista.querySelector('#senha-motorista')?.value || '';

            if (cpfVal.replace(/\D/g, '').length !== 11) {
                showToast('Por favor, informe um CPF válido no formato 000.000.000-00.', 'error');
                inputCpf?.focus();
                return;
            }
            if (!senhaVal) {
                showToast('Por favor, digite sua senha de acesso.', 'error');
                return;
            }

            localStorage.removeItem('ajborges_relatorio_viagem_ml_draft');
            await entrar(
                formMotorista,
                { tipo: 'motorista', cpf: cpfVal, senha: senhaVal },
                'Validando credenciais do motorista...',
                'relatorio-viagem.html?novo=true',
                'Login realizado com sucesso! Redirecionando...'
            );
        });
    }

    // Formulário do Administrador
    if (formAdmin) {
        formAdmin.addEventListener('submit', async (e) => {
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

            await entrar(
                formAdmin,
                { tipo: 'admin', email: emailVal, senha: senhaVal },
                'Validando credenciais...',
                'escolhaDashboard.html',
                'Acesso de administrador aprovado! Acessando painel...'
            );
        });
    }
});
