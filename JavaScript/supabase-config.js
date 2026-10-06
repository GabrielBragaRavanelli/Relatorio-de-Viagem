/**
 * Supabase Config & Services - AJBorges Transporte & Logística
 * Inicializa o cliente do Supabase e disponibiliza funções centralizadas
 * para busca de perfis, cadastro, login e recuperação de senha.
 */

const SUPABASE_CONFIG = {
    url: 'https://pnvjeismjgseooiyjjjb.supabase.co',
    anonKey: 'sb_publishable_JJpfaiILR7BJd8rYCCoi4A_uP50-Xwe'
};

// Inicializa o cliente oficial do Supabase na janela global
if (window.supabase && !window.supabaseClient) {
    try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase Client inicializado com sucesso.');
    } catch (e) {
        console.error('Erro ao inicializar Supabase Client:', e);
    }
}

/**
 * Retorna os headers para chamadas REST diretas
 */
function getSupabaseHeaders() {
    return {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

/**
 * Busca perfil na tabela 'perfis' pelo CPF (apenas dígitos)
 * @param {string} cpf 
 * @returns {Promise<Object|null>}
 */
async function buscarPerfilPorCpf(cpf) {
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    if (!cpfLimpo) return null;

    try {
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('perfis')
                .select('*')
                .eq('cpf', cpfLimpo)
                .maybeSingle();

            if (!error && data) return data;
        }

        // Fallback REST direto
        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/perfis?cpf=eq.${cpfLimpo}&select=*`, {
            headers: getSupabaseHeaders()
        });
        if (!resp.ok) return null;
        const dados = await resp.json();
        return (dados && dados.length > 0) ? dados[0] : null;
    } catch (e) {
        console.error('Erro ao buscar perfil por CPF:', e);
        return null;
    }
}

/**
 * Busca perfil na tabela 'perfis' por E-mail (para Administradores)
 * @param {string} email 
 * @returns {Promise<Object|null>}
 */
async function buscarPerfilPorEmail(email) {
    const emailLimpo = (email || '').trim().toLowerCase();
    if (!emailLimpo) return null;

    try {
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('perfis')
                .select('*')
                .eq('email', emailLimpo)
                .maybeSingle();

            if (!error && data) return data;
        }

        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/perfis?email=eq.${encodeURIComponent(emailLimpo)}&select=*`, {
            headers: getSupabaseHeaders()
        });
        if (!resp.ok) return null;
        const dados = await resp.json();
        return (dados && dados.length > 0) ? dados[0] : null;
    } catch (e) {
        console.error('Erro ao buscar perfil por e-mail:', e);
        return null;
    }
}

/**
 * Cadastra motorista no Supabase (Auth + Tabela perfis)
 * @param {Object} param0 
 * @returns {Promise<{sucesso: boolean, erro?: string, dados?: Object}>}
 */
async function cadastrarMotoristaSupabase({ nome, cpf, telefone, email, senha }) {
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    const emailFinal = (email || '').trim() || `${cpfLimpo}@motorista.ajborges.com`;

    // 1. Verifica se já existe perfil com esse CPF
    const existente = await buscarPerfilPorCpf(cpfLimpo);
    if (existente) {
        return { sucesso: false, erro: 'Este CPF já está cadastrado no sistema.' };
    }

    let authUserId = null;

    // 2. Tenta criar usuário no Supabase Auth
    try {
        const authResp = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailFinal,
                password: senha,
                data: {
                    nome: nome.trim(),
                    cpf: cpfLimpo,
                    telefone: (telefone || '').trim() || null,
                    role: 'motorista'
                }
            })
        });

        if (authResp.ok) {
            const authJson = await authResp.json();
            authUserId = authJson.id || authJson.user?.id || null;
        }
    } catch (eAuth) {
        console.warn('Aviso no signUp do Supabase Auth:', eAuth);
    }

    // 3. Grava registro na tabela 'perfis'
    const payload = {
        nome: nome.trim(),
        cpf: cpfLimpo,
        telefone: (telefone || '').trim() || null,
        email: emailFinal,
        role: 'motorista',
        senha: senha
    };
    if (authUserId) payload.id = authUserId;

    try {
        let resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/perfis`, {
            method: 'POST',
            headers: getSupabaseHeaders(),
            body: JSON.stringify(payload)
        });

        // Caso a coluna 'senha' ainda não tenha sido adicionada na tabela perfis, tenta sem ela
        if (!resp.ok) {
            const errJson = await resp.json().catch(() => ({}));
            if (errJson.message && errJson.message.toLowerCase().includes('senha')) {
                const payloadSemSenha = { ...payload };
                delete payloadSemSenha.senha;
                resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/perfis`, {
                    method: 'POST',
                    headers: getSupabaseHeaders(),
                    body: JSON.stringify(payloadSemSenha)
                });
            } else {
                return { sucesso: false, erro: errJson.message || 'Erro ao gravar na tabela perfis.' };
            }
        }

        if (resp.ok) {
            const salvo = await resp.json();
            return { sucesso: true, dados: salvo[0] || salvo };
        } else {
            const err = await resp.json().catch(() => ({}));
            return { sucesso: false, erro: err.message || 'Erro ao salvar perfil.' };
        }
    } catch (e) {
        console.error('Erro ao cadastrar motorista:', e);
        return { sucesso: false, erro: 'Falha de comunicação com o Supabase.' };
    }
}

/**
 * Atualiza a senha de um motorista pelo CPF (Recuperação de Senha)
 * @param {string} cpf 
 * @param {string} novaSenha 
 * @returns {Promise<{sucesso: boolean, erro?: string}>}
 */
async function atualizarSenhaSupabase(cpf, novaSenha) {
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    if (!cpfLimpo) return { sucesso: false, erro: 'CPF inválido.' };

    try {
        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/perfis?cpf=eq.${cpfLimpo}`, {
            method: 'PATCH',
            headers: getSupabaseHeaders(),
            body: JSON.stringify({ senha: novaSenha })
        });

        if (resp.ok) {
            return { sucesso: true };
        } else {
            const err = await resp.json().catch(() => ({}));
            if (err.message && err.message.toLowerCase().includes('senha')) {
                return { sucesso: false, erro: 'A coluna "senha" precisa ser adicionada na tabela "perfis" do Supabase (tipo text).' };
            }
            return { sucesso: false, erro: err.message || 'Não foi possível atualizar a senha no Supabase.' };
        }
    } catch (e) {
        console.error('Erro ao atualizar senha:', e);
        return { sucesso: false, erro: 'Falha de comunicação com o Supabase.' };
    }
}
