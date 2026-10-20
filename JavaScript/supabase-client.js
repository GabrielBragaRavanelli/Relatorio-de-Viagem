/**
 * ==========================================================================
 * AJBorges Transportes - Cliente de Integração com o Supabase
 * Banco de Dados PostgreSQL em Nuvem, Storage de Comprovantes e Realtime
 * ==========================================================================
 */

// 1. Chaves e Credenciais do Projeto Supabase
const SUPABASE_CONFIG = {
    url: 'https://pnvjeismjgseooiyjjjb.supabase.co', // URL do projeto no Supabase (Bragatest)
    anonKey: 'sb_publishable_JJpfaiILR7BJd8rYCCoi4A_uP50-Xwe' // Chave Pública
};


// 2. Inicialização do Cliente Supabase
let supabaseClient = null;

function inicializarSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            window.supabaseClient = supabaseClient;
            console.log('✅ Supabase conectado com sucesso em:', SUPABASE_CONFIG.url);
            return supabaseClient;
        } catch (e) {
            console.error('❌ Erro ao inicializar Supabase:', e);
            return null;
        }
    } else {
        console.warn('⚠️ SDK do Supabase não encontrado na página.');
        return null;
    }
}

// Tenta inicializar se o SDK já estiver no DOM
if (window.supabase) {
    inicializarSupabase();
} else {
    window.addEventListener('DOMContentLoaded', inicializarSupabase);
}

// ==========================================================================
// 3. OPERAÇÕES DE FICHAS DE VIAGEM (CRUD + REALTIME)
// ==========================================================================

// Valores aceitos em cada abastecimento (iguais aos do banco, passo 11)
const COMBUSTIVEIS_FICHA = ['diesel_s10', 'diesel_s500', 'arla'];
const PLACAS_ABASTECIMENTO = ['principal', 'secundaria'];

// Gestão logada? (cache do auth.js; só decide o que mandar, quem protege é o banco)
function usuarioEhGestao() {
    try {
        const u = JSON.parse(localStorage.getItem('ajborges_usuario_ativo') || 'null');
        return !!(u && (u.role === 'admin' || u.role === 'diretoria'));
    } catch (e) {
        return false;
    }
}

const digitosKmFicha = (valor) => String(valor ?? '').replace(/\D/g, '');

// Abastecimento com combustivel e placa só dos valores aceitos (vazio = ficha antiga)
function normalizarAbastecimento(a) {
    if (!a || typeof a !== 'object') return a;
    return {
        ...a,
        combustivel: COMBUSTIVEIS_FICHA.includes(a.combustivel) ? a.combustivel : '',
        placa: PLACAS_ABASTECIMENTO.includes(a.placa) ? a.placa : ''
    };
}

/**
 * KMs dos dois trechos e placa secundária em dados_completos (sem coluna própria):
 * kmSaida, kmEntrada, placaSecundaria, kmSaida2, kmEntrada2 e, só da gestão,
 * kmTotal1, kmTotal2 e kmTotal. Para o motorista quem calcula os totais é o banco.
 * Só entra o que a ficha traz (fichas antigas continuam como estão).
 */
function comCamposDaViagem(dadosCompletos, ficha, gestao) {
    const dc = { ...dadosCompletos };
    ['kmSaida', 'kmEntrada', 'kmSaida2', 'kmEntrada2'].forEach((chave) => {
        if (ficha[chave] !== undefined) dc[chave] = digitosKmFicha(ficha[chave]);
    });
    const placa = ficha.placaSecundaria ?? ficha.placa_secundaria;
    if (placa !== undefined) dc.placaSecundaria = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (gestao) {
        ['kmTotal1', 'kmTotal2', 'kmTotal'].forEach((chave) => {
            if (ficha[chave] !== undefined) dc[chave] = digitosKmFicha(ficha[chave]);
        });
    } else {
        delete dc.kmTotal1;
        delete dc.kmTotal2;
        delete dc.kmTotal;
    }
    if (Array.isArray(dc.abastecimentos)) dc.abastecimentos = dc.abastecimentos.map(normalizarAbastecimento);
    return dc;
}

