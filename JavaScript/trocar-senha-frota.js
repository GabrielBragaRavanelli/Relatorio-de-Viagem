/**
 * AJBorges - Aviso de senha provisória (motoristas da FROTA)
 *
 * A gestão cadastra a frota com uma senha provisória (6 primeiros dígitos do
 * CPF + "@frota"). Enquanto perfis.senha_provisoria = true, a ficha de viagem
 * mostra este modal em todo acesso (não é obrigatório: "Agora não" fecha).
 *
 * Passos:
 *   1. Confirmar identidade (nome completo + CPF, comparados com o perfil)
 *   2. E-mail -> supabaseClient.auth.updateUser({ email }) manda um código
 *      (modelo "Change Email Address") para o e-mail novo
 *   3. Código -> verifyOtp({ email, token, type: 'email_change' })
 *   4. Senha nova (regra do senha.js + diferente da provisória)
 *      -> updateUser({ password }). O trigger do passo 9 põe
 *      senha_provisoria = false, então o modal não volta.
 * Quem já tem e-mail de verdade pula os passos 2 e 3.
 *
 * Chamado por relatorio.js: window.ajbSenhaFrota.iniciar(usuarioSessao).
 * Nunca registra senha, código ou CPF no console.
 */
(function () {
    const DOMINIO_SEM_EMAIL = '@sem-email.ajborges.com.br';
    const INTERVALO_REENVIO = 60; // segundos (limite do Supabase para reenviar)

    let perfil = null;          // { nome, cpf, email }
    let temEmail = false;
    let emailNovo = '';
    let etapas = [];            // etapas visíveis no indicador
    let timerReenvio = null;

    const $ = (id) => document.getElementById(id);

    // ---------- Utilidades ----------
    function normalizarNome(v) {
        return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    const senhaProvisoria = (cpf) => `${soDigitos(cpf).slice(0, 6)}@frota`;

    function mascaraCpf(v) {
        const d = soDigitos(v).slice(0, 11);
        return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    // Erros do Supabase Auth em português
    function traduzirErro(error, padrao) {
        const msg = String((error && error.message) || '');
        const codigo = String((error && error.code) || '');
        if (codigo === 'email_exists' || /already been registered|already registered|email.*(exists|in use)/i.test(msg)) {
            return 'Este e-mail já está em uso.';
        }
        const espera = msg.match(/after (\d+) seconds?/i);
        if (espera) return `Aguarde ${espera[1]} segundos para pedir outro código.`;
        if (codigo === 'over_email_send_rate_limit' || /rate limit|too many/i.test(msg)) {
            return 'Muitos pedidos de código. Aguarde alguns minutos e tente de novo.';
        }
        if (codigo === 'email_address_invalid' || /invalid.*email|email.*invalid|unable to validate email/i.test(msg)) {
            return 'Este e-mail não é válido. Confira e tente de novo.';
        }
        if (codigo === 'same_password' || /different from the old/i.test(msg)) {
            return 'A senha nova precisa ser diferente da anterior.';
        }
        if (codigo === 'weak_password' || /weak|password should/i.test(msg)) {
            return 'Essa senha é fraca demais. Escolha outra seguindo a dica.';
        }
        if (codigo === 'reauthentication_needed' || /reauthenticat/i.test(msg)) {
            return 'Por segurança, saia e entre de novo antes de trocar a senha.';
        }
        if (/jwt|session|not authenticated|expired/i.test(msg)) {
            return 'Sua sessão expirou. Saia e entre de novo.';
        }
        return padrao;
    }

    // ---------- Modal e etapas ----------
    function mostrarAlerta(texto, tipo) {
        const el = $('msf-alerta');
        if (!el) return;
        el.textContent = texto || '';
        el.className = 'msf-alerta' + (tipo === 'ok' ? ' msf-alerta-ok' : '');
        el.hidden = !texto;
    }

    function irPara(etapa) {
        mostrarAlerta('');
        document.querySelectorAll('#modal-senha-frota .msf-etapa').forEach((s) => {
            s.hidden = s.getAttribute('data-etapa') !== etapa;
        });
        const lista = $('msf-passos');
        if (lista) {
            lista.hidden = etapa === 'sucesso';
            const atual = etapas.findIndex((e) => e.id === (etapa === 'codigo' ? 'email' : etapa));
            lista.innerHTML = etapas.map((e, i) => `
                <li class="${i < atual ? 'feito' : i === atual ? 'atual' : ''}">
                    <span class="msf-passo-num">${i < atual ? '✓' : i + 1}</span>
                    <span class="msf-passo-nome">${e.nome}</span>
                </li>`).join('');
        }
        const foco = { identidade: 'msf-nome', email: 'msf-email', codigo: 'msf-codigo', senha: 'msf-senha' }[etapa];
        if (foco) setTimeout(() => $(foco)?.focus(), 50);
    }

    function abrir() {
        const modal = $('modal-senha-frota');
        if (!modal) return;
        etapas = temEmail
            ? [{ id: 'identidade', nome: 'Identidade' }, { id: 'senha', nome: 'Senha nova' }]
            : [{ id: 'identidade', nome: 'Identidade' }, { id: 'email', nome: 'E-mail' }, { id: 'senha', nome: 'Senha nova' }];
        irPara('identidade');
        modal.classList.add('ativo');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('msf-aberto');
    }

    function fechar() {
        const modal = $('modal-senha-frota');
        if (!modal) return;
        modal.classList.remove('ativo');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('msf-aberto');
        ['msf-senha', 'msf-senha-confirmar', 'msf-codigo'].forEach((id) => { if ($(id)) $(id).value = ''; });
        if (timerReenvio) clearInterval(timerReenvio);
    }

    async function travar(botao, texto, fn) {
        const original = botao.textContent;
        botao.disabled = true;
        botao.textContent = texto;
        try { return await fn(); } finally {
            botao.disabled = false;
            botao.textContent = original;
        }
    }

    // ---------- Passo 1: identidade ----------
    function confirmarIdentidade() {
        const nomeOk = normalizarNome($('msf-nome').value) === normalizarNome(perfil.nome);
        const cpfOk = soDigitos($('msf-cpf').value) === soDigitos(perfil.cpf);
        if (!nomeOk || !cpfOk) {
            mostrarAlerta('Os dados não conferem com o cadastro da frota. Fale com a gestão.');
            return;
        }
        atualizarExemplos();
        avaliarSenha();
        irPara(temEmail ? 'senha' : 'email');
    }

    // ---------- Passos 2 e 3: e-mail e código ----------
    function iniciarContagemReenvio() {
        const botao = $('msf-btn-reenviar');
        let restante = INTERVALO_REENVIO;
        if (timerReenvio) clearInterval(timerReenvio);
        const atualizar = () => {
            botao.disabled = restante > 0;
            botao.textContent = restante > 0 ? `Reenviar código (${restante}s)` : 'Reenviar código';
        };
        atualizar();
        timerReenvio = setInterval(() => {
            restante--;
            atualizar();
            if (restante <= 0) clearInterval(timerReenvio);
        }, 1000);
    }

    async function pedirCodigo() {
        const { error } = await window.supabaseClient.auth.updateUser({ email: emailNovo });
        if (error) {
            mostrarAlerta(traduzirErro(error, 'Não foi possível enviar o código. Tente novamente.'));
            return false;
        }
        return true;
    }

    async function enviarCodigo() {
        const email = $('msf-email').value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email.endsWith(DOMINIO_SEM_EMAIL)) {
            mostrarAlerta('Digite um e-mail válido.');
            return;
        }
        emailNovo = email;
        const ok = await travar($('msf-btn-enviar-codigo'), 'Enviando...', pedirCodigo);
        if (!ok) return;
        $('msf-email-destino').textContent = emailNovo;
        $('msf-codigo').value = '';
        irPara('codigo');
        mostrarAlerta('Código enviado! Confira seu e-mail.', 'ok');
        iniciarContagemReenvio();
    }

    async function reenviarCodigo() {
        mostrarAlerta('');
        const ok = await pedirCodigo();
        if (!ok) return;
        mostrarAlerta('Enviamos um novo código.', 'ok');
        iniciarContagemReenvio();
    }

    async function confirmarCodigo() {
        const token = soDigitos($('msf-codigo').value);
        if (token.length < 6) {
            mostrarAlerta('Digite o código que chegou no seu e-mail.');
            return;
        }
        await travar($('msf-btn-confirmar-codigo'), 'Conferindo...', async () => {
            const { error } = await window.supabaseClient.auth.verifyOtp({ email: emailNovo, token, type: 'email_change' });
            if (error) {
                mostrarAlerta('Código inválido ou expirado.');
                return;
            }
            if (timerReenvio) clearInterval(timerReenvio);
            temEmail = true; // o trigger do passo 9 copiou o e-mail para o perfil
            irPara('senha');
            mostrarAlerta('E-mail confirmado! Agora crie sua senha nova.', 'ok');
        });
    }

    // ---------- Passo 4: senha nova ----------
    function atualizarExemplos() {
        const ex = window.ajbSenha.exemplos(perfil.cpf);
        ['msf-exemplo-1', 'msf-exemplo-2', 'msf-exemplo-3'].forEach((id, i) => { if ($(id)) $(id).textContent = ex[i]; });
    }

    function regrasSenha(senha) {
        const r = window.ajbSenha.regras(senha, perfil.cpf);
        r.provisoria = !!senha && senha.toLowerCase() !== senhaProvisoria(perfil.cpf).toLowerCase();
        return r;
    }

    function avaliarSenha() {
        const r = regrasSenha($('msf-senha').value);
        document.querySelectorAll('#modal-senha-frota [data-req]').forEach((li) => {
            const ok = r[li.getAttribute('data-req')] === true;
            li.classList.toggle('valido', ok);
            li.querySelector('.msf-req-icone').textContent = ok ? '✓' : '✕';
        });
        conferirConfirmacao();
    }

    function conferirConfirmacao() {
        const el = $('msf-conferencia');
        const confirmar = $('msf-senha-confirmar').value;
        if (!confirmar) { el.textContent = ''; el.className = 'msf-conferencia'; return; }
        const igual = confirmar === $('msf-senha').value;
        el.textContent = igual ? '✓ As senhas coincidem' : '✕ As senhas digitadas não coincidem';
        el.className = 'msf-conferencia ' + (igual ? 'ok' : 'erro');
    }

    async function salvarSenha() {
        const senha = $('msf-senha').value;
        const problema = window.ajbSenha.erro(senha, perfil.cpf);
        if (problema) { mostrarAlerta(problema); return; }
        if (!regrasSenha(senha).provisoria) {
            mostrarAlerta('A senha nova não pode ser igual à senha provisória.');
            return;
        }
        if (senha !== $('msf-senha-confirmar').value) {
            mostrarAlerta('As senhas não coincidem. Digite novamente.');
            return;
        }
        await travar($('msf-btn-salvar-senha'), 'Salvando...', async () => {
            const { error } = await window.supabaseClient.auth.updateUser({ password: senha });
            if (error) {
                mostrarAlerta(traduzirErro(error, 'Não foi possível salvar a senha nova. Tente novamente.'));
                return;
            }
            $('msf-senha').value = '';
            $('msf-senha-confirmar').value = '';
            irPara('sucesso');
        });
    }

    // ---------- Ligações ----------
    function ligarEventos() {
        const modal = $('modal-senha-frota');
        modal.addEventListener('click', (e) => {
            const alvo = e.target.closest('[data-msf]');
            if (!alvo) return;
            const acao = alvo.getAttribute('data-msf');
            if (acao === 'agora-nao' || acao === 'fechar') fechar();
            if (acao === 'olho') {
                const input = alvo.parentElement.querySelector('input');
                const mostrar = input.type === 'password';
                input.type = mostrar ? 'text' : 'password';
                alvo.textContent = mostrar ? 'Ocultar' : 'Mostrar';
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('ativo')) fechar();
        });

        $('msf-cpf').addEventListener('input', (e) => { e.target.value = mascaraCpf(e.target.value); });
        $('msf-codigo').addEventListener('input', (e) => { e.target.value = soDigitos(e.target.value).slice(0, 8); });
        $('msf-senha').addEventListener('input', avaliarSenha);
        $('msf-senha-confirmar').addEventListener('input', conferirConfirmacao);

        $('msf-btn-identidade').addEventListener('click', confirmarIdentidade);
        $('msf-btn-enviar-codigo').addEventListener('click', enviarCodigo);
        $('msf-btn-reenviar').addEventListener('click', reenviarCodigo);
        $('msf-btn-trocar-email').addEventListener('click', () => {
            if (timerReenvio) clearInterval(timerReenvio);
            irPara('email');
        });
        $('msf-btn-confirmar-codigo').addEventListener('click', confirmarCodigo);
        $('msf-btn-salvar-senha').addEventListener('click', salvarSenha);

        // Enter avança na etapa visível
        const enter = { 'msf-nome': 'msf-btn-identidade', 'msf-cpf': 'msf-btn-identidade', 'msf-email': 'msf-btn-enviar-codigo',
            'msf-codigo': 'msf-btn-confirmar-codigo', 'msf-senha-confirmar': 'msf-btn-salvar-senha' };
        Object.entries(enter).forEach(([campo, botao]) => {
            $(campo).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); $(botao).click(); }
            });
        });
    }

    /**
     * Confere o perfil do motorista logado e abre o modal se a senha ainda for a provisória.
     * @param {{ role: string, id: string }} usuario sessão validada por auth.js
     */
    async function iniciar(usuario) {
        if (!usuario || usuario.role !== 'motorista' || !window.supabaseClient || !$('modal-senha-frota')) return;
        try {
            const { data, error } = await window.supabaseClient.from('perfis')
                .select('nome, cpf, email, senha_provisoria')
                .eq('id', usuario.id)
                .maybeSingle();
            if (error || !data || data.senha_provisoria !== true) return;
            perfil = { nome: data.nome || '', cpf: data.cpf || '', email: data.email || '' };
            temEmail = !!perfil.email && !perfil.email.toLowerCase().endsWith(DOMINIO_SEM_EMAIL);
            ligarEventos();
            abrir();
        } catch (e) {
            console.error('Aviso de senha provisória indisponível.');
        }
    }

    window.ajbSenhaFrota = { iniciar };
})();
