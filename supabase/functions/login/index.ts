// =============================================================================
// EDGE FUNCTION: login
// AJBorges Transporte & Logística
//
// Secrets necessários (Edge Functions > Secrets):
//   LOGIN_PEPPER      (obrigatório) texto aleatório longo, usado no HMAC das chaves
//   ALLOWED_ORIGINS   (recomendado) origens do site, separadas por vírgula
// Já vêm prontos no Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Entrada (POST JSON):
//   motorista: { "tipo": "motorista", "cpf": "000.000.000-00", "senha": "..." }
//   admin:     { "tipo": "admin", "email": "gestor@empresa.com", "senha": "..." }
//
// NOVO (passo 5): o motorista só entra se o cadastro estiver APROVADO pela gestão
// (perfis.status = 'aprovado'). A verificação acontece DEPOIS da senha conferida,
// para não revelar a terceiros a situação de um CPF.
//
// NOVO (passo 9): a ficha de viagem é só para motoristas de FROTA
// (perfis.vinculo = 'frota'). Outro vínculo recebe a mesma falha de "CPF ou
// senha incorretos". Status 'inativo' (saiu da empresa) recebe 403. A resposta
// de sucesso traz usuario.trocar_senha = perfis.senha_provisoria.
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
    } catch {
      /* JSON inválido: segue sem chave */
    }
  }
  return undefined;
}