/**
 * Converte o objeto da ficha do frontend para as colunas do PostgreSQL
 */
function mapearFichaParaSupabase(ficha) {
    function parseNum(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const limpo = String(val).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        const n = parseFloat(limpo);
        return isNaN(n) ? 0 : n;
    }
    const gestao = usuarioEhGestao();

    return {
        id: ficha.id,
        motorista: ficha.motorista || 'Motorista',
        motorista_cpf: ficha.motorista_cpf || ficha.motoristaCpf || null,
        placas: ficha.placas || null,
        data_saida: ficha.data_saida ? formatarDataParaIso(ficha.data_saida) : (ficha.dataSaida ? formatarDataParaIso(ficha.dataSaida) : null),
        data_chegada: ficha.data_chegada ? formatarDataParaIso(ficha.data_chegada) : (ficha.dataChegada ? formatarDataParaIso(ficha.dataChegada) : null),
        km_saida: parseNum(ficha.km_saida ?? ficha.kmSaida),
        km_chegada: parseNum(ficha.km_chegada ?? ficha.kmEntrada ?? ficha.kmChegada),
        // KM da viagem toda; para o motorista o banco calcula
        km_total: gestao ? parseNum(ficha.km_total ?? ficha.kmTotal) : null,
        destino_inicial: ficha.destino_inicial || ficha.destinoInicial || null,
        destino_final: ficha.destino_final || ficha.destinoFinal || null,
        frete_origem: parseNum(ficha.frete_origem ?? ficha.freteOrigem),
        retorno_1: parseNum(ficha.retorno_1 ?? ficha.retorno1),
        retorno_2: parseNum(ficha.retorno_2 ?? ficha.retorno2),
        retorno_3: parseNum(ficha.retorno_3 ?? ficha.retorno3),
        total_frete: parseNum(ficha.total_frete ?? ficha.totalFrete),
        vr_comissao: parseNum(ficha.vr_comissao ?? ficha.vrComissao),
        valor_adiantamento: parseNum(ficha.valor_adiantamento ?? ficha.valorAdiantamento),
        media_km_l: parseNum(ficha.media_km_l ?? ficha.mediaKmL),
        saldo_comissao: parseNum(ficha.saldo_comissao ?? ficha.saldoComissao),
        total_despesas: parseNum(ficha.total_despesas ?? ficha.totalDespesas),
        abastecimentos: (ficha.abastecimentos || []).map(normalizarAbastecimento),
        comprovantes: ficha.comprovantes || ficha.anexos || [],
        despesas_extras: ficha.despesas_extras || ficha.outrasDespesas || [],
        dados_completos: comCamposDaViagem(ficha.dados_completos || ficha, ficha, gestao),
        status: ficha.status || 'pendente',
        origem_envio: ficha.origem_envio || ficha.origemEnvio || 'motorista_com_login',
        aprovado_em: ficha.aprovado_em || (ficha.dataAprovacao ? new Date().toISOString() : null),
        aprovado_por: ficha.aprovado_por || ficha.aprovadoPor || null
    };
}

/**
 * Converte o registro vindo do Supabase para o formato esperado pelo frontend
 */
