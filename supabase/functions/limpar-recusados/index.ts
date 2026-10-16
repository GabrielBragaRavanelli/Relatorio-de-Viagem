// =============================================================================
// EDGE FUNCTION: limpar-recusados
// AJBorges Transporte & Logística - LGPD
//
// Apaga por completo os cadastros do "Seja um Agregado" recusados há mais de
// 90 dias: arquivos no bucket privado "documentos-cadastro", a conta de login
// do motorista (só se ainda estiver recusada) e a linha de cadastros_agregados.
// Também pega os cadastros antigos que ficaram com user_id = null depois de um
// reenvio com o mesmo CPF (a conta antiga já foi apagada por solicitar-cadastro).
//
// Chamada uma vez por dia pelo pg_cron + pg_net (supabase/sql/passo8_lgpd_agendamento.sql).
// Configuração no painel: Verify JWT DESLIGADO (o agendador não tem usuário).
// Secrets: CRON_SECRET (o mesmo valor do segredo "cron_secret" no Vault).
//
// Logs: só contagens e ids. Nunca nome, CPF, e-mail ou celular.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

function lerChave(legado: string, novo: string): string | undefined {
  const antiga = Deno.env.get(legado);
  if (antiga) return antiga;
  const json = Deno.env.get(novo);
  if (json) {
    try {
      const mapa = JSON.parse(json) as Record<string, string>;
      return mapa.default ?? Object.values(mapa)[0];
    } catch { /* ignora */ }
  }
  return undefined;
}

