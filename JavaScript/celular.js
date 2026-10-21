// ==========================================
// AJBorges - Ajustes de celular (ficha de viagem, cadastro, login e recuperação de senha)
// - O campo em uso não fica escondido atrás do teclado
// - Erro de validação aparece logo abaixo do campo, e a tela rola até o primeiro
// ==========================================
(function () {
    const CAMPOS = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), select, textarea';
    const ehCelular = () => window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;

    // Altura do header fixo (no celular ele rola com a página e não conta)
    function alturaHeaderFixo() {
        const header = document.querySelector('header');
        if (!header || getComputedStyle(header).position !== 'fixed') return 0;
        return header.offsetHeight;
    }

    // Campo fora da área visível (atrás do header ou do teclado)?
    function campoEscondido(el) {
        const r = el.getBoundingClientRect();
        const vv = window.visualViewport;
        const fundo = vv ? vv.height + vv.offsetTop : window.innerHeight;
        return r.top < alturaHeaderFixo() + 8 || r.bottom > fundo - 12;
    }

    // 1. Teclado: depois que ele abre, traz o campo em uso para o meio da tela
    document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (!el.matches || !el.matches(CAMPOS) || !ehCelular()) return;
        setTimeout(() => {
            if (document.activeElement === el && campoEscondido(el)) {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }, 350);
    });
    // O teclado muda a área visível: confere de novo o campo em uso
    if (window.visualViewport) {
        let espera = null;
        window.visualViewport.addEventListener('resize', () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                const el = document.activeElement;
                if (el && el.matches && el.matches(CAMPOS) && ehCelular() && campoEscondido(el)) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 120);
        });
    }

    // 2. Erros perto do campo
    function blocoDoCampo(el) {
        return el.closest('.form-group, .campo-grupo, .subfield-group, .caixa-sem-pdf, .linha-despesa-item, td') ||
            el.parentElement;
    }

    function limparErroCampo(el) {
        const bloco = blocoDoCampo(el);
        const aviso = bloco && bloco.querySelector(':scope > .erro-campo-celular');
        if (aviso) aviso.remove();
        el.removeAttribute('aria-invalid');
    }

    function mostrarErroCampo(el, mensagem) {
        const bloco = blocoDoCampo(el);
        if (!bloco || !mensagem) return;
        let aviso = bloco.querySelector(':scope > .erro-campo-celular');
        if (!aviso) {
            aviso = document.createElement('small');
            aviso.className = 'erro-campo-celular';
            aviso.setAttribute('role', 'alert');
            bloco.appendChild(aviso);
        }
        aviso.textContent = mensagem;
        el.setAttribute('aria-invalid', 'true');
    }

    // O navegador dispara "invalid" para cada campo com problema; rola só até o primeiro
    let rolouNesteEnvio = false;
    document.addEventListener('invalid', (e) => {
        const el = e.target;
        if (!el.matches || !el.matches(CAMPOS + ', input[type="checkbox"]')) return;
        mostrarErroCampo(el, el.validationMessage);
        if (!rolouNesteEnvio) {
            rolouNesteEnvio = true;
            setTimeout(() => { rolouNesteEnvio = false; }, 600);
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, true);

    const aoCorrigir = (e) => {
        const el = e.target;
        if (el.matches && el.getAttribute('aria-invalid') === 'true' && el.checkValidity()) limparErroCampo(el);
    };
    document.addEventListener('input', aoCorrigir);
    document.addEventListener('change', aoCorrigir);

    // Estilo do aviso (o mesmo nas quatro páginas)
    const estilo = document.createElement('style');
    estilo.textContent = `
        .erro-campo-celular { display: block; margin-top: 6px; color: #b91c1c; font-size: 13px; font-weight: 600; line-height: 1.35; }
        [aria-invalid="true"] { border-color: #dc2626 !important; }`;
    document.head.appendChild(estilo);

    window.ajbCelular = { mostrarErroCampo, limparErroCampo, ehCelular };
})();