function mapearFichaDoSupabase(registro) {
    if (!registro) return null;
    const completo = registro.dados_completos || {};

    const abasts = registro.abastecimentos || completo.abastecimentos || [];
    let totAbast = completo.totalAbastecimento;
    let totLitros = completo.totalLitros;

    if (!totAbast && Array.isArray(abasts) && abasts.length > 0) {
        const somaAbast = abasts.reduce((acc, a) => {
            const num = typeof a.valor === 'number' ? a.valor : parseFloat(String(a.valor || 0).replace(/[^\d,-]/g, '').replace(',', '.'));
            return acc + (isNaN(num) ? 0 : num);
        }, 0);
        if (somaAbast > 0) totAbast = formatarMoedaBR(somaAbast);
    }

    if (!totLitros && Array.isArray(abasts) && abasts.length > 0) {
        const somaL = abasts.reduce((acc, a) => {
            const num = typeof a.litros === 'number' ? a.litros : parseFloat(String(a.litros || 0).replace(/[^\d,-]/g, '').replace(',', '.'));
            return acc + (isNaN(num) ? 0 : num);
        }, 0);
        if (somaL > 0) totLitros = somaL.toString();
    }

    return {
        ...completo,
        id: registro.id,
        protocolo: registro.id,
        dataEnvio: registro.data_envio ? new Date(registro.data_envio).toLocaleString('pt-BR') : completo.dataEnvio,
        motorista: registro.motorista,
        motoristaCpf: registro.motorista_cpf,
        placas: registro.placas,
        placaSecundaria: String(completo.placaSecundaria || '').trim(),
        dataSaida: registro.data_saida || completo.dataSaida,
        dataChegada: registro.data_chegada || completo.dataChegada,
        kmSaida: registro.km_saida?.toString() || completo.kmSaida,
        kmChegada: registro.km_chegada?.toString() || completo.kmEntrada || completo.kmChegada,
        kmEntrada: registro.km_chegada?.toString() || completo.kmEntrada || completo.kmChegada,
        // 2º trecho e totais calculados pelo banco (ausentes em fichas antigas)
        kmSaida2: completo.kmSaida2 || '',
        kmEntrada2: completo.kmEntrada2 || '',
        kmTotal1: completo.kmTotal1 || '',
        kmTotal2: completo.kmTotal2 || '',
        kmTotal: registro.km_total?.toString() || completo.kmTotal,
        destinoInicial: registro.destino_inicial || completo.destinoInicial,
        destinoFinal: registro.destino_final || completo.destinoFinal,
        totalFrete: formatarMoedaBR(registro.total_frete),
        vrComissao: formatarMoedaBR(registro.vr_comissao),
        valorAdiantamento: formatarMoedaBR(registro.valor_adiantamento),
        mediaKmL: registro.media_km_l ? Number(registro.media_km_l).toFixed(2) : (completo.mediaKmL || '0.00'),
        saldoComissao: formatarMoedaBR(registro.saldo_comissao),
        totalDespesas: formatarMoedaBR(registro.total_despesas),
        totalAbastecimento: totAbast || '0,00',
        totalLitros: totLitros || '0,00',
        abastecimentos: Array.isArray(abasts) ? abasts.map(normalizarAbastecimento) : abasts,
        anexos: registro.comprovantes || completo.anexos || [],
        outrasDespesas: registro.despesas_extras || completo.outrasDespesas || [],
        status: registro.status || 'pendente',
        origemEnvio: registro.origem_envio || 'motorista_com_login',
        aprovadoPor: registro.aprovado_por,
        dataAprovacao: registro.aprovado_em
    };
}

function formatarDataParaIso(dataStr) {
    if (!dataStr) return null;
    // Se estiver no formato DD/MM/AAAA
    if (dataStr.includes('/')) {
        const partes = dataStr.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
    }
    return dataStr;
}

function formatarMoedaBR(num) {
    if (num === null || num === undefined) return '0,00';
    return Number(num).toFixed(2).replace('.', ',');
}

/**
 * Salva ou Atualiza uma ficha de viagem no Supabase
 */
async function salvarFichaSupabase(ficha) {
    if (!supabaseClient) {
        console.warn('Supabase não inicializado. Usando apenas LocalStorage.');
        return { success: false, fallback: true };
    }

    try {
        const payload = mapearFichaParaSupabase(ficha);
        const { data, error } = await supabaseClient
            .from('fichas_viagem')
            .upsert(payload, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            return { success: false, error };
        }

        console.log('✅ Ficha salva no Supabase:', data);
        return { success: true, data };
    } catch (err) {
        console.error('Exceção ao salvar no Supabase:', err);
        return { success: false, error: err };
    }
}

/**
 * Busca todas as fichas de viagem do Supabase
 */
async function buscarFichasSupabase() {
    if (!supabaseClient) return null;

    try {
        const { data, error } = await supabaseClient
            .from('fichas_viagem')
            .select('*')
            .order('data_envio', { ascending: false });

        if (error) {
            console.error('Erro ao buscar fichas do Supabase:', error);
            return null;
        }

        return data.map(mapearFichaDoSupabase);
    } catch (err) {
        console.error('Exceção ao buscar fichas do Supabase:', err);
        return null;
    }
}