function resp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Compara em tempo constante: resume os dois lados em SHA-256 (mesmo tamanho)
// e percorre todos os bytes, sem sair no primeiro diferente.
async function segredoConfere(recebido: string, esperado: string): Promise<boolean> {
  const resumo = async (t: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
  const [a, b] = await Promise.all([resumo(recebido), resumo(esperado)]);
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

// Código curto do erro para o log (a mensagem pode trazer dados da linha)
function codigoErro(e: unknown): string {
  const x = e as { code?: string; status?: number; name?: string } | null;
  return String(x?.code ?? x?.status ?? x?.name ?? "erro");
}

const BUCKET = "documentos-cadastro";
const DIAS_RETENCAO = 90;
const LOTE = 50;

type Cadastro = { id: string; user_id: string | null; documentos: unknown };
type Admin = ReturnType<typeof createClient>;

// Pastas {user_id}/{id}/ do cadastro: a do user_id atual e as que aparecem nos
// paths da lista (cobre o cadastro antigo com user_id = null após reenvio)
function pastasDo(c: Cadastro, paths: string[]): string[] {
  const pastas = new Set<string>();
  if (c.user_id) pastas.add(`${c.user_id}/${c.id}`);
  for (const p of paths) {
    const partes = p.split("/");
    if (partes.length === 3 && partes[1] === c.id && partes[0]) pastas.add(`${partes[0]}/${partes[1]}`);
  }
  return [...pastas];
}

async function apagarArquivos(admin: Admin, c: Cadastro): Promise<void> {
  const lista = Array.isArray(c.documentos) ? c.documentos as Record<string, unknown>[] : [];
  const paths = lista.map((d) => d?.path).filter((p): p is string => typeof p === "string" && p.length > 0);
  const alvos = new Set(paths);

  for (const pasta of pastasDo(c, paths)) {
    const { data, error } = await admin.storage.from(BUCKET).list(pasta, { limit: 1000 });
    if (error) throw Object.assign(new Error("list"), { code: "storage_list:" + codigoErro(error) });
    for (const f of data ?? []) if (f.name) alvos.add(`${pasta}/${f.name}`);
  }

  const todos = [...alvos];
  for (let i = 0; i < todos.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(todos.slice(i, i + 100));
    if (error) throw Object.assign(new Error("remove"), { code: "storage_remove:" + codigoErro(error) });
  }
}

// Apaga a conta só de motorista recusado. Devolve true se apagou.
async function apagarConta(admin: Admin, c: Cadastro): Promise<boolean> {
  if (!c.user_id) return false;

  const { data: perfil, error } = await admin.from("perfis")
    .select("id, role, status").eq("id", c.user_id).maybeSingle();
  if (error) throw Object.assign(new Error("perfil"), { code: "perfil_select:" + codigoErro(error) });

  if (!perfil) {
    // Sem perfil: só sobra a conta se uma execução anterior apagou o perfil e
    // falhou no deleteUser. Termina o serviço apenas se a conta for de motorista.
    const { data: u, error: erroUser } = await admin.auth.admin.getUserById(c.user_id);
    if (erroUser || !u?.user) return false;
    if (u.user.app_metadata?.role !== "motorista") return false;
    const { error: erroDel } = await admin.auth.admin.deleteUser(c.user_id);
    if (erroDel) throw Object.assign(new Error("auth"), { code: "auth_delete:" + codigoErro(erroDel) });
    return true;
  }

  // Nunca apaga admin/diretoria nem motorista aprovado ou pendente
  if (perfil.role !== "motorista" || perfil.status !== "recusado") return false;

  const { error: erroPerfil } = await admin.from("perfis").delete()
    .eq("id", c.user_id).eq("role", "motorista").eq("status", "recusado");
  if (erroPerfil) throw Object.assign(new Error("perfil"), { code: "perfil_delete:" + codigoErro(erroPerfil) });

  const { error: erroDel } = await admin.auth.admin.deleteUser(c.user_id);
  if (erroDel) throw Object.assign(new Error("auth"), { code: "auth_delete:" + codigoErro(erroDel) });
  return true;
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });

  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  const recebido = req.headers.get("x-cron-secret") ?? "";
  if (!segredo) console.error("limpar-recusados: CRON_SECRET ausente");
  if (!segredo || !recebido || !(await segredoConfere(recebido, segredo))) {
    return resp(401, { erro: "Não autorizado." });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    if (!url || !serviceKey) {
      console.error("limpar-recusados: variáveis ausentes");
      return resp(503, { erro: "Serviço temporariamente indisponível." });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const limite = new Date(Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin.from("cadastros_agregados")
      .select("id, user_id, documentos")
      .eq("status", "recusado")
      .lt("analisado_em", limite)
      .order("analisado_em", { ascending: true })
      .limit(LOTE);
    if (error) {
      console.error("limpar-recusados: falha na busca:", codigoErro(error));
      return resp(503, { erro: "Serviço temporariamente indisponível." });
    }

    let apagados = 0;
    let falhas = 0;
    let contas = 0;
    for (const c of (data ?? []) as Cadastro[]) {
      try {
        await apagarArquivos(admin, c);
        if (await apagarConta(admin, c)) contas++;

        // status = 'recusado' de novo: se a gestão mudou a decisão no meio, não apaga
        const { data: linhas, error: erroLinha } = await admin.from("cadastros_agregados").delete()
          .eq("id", c.id).eq("status", "recusado").select("id");
        if (erroLinha) throw Object.assign(new Error("linha"), { code: "cadastro_delete:" + codigoErro(erroLinha) });
        if (!linhas?.length) throw Object.assign(new Error("linha"), { code: "cadastro_nao_recusado" });
        apagados++;
      } catch (e) {
        falhas++;
        console.error(`limpar-recusados: falha no cadastro ${c.id}:`, codigoErro(e));
      }
    }

    console.log(`limpar-recusados: encontrados=${data?.length ?? 0} apagados=${apagados} contas=${contas} falhas=${falhas}`);
    return resp(200, { apagados, falhas });
  } catch (e) {
    console.error("limpar-recusados: erro interno:", codigoErro(e));
    return resp(503, { erro: "Serviço temporariamente indisponível." });
  }
});
