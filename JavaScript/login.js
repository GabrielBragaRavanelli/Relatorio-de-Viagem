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
    // =========================================================================

    // Formulário do Motorista
    if (formMotorista) {
        formMotorista.addEventListener('submit', async (e) => {
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

            const submitBtn = formMotorista.querySelector('.btn-submit');
            const textoOriginalBtn = submitBtn ? submitBtn.innerHTML : '<span>Acessar Relatório de Viagem</span>';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>Validando credenciais do motorista...</span>`;
            }

            const cpfLimpo = cpfVal.replace(/\D/g, '');

            if (window.supabaseClient) {
                try {
                    // 1. Procura se existe o motorista pelo CPF na tabela 'perfis'
                    const { data: perfil, error: perfilError } = await window.supabaseClient
                        .from('perfis')
                        .select('*')
                        .eq('cpf', cpfLimpo)
                        .maybeSingle();

                    if (perfilError) {
                        console.warn('Aviso ao consultar perfis por CPF:', perfilError);
                    }

                    // Se não tiver perfil com esse CPF cadastrado
                    if (!perfil) {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = textoOriginalBtn;
                        }
                        showToast('Motorista não cadastrado! Verifique seu CPF ou realize o cadastro.', 'error');
                        return;
                    }

                    // Determina o e-mail cadastrado no Auth do Supabase
                    const emailAuth = perfil.email || `${cpfLimpo}@motorista.ajborges.com`;

                    // 2. Valida a senha com a tabela perfis ou Supabase Auth
                    let senhaValida = false;
                    if (perfil.senha) {
                        senhaValida = (perfil.senha === senhaVal);
                        if (!senhaValida) {
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = textoOriginalBtn;
                            }
                            showToast('Senha incorreta para este CPF. Tente novamente!', 'error');
                            return;
                        }
                    } else {
                        const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
                            email: emailAuth,
                            password: senhaVal
                        });

                        if (authError) {
                            console.error('Falha de login do motorista no Supabase:', authError);
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = textoOriginalBtn;
                            }

                            if (authError.message.includes('Invalid login credentials')) {
                                showToast('Senha de motorista incorreta!', 'error');
                            } else if (authError.message.includes('Email not confirmed')) {
                                showToast('Cadastro pendente de confirmação no Supabase.', 'error');
                            } else {
                                showToast(`Erro ao autenticar: ${authError.message}`, 'error');
                            }
                            return;
                        }
                    }

                    // Usuário autenticado com sucesso!
                    const usuarioSupabase = authData.user;
                    const nomeMotorista = perfil.nome || usuarioSupabase.user_metadata?.nome || 'Motorista AJBorges';

                    localStorage.setItem('ajborges_usuario_ativo', JSON.stringify({
                        role: 'motorista',
                        id: usuarioSupabase.id,
                        nome: nomeMotorista,
                        cpf: cpfVal,
                        telefone: perfil.telefone || ''
                    }));

                    showToast('Login de Motorista realizado com sucesso! Redirecionando...', 'success');

                    setTimeout(() => {
                        window.location.href = 'relatorio-viagem.html';
                    }, 1000);
                } catch (err) {
                    console.error('Erro inesperado no login do motorista:', err);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginalBtn;
                    }
                    showToast('Não foi possível conectar ao servidor de login.', 'error');
                }
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginalBtn;
                }
                showToast('Servidor de autenticação indisponível no momento.', 'error');
            }
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

            const submitBtn = formAdmin.querySelector('.btn-submit');
            const textoOriginalBtn = submitBtn ? submitBtn.innerHTML : '<span>Acessar Painel Gestor</span>';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>Validando credenciais...</span>`;
            }

            // Autenticação Real com Supabase
            if (window.supabaseClient) {
                try {
                    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                        email: emailVal,
                        password: senhaVal
                    });

                    if (error) {
                        console.error('Falha de login no Supabase:', error);
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = textoOriginalBtn;
                        }
                        if (error.message.includes('Invalid login credentials')) {
                            showToast('E-mail ou senha de administrador incorretos!', 'error');
                        } else if (error.message.includes('Email not confirmed')) {
                            showToast('E-mail ainda não confirmado no painel do Supabase.', 'error');
                        } else {
                            showToast(`Erro ao autenticar: ${error.message}`, 'error');
                        }
                        return;
                    }

                    // Usuário autenticado com sucesso!
                    const usuarioSupabase = data.user;
                    console.log('✅ Administrador autenticado no Supabase:', usuarioSupabase);

                    // Busca dados adicionais do perfil (se cadastrado)
                    let nomeGestor = usuarioSupabase.user_metadata?.nome || 'Administrador AJBorges';
                    try {
                        const { data: perfil } = await window.supabaseClient
                            .from('perfis')
                            .select('nome, role')
                            .eq('email', emailVal)
                            .maybeSingle();

                        if (perfil) {
                            if (perfil.nome) nomeGestor = perfil.nome;
                        } else {
                            // Registra o perfil de admin caso ainda não exista na tabela
                            await window.supabaseClient.from('perfis').insert({
                                id: usuarioSupabase.id,
                                nome: nomeGestor,
                                email: emailVal,
                                role: 'admin'
                            });
                        }
                    } catch (ePerfil) {
                        console.warn('Erro ao consultar tabela perfis:', ePerfil);
                    }

                    // Salva sessão administrativa segura
                    localStorage.setItem('ajborges_usuario_ativo', JSON.stringify({
                        role: 'admin',
                        id: usuarioSupabase.id,
                        nome: nomeGestor,
                        email: emailVal
                    }));

                    showToast('Autenticação de Administrador aprovada! Acessando painel...', 'success');

                    setTimeout(() => {
                        window.location.href = 'dashboard-admin.html';
                    }, 1000);
                } catch (err) {
                    console.error('Erro inesperado no login do admin:', err);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginalBtn;
                    }
                    showToast('Não foi possível conectar ao servidor de login.', 'error');
                }
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginalBtn;
                }
                showToast('Servidor de autenticação indisponível no momento.', 'error');
            }
        });
    }
});