/**
 * Atualiza o status de aprovação de uma ficha
 */
async function atualizarStatusFichaSupabase(idFicha, novoStatus, aprovadoPor = null, dadosExtras = {}) {
    if (!supabaseClient) return false;

    try {
        const payload = {
            status: novoStatus,
            aprovado_por: novoStatus === 'aprovado' ? aprovadoPor : null,
            aprovado_em: novoStatus === 'aprovado' ? new Date().toISOString() : null,
            ...dadosExtras
        };

        const { data, error } = await supabaseClient
            .from('fichas_viagem')
            .update(payload)
            .eq('id', idFicha)
            .select();

        if (error) {
            console.error('Erro ao atualizar status no Supabase:', error);
            return false;
        }

        console.log(`✅ Status da ficha ${idFicha} atualizado para ${novoStatus}:`, data);
        return true;
    } catch (err) {
        console.error('Exceção ao atualizar status no Supabase:', err);
        return false;
    }
}

/**
 * Grava o status do acerto com o motorista em dados_completos.statusAcerto
 * da própria ficha ('confirmado' | 'nao_confirmado'). Preserva o restante
 * de dados_completos (lê o valor atual antes de atualizar).
 */
async function atualizarStatusAcertoSupabase(idFicha, statusAcerto) {
    if (!supabaseClient) return false;

    try {
        const { data: atual, error: erroLeitura } = await supabaseClient
            .from('fichas_viagem')
            .select('dados_completos')
            .eq('id', idFicha)
            .maybeSingle();

        if (erroLeitura || !atual) {
            console.error('Erro ao ler a ficha para atualizar o acerto:', erroLeitura);
            return false;
        }

        const dadosCompletos = { ...(atual.dados_completos || {}), statusAcerto };

        const { data, error } = await supabaseClient
            .from('fichas_viagem')
            .update({ dados_completos: dadosCompletos })
            .eq('id', idFicha)
            .select('id');

        // Sem linhas retornadas = a RLS não permitiu a alteração
        if (error || !Array.isArray(data) || data.length === 0) {
            console.error('Erro ao salvar status do acerto no Supabase:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Exceção ao salvar status do acerto no Supabase:', err);
        return false;
    }
}

// ==========================================================================
// 4. UPLOAD DE FOTOS E COMPROVANTES (SUPABASE STORAGE)
// ==========================================================================

/**
 * Envia um comprovante para o bucket PRIVADO 'comprovantes'.
 * Caminho: <id do usuário>/<id da ficha>/<arquivo>  (exigido pela política do storage)
 * Retorna { path, name, size, type } ou null.
 */
async function uploadComprovanteSupabase(file, fichaId) {
    if (!supabaseClient || !file) return null;

    try {
        const { data: sessao } = await supabaseClient.auth.getUser();
        const uid = sessao && sessao.user ? sessao.user.id : null;
        if (!uid) return null;

        const nomeSeguro = String(file.name || 'comprovante')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const pastaFicha = String(fichaId || 'sem-ficha').replace(/[^a-zA-Z0-9_-]/g, '_');
        const caminho = `${uid}/${pastaFicha}/${Date.now()}_${nomeSeguro}`;

        const { error } = await supabaseClient
            .storage
            .from('comprovantes')
            .upload(caminho, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

        if (error) {
            console.error('Erro no upload do comprovante:', error);
            return null;
        }
        return { path: caminho, name: file.name, size: file.size, type: file.type };
    } catch (err) {
        console.error('Exceção no upload para o Supabase Storage:', err);
        return null;
    }
}

/**
 * Gera um link temporário (10 min) para abrir um comprovante privado.
 */
async function obterLinkComprovante(caminho) {
    if (!supabaseClient || !caminho) return null;
    const { data, error } = await supabaseClient
        .storage
        .from('comprovantes')
        .createSignedUrl(caminho, 600);
    if (error) {
        console.error('Erro ao gerar link do comprovante:', error);
        return null;
    }
    return data.signedUrl;
}

/**
 * Reserva o próximo número de ficha no banco (ex.: AJB-2026-004).
 * Único para todos os motoristas e aparelhos.
 */
async function reservarNumeroFichaSupabase() {
    if (!supabaseClient) throw new Error('Supabase não inicializado.');
    const { data, error } = await supabaseClient.rpc('reservar_numero_ficha');
    if (error || !data) throw (error || new Error('Não foi possível gerar o número da ficha.'));
    return data;
}

/**
 * Exclui permanentemente uma ficha de viagem do Supabase
 */
async function excluirFichaSupabase(idFicha) {
    if (!supabaseClient) {
        console.warn('Supabase não inicializado. Exclusão feita apenas localmente.');
        return false;
    }

    try {
        const { data, error } = await supabaseClient
            .from('fichas_viagem')
            .delete()
            .eq('id', idFicha)
            .select();

        if (error) {
            console.error('Erro ao excluir ficha no Supabase:', error);
            return false;
        }

        console.log(`🗑️ Ficha ${idFicha} excluída do Supabase com sucesso:`, data);
        return true;
    } catch (err) {
        console.error('Exceção ao excluir ficha no Supabase:', err);
        return false;
    }
}

// ==========================================================================
// 5. ATUALIZAÇÃO EM TEMPO REAL (REALTIME) NO DASHBOARD
// ==========================================================================

/**
 * Escuta novas fichas, alterações de status ou exclusões em tempo real
 */
function escutarAlteracoesFichasSupabase(onNovaFicha, onAtualizacaoFicha, onExclusaoFicha) {
    if (!supabaseClient) return null;

    const canal = supabaseClient
        .channel('fichas_viagem_mudancas')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas_viagem' }, payload => {
            console.log('⚡ Nova ficha inserida em tempo real:', payload.new);
            if (typeof onNovaFicha === 'function') {
                onNovaFicha(mapearFichaDoSupabase(payload.new));
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fichas_viagem' }, payload => {
            console.log('⚡ Ficha atualizada em tempo real:', payload.new);
            if (typeof onAtualizacaoFicha === 'function') {
                onAtualizacaoFicha(mapearFichaDoSupabase(payload.new));
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'fichas_viagem' }, payload => {
            console.log('⚡ Ficha excluída em tempo real no Supabase:', payload.old);
            if (typeof onExclusaoFicha === 'function') {
                onExclusaoFicha(payload.old ? payload.old.id : null);
            }
        })
        .subscribe();

    return canal;
}

// Exportações globais para os outros scripts
window.mapearFichaDoSupabase = mapearFichaDoSupabase;
window.mapearFichaParaSupabase = mapearFichaParaSupabase;
window.salvarFichaSupabase = salvarFichaSupabase;
window.buscarFichasSupabase = buscarFichasSupabase;
window.atualizarStatusFichaSupabase = atualizarStatusFichaSupabase;
window.atualizarStatusAcertoSupabase = atualizarStatusAcertoSupabase;
window.excluirFichaSupabase = excluirFichaSupabase;
window.uploadComprovanteSupabase = uploadComprovanteSupabase;
window.obterLinkComprovante = obterLinkComprovante;
window.reservarNumeroFichaSupabase = reservarNumeroFichaSupabase;
window.escutarAlteracoesFichasSupabase = escutarAlteracoesFichasSupabase;

// ==========================================================================
// 6. LOGIN, CADASTRO E RECUPERAÇÃO DE SENHA
//    Login e recuperação passam pelas edge functions (limite de tentativas,
//    papel validado no servidor). O navegador nunca lê a tabela perfis sem login.
// ==========================================================================

/**
 * Chama uma edge function e devolve { ok, status, dados }.
 */
async function chamarEdgeFunction(nome, corpo) {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/${nome}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.anonKey
        },
        body: JSON.stringify(corpo)
    });
    let dados = {};
    try { dados = await resp.json(); } catch (e) { /* resposta sem JSON */ }
    return { ok: resp.ok, status: resp.status, dados };
}

