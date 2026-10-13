/**
 * ==========================================================================
 * AJBorges - Controle de Sessão (Supabase Auth)
 *
 * Fonte da verdade = sessão do Supabase (token JWT validado no servidor).
 * O papel (admin / diretoria / motorista) vem SEMPRE de app_metadata.role,
 * que só o servidor consegue alterar.
 *
 * A chave antiga 'ajborges_usuario_ativo' do localStorage continua existindo
 * só como CACHE para o código legado das telas; ela é regravada a partir da
 * sessão real toda vez que uma página protegida abre. Editar essa chave no
 * navegador não dá acesso a nada: os dados são protegidos pela RLS.
 *
 * Ordem dos scripts na página:
 *   supabase-js (CDN) -> supabase-client.js -> auth.js -> script da página
 * ==========================================================================
 */
(function () {
    const CHAVE_USUARIO = 'ajborges_usuario_ativo';
    // Caches locais com dados de fichas/cadastros: apagados no logout
    const CHAVES_SENSIVEIS = [
        'ajborges_usuario_ativo',
        'ajborges_fichas_viagem',
        'ajborges_relatorio_viagem_ml_draft'
    ];

    function cliente() {
        return window.supabaseClient || null;
    }

    function papelDe(user) {
        return (user && user.app_metadata && user.app_metadata.role) || null;
    }

    function formatarCpf(cpf) {
        const d = String(cpf || '').replace(/\D/g, '');
        return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
    }

    function mostrarPagina() {
        document.documentElement.style.visibility = '';
    }

    function limparDadosLocais() {
        CHAVES_SENSIVEIS.forEach((k) => {
            try { localStorage.removeItem(k); } catch (e) { /* ignora */ }
        });
    }

    /**
     * Grava a sessão devolvida pela edge function 'login'.
     */
    async function definirSessao(session) {
        const c = cliente();
        if (!c || !session) throw new Error('Sessão inválida.');
        const { error } = await c.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
        });
        if (error) throw error;
    }

    /**
     * Confere a sessão no servidor e o papel do usuário.
     * Se não puder entrar, redireciona e devolve null.
     * @param {string[]} papeisPermitidos ex.: ['admin','diretoria']
     * @param {string} destinoSemAcesso ex.: 'Login.html#admin'
     */
    async function exigir(papeisPermitidos, destinoSemAcesso) {
        const c = cliente();
        const negar = () => {
            limparDadosLocais();
            window.location.replace(destinoSemAcesso || 'Login.html');
            return null;
        };
        if (!c) return negar();

        try {
            // getUser() valida o token no servidor (getSession() só lê o local)
            const { data, error } = await c.auth.getUser();
            const user = data && data.user;
            if (error || !user) return negar();

            const papel = papelDe(user);
            if (!papeisPermitidos.includes(papel)) return negar();

            let perfil = {};
            try {
                const r = await c.from('perfis')
                    .select('nome, cpf, telefone, email')
                    .eq('id', user.id)
                    .maybeSingle();
                if (r.data) perfil = r.data;
            } catch (e) { /* segue com o que tiver */ }

            const info = {
                role: papel,
                id: user.id,
                nome: perfil.nome || (user.user_metadata && user.user_metadata.nome) || '',
                email: user.email || perfil.email || '',
                cpf: formatarCpf(perfil.cpf),
                telefone: perfil.telefone || ''
            };
            localStorage.setItem(CHAVE_USUARIO, JSON.stringify(info));
            mostrarPagina();
            return info;
        } catch (e) {
            console.error('Falha ao validar a sessão:', e);
            return negar();
        }
    }

    /**
     * Executa fn(info) quando o DOM estiver pronto E a sessão validada.
     */
    function aoAutenticar(papeisPermitidos, destinoSemAcesso, fn) {
        const domPronto = new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            } else {
                resolve();
            }
        });
        Promise.all([domPronto, exigir(papeisPermitidos, destinoSemAcesso)])
            .then(([, info]) => { if (info) fn(info); });
    }

    async function sair(destino) {
        const c = cliente();
        try { if (c) await c.auth.signOut(); } catch (e) { /* ignora */ }
        limparDadosLocais();
        try { sessionStorage.clear(); } catch (e) { /* ignora */ }
        window.location.href = destino || 'Login.html';
    }

    // Se a sessão cair (logout em outra aba, token revogado), sai da página protegida
    function vigiarSessao(destino) {
        const c = cliente();
        if (!c) return;
        c.auth.onAuthStateChange((evento) => {
            if (evento === 'SIGNED_OUT') {
                limparDadosLocais();
                window.location.replace(destino || 'Login.html');
            }
        });
    }

    window.ajbAuth = { exigir, aoAutenticar, sair, definirSessao, papelDe, vigiarSessao, limparDadosLocais };
    window.ajbAoAutenticar = aoAutenticar;
})();
