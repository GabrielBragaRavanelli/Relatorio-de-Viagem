// =============================================================================
// EDGE FUNCTION: recuperar-senha
// AJBorges Transporte & Logística
//
// Fluxo (passo 5):
//   1. O motorista informa o E-MAIL.
//   2. Se o e-mail não estiver cadastrado -> 404 "E-mail não encontrado".
//   3. Se estiver -> o Supabase envia um CÓDIGO para esse e-mail.
//   4. A própria página recebe o código + a senha nova (verifyOtp + updateUser).
//
// Para o e-mail trazer o código, em Authentication > Email Templates >
// "Reset Password", o modelo precisa conter {{ .Token }}.
//
// Secrets: LOGIN_PEPPER (o mesmo do login), ALLOWED_ORIGINS.
// Entrada (POST JSON): { "email": "motorista@exemplo.com" }
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

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

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

async function hmac(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ipDe(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
}

async function contarTentativa(admin: ReturnType<typeof createClient>, chave: string, limite: number,
  janela: string, bloqueio: string): Promise<{ bloqueado: boolean }> {
  const { data, error } = await admin.rpc("registrar_tentativa", {
    p_chave: chave, p_limite: limite, p_janela: janela, p_bloqueio: bloqueio,
  });
  if (error) throw new Error("rate_limit_indisponivel: " + error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return { bloqueado: !!linha?.esta_bloqueado };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return resp(req, 405, { erro: "Método não permitido." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    const anonKey = lerChave("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
    const pepper = Deno.env.get("LOGIN_PEPPER");
    const redirectTo = Deno.env.get("RESET_REDIRECT_URL") || undefined;
    if (!url || !serviceKey || !anonKey || !pepper) {
      console.error("recuperar-senha: variáveis ausentes");
      return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
    }

    const bruto = await req.text();
    if (bruto.length > 2000) return resp(req, 413, { erro: "Requisição inválida." });
    let corpo: Record<string, unknown>;
    try { corpo = JSON.parse(bruto); } catch { return resp(req, 400, { erro: "Requisição inválida." }); }

    const email = String(corpo?.email ?? "").trim().toLowerCase();
    if (!emailValido(email)) return resp(req, 400, { erro: "Informe um e-mail válido." });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Limites: 10 pedidos/hora por IP e 3/hora por e-mail (evita spam e varredura)
    const chaveIp = await hmac(pepper, `reset-ip:${ipDe(req)}`);
    if ((await contarTentativa(admin, chaveIp, 10, "1 hour", "1 hour")).bloqueado) {
      return resp(req, 429, { erro: "Muitas solicitações. Tente novamente mais tarde." });
    }
    const chaveEmail = await hmac(pepper, `reset-email:${email}`);
    if ((await contarTentativa(admin, chaveEmail, 3, "1 hour", "1 hour")).bloqueado) {
      return resp(req, 429, { erro: "Você já pediu vários códigos. Aguarde e confira sua caixa de entrada e o spam." });
    }

    // O e-mail está cadastrado?
    const { data: perfil, error: erroPerfil } = await admin.from("perfis")
      .select("id, status").eq("email", email).maybeSingle();
    if (erroPerfil) console.error("recuperar-senha: erro ao consultar perfis:", erroPerfil.message);
    if (!perfil) {
      return resp(req, 404, { erro: "E-mail não encontrado. Confira o e-mail ou fale com a gestão." });
    }
    if (perfil.status === "pendente") {
      return resp(req, 403, { erro: "Seu cadastro ainda está em análise pela gestão." });
    }
    if (perfil.status === "recusado") {
      return resp(req, 403, { erro: "Seu cadastro não foi aprovado. Entre em contato com a gestão." });
    }

    const { error: erroEnvio } = await anon.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (erroEnvio) {
      console.error("recuperar-senha: falha ao enviar código:", erroEnvio.message);
      if (/rate|limit|seconds/i.test(erroEnvio.message)) {
        return resp(req, 429, { erro: "Aguarde um minuto antes de pedir outro código." });
      }
      return resp(req, 503, { erro: "Não foi possível enviar o código agora. Tente novamente." });
    }

    return resp(req, 200, { sucesso: true, mensagem: "Enviamos um código para o seu e-mail." });
  } catch (e) {
    console.error("recuperar-senha: erro interno:", (e as Error).message);
    return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
  }
});