/**
 * Login pela edge function 'login'. tipo = 'motorista' (cpf) ou 'admin' (email).
 * Em caso de sucesso grava a sessão no cliente Supabase.
 */
async function loginSupabase({ tipo, cpf, email, senha }) {
    const corpo = tipo === 'admin'
        ? { tipo: 'admin', email, senha }
        : { tipo: 'motorista', cpf, senha };

    const r = await chamarEdgeFunction('login', corpo);
    if (!r.ok || !r.dados || !r.dados.sucesso) {
        return { sucesso: false, erro: (r.dados && r.dados.erro) || 'Não foi possível entrar. Tente novamente.' };
    }
    await window.ajbAuth.definirSessao(r.dados.session);
    return { sucesso: true, usuario: r.dados.usuario };
}

/**
 * Envia a ficha "Seja um Agregado Conosco" para a edge function 'solicitar-cadastro'.
 * A conta nasce PENDENTE. Devolve { sucesso, uploads: [{indice, path, token}] }
 * para o navegador enviar os documentos ao bucket privado.
 */
async function solicitarCadastroAgregado(corpo) {
    const r = await chamarEdgeFunction('solicitar-cadastro', corpo);
    if (!r.ok || !r.dados || !r.dados.sucesso) {
        return {
            sucesso: false,
            erro: (r.dados && r.dados.erro) || 'Não foi possível enviar o cadastro. Tente novamente.',
            faltando: r.dados && r.dados.faltando
        };
    }
    return { sucesso: true, cadastroId: r.dados.cadastro_id, uploads: r.dados.uploads || [] };
}

