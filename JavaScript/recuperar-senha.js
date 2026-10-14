/**
 * Recuperação de Senha - AJBorges Transporte & Logística
 * 1. O motorista informa o E-MAIL cadastrado (se não existir, a tela bloqueia).
 * 2. Recebe um CÓDIGO no e-mail e digita aqui mesmo.
 * 3. Com o código confirmado, cria a senha nova (regra: 6 primeiros dígitos do
 *    CPF + caractere especial + palavra de 4 letras, mínimo 11 caracteres).
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Estado do Fluxo ---
    let currentStep = 1;
    let emailInformado = '';
    let cpfRecuperado = '';
    let codigoConfirmado = false;
    let toastTimer = null;

    // --- Elementos do DOM ---
    const toast = document.getElementById('recuperar-toast');

    // Panes e Stepper
    const stepPanes = {
        1: document.getElementById('step-pane-1'),
        2: document.getElementById('step-pane-2'),
        'success': document.getElementById('step-pane-success')
    };

    const stepNavs = {
        1: document.getElementById('step-nav-1'),
        2: document.getElementById('step-nav-2')
    };

    const stepLines = {
        '1-2': document.getElementById('line-1-2')
    };

    // Formulários
    const formStep1 = document.getElementById('form-step-1');
    const formStep2 = document.getElementById('form-step-2');

    // Campos Passo 1
    const inputEmail = document.getElementById('email-recuperar');
    const inputCodigo = document.getElementById('codigo-recuperacao');
    const blocoCodigo = document.getElementById('bloco-codigo');
    const blocoNovaSenha = document.getElementById('bloco-nova-senha');
    const btnConfirmarCodigo = document.getElementById('btn-confirmar-codigo');
    const btnReenviarCodigo = document.getElementById('btn-reenviar-codigo');
    const emailDestinoEl = document.getElementById('email-destino-codigo');

    // Campos Passo 2
    const inputNovaSenha = document.getElementById('nova-senha');
    const inputConfirmarNovaSenha = document.getElementById('confirmar-nova-senha');
    const btnVoltarPasso1 = document.getElementById('btn-voltar-passo1');
    const togglePasswordButtons = document.querySelectorAll('.btn-toggle-password');
    const forcaTextoLabel = document.getElementById('forca-texto-label');
    const seg1 = document.getElementById('seg-1');
    const seg2 = document.getElementById('seg-2');
    const seg3 = document.getElementById('seg-3');
    const reqTamanho = document.getElementById('req-tamanho');
    const reqEspecial = document.getElementById('req-especial');
    const reqCpf = document.getElementById('req-cpf');
    const reqPalavra = document.getElementById('req-palavra');
    const conferenciaFeedback = document.getElementById('conferencia-feedback');
    const exemplo1 = document.getElementById('exemplo-senha-1');
    const exemplo2 = document.getElementById('exemplo-senha-2');
    const exemplo3 = document.getElementById('exemplo-senha-3');

    // Redirecionamento
    const timerRedirectEl = document.getElementById('timer-redirect');

    // =========================================================================
    // 1. SISTEMA DE TOAST DE FEEDBACK
    // =========================================================================

    /**
     * Exibe toast acessível com mensagens de status
     * @param {string} message
     * @param {'success'|'error'|'info'} type
     * @param {number} duration
     */
    function showToast(message, type = 'success', duration = 3800) {
        if (!toast) return;

        const messageEl = toast.querySelector('.toast-message');
        const iconEl = toast.querySelector('.toast-icon');

        if (messageEl) messageEl.textContent = message;

        if (iconEl) {
            if (type === 'success') iconEl.textContent = '✓';
            else if (type === 'error') iconEl.textContent = '✕';
            else iconEl.textContent = 'ℹ';
        }

        toast.className = 'recuperar-toast show';
        toast.classList.add(`toast-${type}`);
        toast.setAttribute('aria-hidden', 'false');

        if (toastTimer) clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toast.setAttribute('aria-hidden', 'true');
        }, duration);
    }

    // =========================================================================
    // 2. CONTROLE DO STEPPER E TRANSIÇÃO ENTRE ETAPAS
    // =========================================================================

    /**
     * Alterna a etapa ativa do processo
     * @param {number|'success'} targetStep
     */
    function goToStep(targetStep) {
        currentStep = targetStep;

        // Oculta todas as panes e exibe a alvo
        Object.keys(stepPanes).forEach(stepKey => {
            if (stepPanes[stepKey]) {
                const isActive = stepKey.toString() === targetStep.toString();
                stepPanes[stepKey].classList.toggle('active', isActive);
            }
        });

        // Atualiza Stepper Nav
        if (typeof targetStep === 'number') {
            [1, 2].forEach(stepNum => {
                const nav = stepNavs[stepNum];
                if (!nav) return;

                nav.classList.remove('active', 'completed');

                if (stepNum < targetStep) {
                    nav.classList.add('completed');
                } else if (stepNum === targetStep) {
                    nav.classList.add('active');
                }
            });

            if (stepLines['1-2']) {
                stepLines['1-2'].classList.toggle('completed', targetStep >= 2);
            }
        } else if (targetStep === 'success') {
            [1, 2].forEach(num => {
                if (stepNavs[num]) {
                    stepNavs[num].classList.remove('active');
                    stepNavs[num].classList.add('completed');
                }
            });
            if (stepLines['1-2']) stepLines['1-2'].classList.add('completed');
        }

        // Foco no campo apropriado
        setTimeout(() => {
            if (targetStep === 1 && inputEmail) {
                inputEmail.focus();
            } else if (targetStep === 2) {
                (codigoConfirmado ? inputNovaSenha : inputCodigo)?.focus();
            }
        }, 150);

        // Rolagem suave para o card em mobile
        const container = document.querySelector('.recuperar-card');
        if (container && window.innerWidth <= 768) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }


    // =========================================================================
    // 3. ETAPA 1: E-MAIL CADASTRADO -> ENVIO DO CÓDIGO
    // =========================================================================

    function mostrarBlocoSenha(mostrar) {
        if (blocoCodigo) blocoCodigo.hidden = mostrar;
        if (blocoNovaSenha) blocoNovaSenha.hidden = !mostrar;
    }

    function atualizarExemplos() {
        const ex = window.ajbSenha.exemplos(cpfRecuperado || '123456');
        if (exemplo1) exemplo1.textContent = ex[0];
        if (exemplo2) exemplo2.textContent = ex[1];
        if (exemplo3) exemplo3.textContent = ex[2];
    }

    async function pedirCodigo(botao) {
        const textoOriginal = botao ? botao.innerHTML : '';
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<span>Enviando código...</span>';
        }
        try {
            const r = await solicitarRecuperacaoSenha(emailInformado);
            if (!r.sucesso) {
                showToast(r.erro, 'error', 6000);
                return false;
            }
            showToast('Código enviado! Confira seu e-mail (e a caixa de spam).', 'success', 6000);
            return true;
        } catch (err) {
            console.error(err);
            showToast('Falha ao conectar com o servidor. Tente novamente.', 'error');
            return false;
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = textoOriginal;
            }
        }
    }

    if (formStep1) {
        formStep1.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (inputEmail?.value || '').trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('Informe um e-mail válido.', 'error');
                inputEmail?.focus();
                return;
            }
            emailInformado = email;
            const ok = await pedirCodigo(formStep1.querySelector('button[type="submit"]'));
            if (!ok) return;

            codigoConfirmado = false;
            cpfRecuperado = '';
            if (emailDestinoEl) emailDestinoEl.textContent = email;
            if (inputCodigo) inputCodigo.value = '';
            mostrarBlocoSenha(false);
            goToStep(2);
        });
    }

    if (btnReenviarCodigo) {
        btnReenviarCodigo.addEventListener('click', () => pedirCodigo(btnReenviarCodigo));
    }

    if (inputCodigo) {
        inputCodigo.addEventListener('input', () => {
            inputCodigo.value = inputCodigo.value.replace(/\D/g, '').slice(0, 8);
        });
        inputCodigo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnConfirmarCodigo?.click();
            }
        });
    }

    // =========================================================================
    // 4. ETAPA 2: CÓDIGO -> NOVA SENHA
    // =========================================================================

    if (btnConfirmarCodigo) {
        btnConfirmarCodigo.addEventListener('click', async () => {
            const codigo = (inputCodigo?.value || '').trim();
            if (codigo.length < 6) {
                showToast('Digite o código que chegou no seu e-mail.', 'error');
                inputCodigo?.focus();
                return;
            }
            const textoOriginal = btnConfirmarCodigo.innerHTML;
            btnConfirmarCodigo.disabled = true;
            btnConfirmarCodigo.innerHTML = '<span>Conferindo código...</span>';
            try {
                const r = await verificarCodigoRecuperacao(emailInformado, codigo);
                if (!r.sucesso) {
                    showToast(r.erro, 'error', 6000);
                    return;
                }
                codigoConfirmado = true;
                cpfRecuperado = r.cpf || '';
                atualizarExemplos();
                avaliarSenha();
                mostrarBlocoSenha(true);
                inputNovaSenha?.focus();
                showToast('Código confirmado! Agora crie sua nova senha.', 'success');
            } catch (err) {
                console.error(err);
                showToast('Falha ao conectar com o servidor. Tente novamente.', 'error');
            } finally {
                btnConfirmarCodigo.disabled = false;
                btnConfirmarCodigo.innerHTML = textoOriginal;
            }
        });
    }

    // Alternar visibilidade da senha (mostrar/ocultar)
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

    // Medidor de força da senha e requisitos
    function marcarRequisito(el, ok) {
        if (!el) return;
        el.classList.toggle('valido', !!ok);
        const icone = el.querySelector('.req-icone');
        if (icone) icone.textContent = ok ? '✓' : '✕';
    }

    // Requisitos da senha (mesma regra do cadastro) e medidor de força
    function avaliarSenha() {
        const senha = inputNovaSenha ? inputNovaSenha.value : '';
        const r = window.ajbSenha.regras(senha, cpfRecuperado);
        // Conta sem CPF (ex.: gestão): a regra do CPF não se aplica
        const okCpf = cpfRecuperado ? r.cpf === true : true;

        marcarRequisito(reqTamanho, r.tamanho);
        marcarRequisito(reqCpf, okCpf);
        marcarRequisito(reqEspecial, r.especial);
        marcarRequisito(reqPalavra, r.palavra);
        if (reqCpf) reqCpf.hidden = !cpfRecuperado;

        [seg1, seg2, seg3].forEach((s) => { if (s) s.className = 'barra-seg'; });
        if (!senha) {
            if (forcaTextoLabel) forcaTextoLabel.textContent = 'Aguardando senha...';
            return;
        }
        const pontos = [r.tamanho, okCpf, r.especial, r.palavra].filter(Boolean).length;
        let classe = 'fraca', texto = 'Fraca', cor = 'var(--vermelho-perigo)', barras = [seg1];
        if (pontos === 4) { classe = 'forte'; texto = 'Atende a todos os requisitos'; cor = 'var(--verde-sucesso)'; barras = [seg1, seg2, seg3]; }
        else if (pontos >= 2) { classe = 'media'; texto = 'Quase lá'; cor = 'var(--amarelo-alerta)'; barras = [seg1, seg2]; }
        barras.forEach((s) => { if (s) s.className = `barra-seg ${classe}`; });
        if (forcaTextoLabel) {
            forcaTextoLabel.textContent = texto;
            forcaTextoLabel.style.color = cor;
        }
    }

    function verificarCoincidenciaSenhas() {
        const senha = inputNovaSenha ? inputNovaSenha.value : '';
        const confirmar = inputConfirmarNovaSenha ? inputConfirmarNovaSenha.value : '';

        if (!conferenciaFeedback) return;

        if (!confirmar) {
            conferenciaFeedback.textContent = '';
            conferenciaFeedback.className = 'conferencia-feedback';
            return;
        }

        if (senha === confirmar) {
            conferenciaFeedback.textContent = '✓ As senhas coincidem perfeitamente';
            conferenciaFeedback.className = 'conferencia-feedback sucesso';
        } else {
            conferenciaFeedback.textContent = '✕ As senhas digitadas não coincidem';
            conferenciaFeedback.className = 'conferencia-feedback erro';
        }
    }

    if (inputNovaSenha) {
        inputNovaSenha.addEventListener('input', () => {
            avaliarSenha();
            verificarCoincidenciaSenhas();
        });
    }

    if (inputConfirmarNovaSenha) {
        inputConfirmarNovaSenha.addEventListener('input', verificarCoincidenciaSenhas);
    }

    if (btnVoltarPasso1) {
        btnVoltarPasso1.addEventListener('click', () => {
            if (codigoConfirmado && window.supabaseClient) {
                window.supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
            }
            codigoConfirmado = false;
            goToStep(1);
        });
    }

    // Salvar a nova senha
    if (formStep2) {
        formStep2.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!codigoConfirmado) {
                showToast('Confirme primeiro o código que chegou no seu e-mail.', 'error');
                inputCodigo?.focus();
                return;
            }

            const senha = (inputNovaSenha?.value || '');
            const confirmar = (inputConfirmarNovaSenha?.value || '');
            // Conta sem CPF (ex.: gestão): vale a regra sem a parte do CPF
            const regras = window.ajbSenha.regras(senha, cpfRecuperado);
            const problema = cpfRecuperado
                ? window.ajbSenha.erro(senha, cpfRecuperado)
                : (!regras.tamanho || !regras.especial || !regras.palavra
                    ? 'A senha precisa ter 11 caracteres, um caractere especial e uma palavra de 4 letras.' : null);
            if (problema) {
                showToast(problema, 'error', 5000);
                inputNovaSenha?.focus();
                return;
            }
            if (senha !== confirmar) {
                showToast('As senhas não coincidem. Digite novamente.', 'error');
                inputConfirmarNovaSenha?.focus();
                return;
            }

            const btnSubmit = formStep2.querySelector('.btn-concluir');
            const textoOriginal = btnSubmit ? btnSubmit.innerHTML : '';
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span>Salvando nova senha...</span>';
            }

            try {
                const resultado = await definirNovaSenhaSupabase(senha);
                if (!resultado.sucesso) {
                    showToast(resultado.erro || 'Erro ao salvar a nova senha.', 'error', 5000);
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = textoOriginal;
                    }
                    return;
                }

                showToast('Senha atualizada com sucesso!', 'success', 3500);
                setTimeout(() => {
                    goToStep('success');
                    let segundosRestantes = 3;
                    if (timerRedirectEl) timerRedirectEl.textContent = `${segundosRestantes}s`;
                    const redirectInterval = setInterval(() => {
                        segundosRestantes--;
                        if (timerRedirectEl) timerRedirectEl.textContent = `${segundosRestantes}s`;
                        if (segundosRestantes <= 0) {
                            clearInterval(redirectInterval);
                            window.location.href = 'Login.html#motorista';
                        }
                    }, 1000);
                }, 500);
            } catch (err) {
                console.error('Erro ao atualizar senha:', err);
                showToast('Falha ao conectar com o servidor. Tente novamente.', 'error');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = textoOriginal;
                }
            }
        });
    }

    atualizarExemplos();
    avaliarSenha();
});
