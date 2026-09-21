/**
 * Recuperação de Senha - AJBorges Transporte & Logística
 * Fluxo simplificado e direto para motoristas:
 * 1. Identificação por CPF
 * 2. Criação da Nova Senha
 * 3. Confirmação e Redirecionamento com CPF pré-preenchido no Login.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Estado do Fluxo ---
    let currentStep = 1;
    let savedCpf = '';
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
    const inputCpf = document.getElementById('cpf-recuperar');

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
            if (targetStep === 1 && inputCpf) {
                inputCpf.focus();
            } else if (targetStep === 2 && inputNovaSenha) {
                inputNovaSenha.focus();
            }
        }, 150);

        // Rolagem suave para o card em mobile
        const container = document.querySelector('.recuperar-card');
        if (container && window.innerWidth <= 768) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // =========================================================================
    // 3. PASSO 1: IDENTIFICAÇÃO E MÁSCARA DO CPF
    // =========================================================================

    function atualizarSugestoesCpf(cpfDigits) {
        let prefix = '123456';
        if (cpfDigits && cpfDigits.length >= 6) {
            prefix = cpfDigits.slice(0, 6);
        } else if (cpfDigits && cpfDigits.length > 0) {
            prefix = cpfDigits.padEnd(6, '0');
        }

        if (exemplo1) exemplo1.textContent = `@${prefix}viagem`;
        if (exemplo2) exemplo2.textContent = `${prefix}#2026`;
        if (exemplo3) exemplo3.textContent = `${prefix}viagem@`;
    }

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
            atualizarSugestoesCpf(value.replace(/\D/g, ''));
        });

        inputCpf.addEventListener('keypress', (e) => {
            if (!/\d/.test(e.key) && e.key !== 'Enter') e.preventDefault();
        });
    }

    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();

            const cpfVal = (inputCpf?.value || '').trim();
            const digitosCpf = cpfVal.replace(/\D/g, '');

            if (digitosCpf.length !== 11) {
                showToast('Informe um CPF completo válido (11 dígitos).', 'error');
                inputCpf?.focus();
                return;
            }

            savedCpf = cpfVal;
            atualizarSugestoesCpf(digitosCpf);

            showToast('Identificação confirmada! Defina sua nova senha.', 'info');
            goToStep(2);
        });
    }

    // =========================================================================
    // 4. PASSO 2: CRIAÇÃO E VALIDAÇÃO DA NOVA SENHA
    // =========================================================================

    // Alternar visibilidade da senha (mostrar/ocultar)
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

    // Medidor de força da senha e requisitos
    function avaliarSenha() {
        const senha = inputNovaSenha ? inputNovaSenha.value : '';
        const regexEspecial = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/;

        const temTamanho = senha.length >= 6;
        const temEspecial = regexEspecial.test(senha);
        const temNumero = /\d/.test(senha);

        // Atualiza requisitos visuais
        if (reqTamanho) {
            reqTamanho.classList.toggle('valido', temTamanho);
            const icone = reqTamanho.querySelector('.req-icone');
            if (icone) icone.textContent = temTamanho ? '✓' : '✕';
        }

        if (reqEspecial) {
            reqEspecial.classList.toggle('valido', temEspecial);
            const icone = reqEspecial.querySelector('.req-icone');
            if (icone) icone.textContent = temEspecial ? '✓' : '✕';
        }

        // Reseta barras de força
        if (seg1) seg1.className = 'barra-seg';
        if (seg2) seg2.className = 'barra-seg';
        if (seg3) seg3.className = 'barra-seg';

        if (!senha) {
            if (forcaTextoLabel) forcaTextoLabel.textContent = 'Aguardando senha...';
            return;
        }

        let score = 0;
        if (temTamanho) score++;
        if (temEspecial) score++;
        if (temNumero && senha.length >= 8) score++;

        if (score === 1) {
            if (seg1) seg1.className = 'barra-seg fraca';
            if (forcaTextoLabel) {
                forcaTextoLabel.textContent = 'Fraca';
                forcaTextoLabel.style.color = 'var(--vermelho-perigo)';
            }
        } else if (score === 2) {
            if (seg1) seg1.className = 'barra-seg media';
            if (seg2) seg2.className = 'barra-seg media';
            if (forcaTextoLabel) {
                forcaTextoLabel.textContent = 'Boa';
                forcaTextoLabel.style.color = 'var(--amarelo-alerta)';
            }
        } else if (score >= 3) {
            if (seg1) seg1.className = 'barra-seg forte';
            if (seg2) seg2.className = 'barra-seg forte';
            if (seg3) seg3.className = 'barra-seg forte';
            if (forcaTextoLabel) {
                forcaTextoLabel.textContent = 'Excelente';
                forcaTextoLabel.style.color = 'var(--verde-sucesso)';
            }
        }
    }

    // Conferência das senhas em tempo real
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
            goToStep(1);
        });
    }

    // Submissão do Passo 2 (Salvar Senha)
    if (formStep2) {
        formStep2.addEventListener('submit', (e) => {
            e.preventDefault();

            const senha = (inputNovaSenha?.value || '');
            const confirmar = (inputConfirmarNovaSenha?.value || '');
            const regexEspecial = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/;

            if (senha.length < 6) {
                showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
                inputNovaSenha?.focus();
                return;
            }

            if (!regexEspecial.test(senha)) {
                showToast('A nova senha precisa conter pelo menos um caractere especial (como @, #, $, !).', 'error');
                inputNovaSenha?.focus();
                return;
            }

            if (senha !== confirmar) {
                showToast('As senhas não coincidem. Digite novamente.', 'error');
                inputConfirmarNovaSenha?.focus();
                return;
            }

            // Feedback visual no botão
            const btnSubmit = formStep2.querySelector('.btn-concluir');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span>Salvando nova senha...</span>`;
            }

            // Armazena o CPF no sessionStorage para preenchimento imediato no Login
            if (savedCpf) {
                sessionStorage.setItem('ajborges_cpf_recuperado', savedCpf);
            }

            showToast('Senha alterada com sucesso!', 'success');

            setTimeout(() => {
                goToStep('success');

                // Contagem regressiva de redirecionamento
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
        });
    }
});