/**
 * Esqueci a senha - etapa 1: pede o código para o e-mail cadastrado.
 * Se o e-mail não estiver cadastrado, a edge function responde 404.
 */
async function solicitarRecuperacaoSenha(email) {
    const r = await chamarEdgeFunction('recuperar-senha', { email: (email || '').trim().toLowerCase() });
    if (!r.ok) return { sucesso: false, status: r.status, erro: (r.dados && r.dados.erro) || 'Serviço indisponível no momento.' };
    return { sucesso: true, mensagem: r.dados.mensagem };
}

/**
 * Esqueci a senha - etapa 2: confere o código recebido por e-mail e abre a
 * sessão de recuperação. Devolve { sucesso, cpf } (o CPF serve para conferir a regra da senha).
 */
async function verificarCodigoRecuperacao(email, codigo) {
    if (!supabaseClient) return { sucesso: false, erro: 'Serviço indisponível no momento.' };
    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: (email || '').trim().toLowerCase(),
        token: String(codigo || '').replace(/\s/g, ''),
        type: 'recovery'
    });
    if (error || !data || !data.session) {
        return { sucesso: false, erro: 'Código inválido ou expirado. Confira o e-mail ou peça um novo código.' };
    }
    let cpf = '';
    try {
        const { data: perfil } = await supabaseClient.from('perfis').select('cpf').eq('id', data.user.id).maybeSingle();
        cpf = (perfil && perfil.cpf) || '';
    } catch (e) { /* segue sem CPF */ }
    return { sucesso: true, cpf };
}

/**
 * Esqueci a senha - etapa 2: grava a senha nova (precisa da sessão aberta pelo código).
 */
async function definirNovaSenhaSupabase(novaSenha) {
    if (!supabaseClient) return { sucesso: false, erro: 'Serviço indisponível no momento.' };
    const { error } = await supabaseClient.auth.updateUser({ password: novaSenha });
    if (error) {
        const msg = String(error.message || '');
        if (/different from the old/i.test(msg)) return { sucesso: false, erro: 'A nova senha precisa ser diferente da anterior.' };
        if (/session|jwt|expired/i.test(msg)) return { sucesso: false, erro: 'O código expirou. Peça um novo código.' };
        return { sucesso: false, erro: 'Não foi possível salvar a nova senha.' };
    }
    await supabaseClient.auth.signOut().catch(() => {});
    return { sucesso: true };
}

window.loginSupabase = loginSupabase;
window.solicitarCadastroAgregado = solicitarCadastroAgregado;
window.verificarCodigoRecuperacao = verificarCodigoRecuperacao;
window.solicitarRecuperacaoSenha = solicitarRecuperacaoSenha;
window.definirNovaSenhaSupabase = definirNovaSenhaSupabase;
