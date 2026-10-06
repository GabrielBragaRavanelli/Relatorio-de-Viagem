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

// Permite sobrescrever a URL caso o usuário configure via localStorage ou query param
if (localStorage.getItem('ajborges_supabase_url')) {
    SUPABASE_CONFIG.url = localStorage.getItem('ajborges_supabase_url');
}

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

/**
 * Converte o objeto da ficha do frontend para as colunas do PostgreSQL
 */
function mapearFichaParaSupabase(ficha) {
    function parseNum(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const limpo = String(val).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        const n = parseFloat(limpo);
        return isNaN(n) ? 0 : n;
    }

    return {
        id: ficha.id,
        motorista: ficha.motorista || 'Motorista',
        motorista_cpf: ficha.motoristaCpf || null,
        placas: ficha.placas || null,
        data_saida: ficha.dataSaida ? formatarDataParaIso(ficha.dataSaida) : null,
        data_chegada: ficha.dataChegada ? formatarDataParaIso(ficha.dataChegada) : null,
        km_saida: parseNum(ficha.kmSaida),
        km_chegada: parseNum(ficha.kmChegada),
        km_total: parseNum(ficha.kmTotal),
        destino_inicial: ficha.destinoInicial || null,
        destino_final: ficha.destinoFinal || null,
        frete_origem: parseNum(ficha.freteOrigem),
        retorno_1: parseNum(ficha.retorno1),
        retorno_2: parseNum(ficha.retorno2),
        retorno_3: parseNum(ficha.retorno3),
        total_frete: parseNum(ficha.totalFrete),
        vr_comissao: parseNum(ficha.vrComissao),
        valor_adiantamento: parseNum(ficha.valorAdiantamento),
        media_km_l: parseNum(ficha.mediaKmL),
        saldo_comissao: parseNum(ficha.saldoComissao),
        total_despesas: parseNum(ficha.totalDespesas),
        abastecimentos: ficha.abastecimentos || [],
        comprovantes: ficha.anexos || ficha.comprovantes || [],
        despesas_extras: ficha.outrasDespesas || [],
        dados_completos: ficha, // Backup JSON de todos os campos
        status: ficha.status || 'pendente',
        origem_envio: ficha.origemEnvio || 'motorista_com_login',
        aprovado_em: ficha.dataAprovacao ? new Date().toISOString() : null,
        aprovado_por: ficha.aprovadoPor || null
    };
}

/**
 * Converte o registro vindo do Supabase para o formato esperado pelo frontend
 */
function mapearFichaDoSupabase(registro) {
    if (!registro) return null;
    const completo = registro.dados_completos || {};

    return {
        ...completo,
        id: registro.id,
        protocolo: registro.id,
        dataEnvio: registro.data_envio ? new Date(registro.data_envio).toLocaleString('pt-BR') : completo.dataEnvio,
        motorista: registro.motorista,
        motoristaCpf: registro.motorista_cpf,
        placas: registro.placas,
        dataSaida: registro.data_saida || completo.dataSaida,
        dataChegada: registro.data_chegada || completo.dataChegada,
        kmSaida: registro.km_saida?.toString() || completo.kmSaida,
        kmChegada: registro.km_chegada?.toString() || completo.kmChegada,
        kmTotal: registro.km_total?.toString() || completo.kmTotal,
        destinoInicial: registro.destino_inicial || completo.destinoInicial,
        destinoFinal: registro.destino_final || completo.destinoFinal,
        totalFrete: formatarMoedaBR(registro.total_frete),
        vrComissao: formatarMoedaBR(registro.vr_comissao),
        valorAdiantamento: formatarMoedaBR(registro.valor_adiantamento),
        mediaKmL: registro.media_km_l ? Number(registro.media_km_l).toFixed(2) : (completo.mediaKmL || '0.00'),
        saldoComissao: formatarMoedaBR(registro.saldo_comissao),
        totalDespesas: formatarMoedaBR(registro.total_despesas),
        abastecimentos: registro.abastecimentos || completo.abastecimentos || [],
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
async function atualizarStatusFichaSupabase(idFicha, novoStatus, aprovadoPor = 'operacional@ajborges.com', dadosExtras = {}) {
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

// ==========================================================================
// 4. UPLOAD DE FOTOS E COMPROVANTES (SUPABASE STORAGE)
// ==========================================================================

/**
 * Envia uma imagem para o bucket 'comprovantes' no Supabase Storage
 */
async function uploadComprovanteSupabase(file, prefixo = 'comprovante') {
    if (!supabaseClient) return null;

    try {
        const extensao = file.name ? file.name.split('.').pop() : 'jpg';
        const nomeArquivo = `${prefixo}_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;
        const caminho = `viagens/${nomeArquivo}`;

        const { data, error } = await supabaseClient
            .storage
            .from('comprovantes')
            .upload(caminho, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Erro no upload do comprovante:', error);
            return null;
        }

        // Obtém a URL pública do comprovante
        const { data: urlData } = supabaseClient
            .storage
            .from('comprovantes')
            .getPublicUrl(caminho);

        console.log('✅ Foto enviada para o Supabase Storage:', urlData.publicUrl);
        return urlData.publicUrl;
    } catch (err) {
        console.error('Exceção no upload para o Supabase Storage:', err);
        return null;
    }
}

// ==========================================================================
// 5. ATUALIZAÇÃO EM TEMPO REAL (REALTIME) NO DASHBOARD
// ==========================================================================

/**
 * Escuta novas fichas ou alterações de status em tempo real
 */
function escutarAlteracoesFichasSupabase(onNovaFicha, onAtualizacaoFicha) {
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
        .subscribe();

    return canal;
}

// Exportações globais para os outros scripts
window.salvarFichaSupabase = salvarFichaSupabase;
window.buscarFichasSupabase = buscarFichasSupabase;
window.atualizarStatusFichaSupabase = atualizarStatusFichaSupabase;
window.uploadComprovanteSupabase = uploadComprovanteSupabase;
window.escutarAlteracoesFichasSupabase = escutarAlteracoesFichasSupabase;