// ---------- CORS ----------
const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const permitida = ORIGENS.length === 0 ? "*" : ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resp(req: Request, status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ---------- Utilidades ----------
async function hmac(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ipDe(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  );
}

async function contarTentativa(
  admin: ReturnType<typeof createClient>,
  chave: string,
  limite: number,
  janela: string,
  bloqueio: string,
): Promise<{ bloqueado: boolean; liberaEm: string | null }> {
  const { data, error } = await admin.rpc("registrar_tentativa", {
    p_chave: chave,
    p_limite: limite,
    p_janela: janela,
    p_bloqueio: bloqueio,
  });
  if (error) throw new Error("rate_limit_indisponivel: " + error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return { bloqueado: !!linha?.esta_bloqueado, liberaEm: linha?.libera_em ?? null };
}

function respostaBloqueio(req: Request, liberaEm: string | null): Response {
  const minutos = liberaEm
    ? Math.max(1, Math.ceil((new Date(liberaEm).getTime() - Date.now()) / 60000))
    : 10;
  return resp(req, 429, { erro: `Muitas tentativas. Tente novamente em ${minutos} minuto(s).` });
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return resp(req, 405, { erro: "Método não permitido." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    const anonKey = lerChave("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
    const pepper = Deno.env.get("LOGIN_PEPPER");

    const faltando = [
      !url && "SUPABASE_URL",
      !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
      !anonKey && "SUPABASE_ANON_KEY",
      !pepper && "LOGIN_PEPPER",
    ].filter(Boolean);
    if (faltando.length > 0) {
      console.error("login: variáveis ausentes:", faltando.join(", "));
      return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
    }

    const bruto = await req.text();
    if (bruto.length > 4000) return resp(req, 413, { erro: "Requisição inválida." });
    let corpo: Record<string, unknown>;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      return resp(req, 400, { erro: "Requisição inválida." });
    }

    const tipo = corpo?.tipo === "admin" ? "admin" : "motorista";
    const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
    if (!senha || senha.length > 128) return resp(req, 400, { erro: "Requisição inválida." });

    const msgCredenciais = tipo === "admin" ? "E-mail ou senha incorretos." : "CPF ou senha incorretos.";
    const falha = () => resp(req, 401, { erro: msgCredenciais });

    const admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authClient = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 1) Limite por IP
    const chaveIp = await hmac(pepper!, `login-ip:${ipDe(req)}`);
    const ip = await contarTentativa(admin, chaveIp, 30, "10 minutes", "10 minutes");
    if (ip.bloqueado) return respostaBloqueio(req, ip.liberaEm);

    // 2) Formato do identificador
    let identificador = "";
    if (tipo === "admin") {
      identificador = String(corpo?.email ?? "").trim().toLowerCase();
      if (!emailValido(identificador)) return falha();
    } else {
      identificador = String(corpo?.cpf ?? "").replace(/\D/g, "");
      if (!cpfValido(identificador)) return falha();
    }

    // 3) Limite por conta: 5 tentativas = 10 min bloqueado
    const chaveConta = await hmac(pepper!, `login-conta:${tipo}:${identificador}`);
    const conta = await contarTentativa(admin, chaveConta, 5, "10 minutes", "10 minutes");
    if (conta.bloqueado) return respostaBloqueio(req, conta.liberaEm);

    // ---------------- Fluxo MOTORISTA (CPF) ----------------
    if (tipo === "motorista") {
      const { data: perfil, error: perfilErr } = await admin
        .from("perfis")
        .select("id, nome, email, role, status, vinculo, senha_provisoria")
        .eq("cpf", identificador)
        .eq("role", "motorista")
        .maybeSingle();

      if (perfilErr) console.error("login: erro ao consultar perfis:", perfilErr.message);
      if (perfilErr || !perfil?.email) return falha();
      // Só frota entra na ficha; a mesma falha genérica não revela que o CPF existe
      if (perfil.vinculo !== "frota") return falha();

      const { data, error } = await authClient.auth.signInWithPassword({
        email: String(perfil.email).trim().toLowerCase(),
        password: senha,
      });
      if (error || !data?.session || !data?.user) return falha();

      const papel = data.user.app_metadata?.role;
      if (papel === "admin" || papel === "diretoria") {
        await admin.auth.admin.signOut(data.session.access_token).catch(() => {});
        return falha();
      }

      // NOVO: cadastro precisa estar aprovado pela gestão (senha já conferida acima)
      if (perfil.status !== "aprovado") {
        await admin.auth.admin.signOut(data.session.access_token).catch(() => {});
        await admin.rpc("limpar_tentativas", { p_chave: chaveConta });
        const mensagem = perfil.status === "inativo"
          ? "Seu acesso está desativado. Fale com a gestão da AJBorges."
          : perfil.status === "recusado"
          ? "Seu cadastro não foi aprovado. Entre em contato com a gestão da AJBorges."
          : "Seu cadastro está em análise pela gestão. Você poderá entrar assim que ele for aprovado.";
        return resp(req, 403, { erro: mensagem, status_cadastro: perfil.status });
      }

      if (papel !== "motorista") {
        const { error: upErr } = await admin.auth.admin.updateUserById(data.user.id, {
          app_metadata: { ...(data.user.app_metadata ?? {}), role: "motorista" },
        });
        if (upErr) console.error("login: não foi possível definir o papel:", upErr.message);
      }

      await admin.rpc("limpar_tentativas", { p_chave: chaveConta });

      return resp(req, 200, {
        sucesso: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
        },
        usuario: {
          id: data.user.id,
          nome: perfil.nome ?? "Motorista",
          role: "motorista",
          trocar_senha: perfil.senha_provisoria === true,
        },
      });
    }

    // ---------------- Fluxo ADMIN (e-mail) ----------------
    const { data, error } = await authClient.auth.signInWithPassword({
      email: identificador,
      password: senha,
    });
    if (error || !data?.session || !data?.user) return falha();

    const papel = data.user.app_metadata?.role;
    if (papel !== "admin" && papel !== "diretoria") {
      await admin.auth.admin.signOut(data.session.access_token).catch(() => {});
      return falha();
    }

    let nome = String(data.user.user_metadata?.nome ?? "");
    if (!nome) {
      const { data: p } = await admin.from("perfis").select("nome").eq("id", data.user.id).maybeSingle();
      nome = p?.nome ?? "Administrador";
    }

    await admin.rpc("limpar_tentativas", { p_chave: chaveConta });

    return resp(req, 200, {
      sucesso: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      usuario: { id: data.user.id, email: data.user.email, nome, role: papel },
    });
  } catch (e) {
    console.error("login: erro interno:", (e as Error).message);
    return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
  }
});
