// =============================================================================
// EDGE FUNCTION: gerenciar-frota
// AJBorges Transporte & Logística - motoristas de FROTA (ficha de viagem)
//
// Usada pelo dashboard admin (aba "Motoristas" > "Frota") para cadastrar e
// manter os motoristas contratados. Só admin/diretoria.
//
// Configuração no painel: Verify JWT LIGADO (quem chama é a gestão logada).
// Secrets: ALLOWED_ORIGINS.
// Depende do supabase/sql/passo9_frota.sql (colunas vinculo e senha_provisoria,
// status 'inativo' e a RPC encerrar_sessoes_usuario).
//
// Ações (POST JSON, campo "acao"):
//   importar        { motoristas: [{ linha?, nome, cpf, celular }] }  (até 200)
//   criar           { nome, cpf, celular, email?, senha? }
//   redefinir_senha { id }   senha volta a ser a padrão (senhaPadrao)
//   desativar       { id }   status 'inativo' e derruba as sessões
//   reativar        { id }   status 'aprovado'
//
// Logs: só a ação, contadores e ids. Nunca CPF inteiro, nome, telefone ou senha.
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

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, peso: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Mesma regra do JavaScript/senha.js: 6 primeiros dígitos do CPF + caractere
// especial + palavra de 4 letras ou mais, com 11 a 72 caracteres.
function erroSenha(senha: string, cpf: string): string | null {
  if (senha.length < 11) return "A senha precisa ter pelo menos 11 caracteres.";
  if (senha.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!senha.includes(cpf.slice(0, 6))) return "A senha precisa conter os 6 primeiros dígitos do CPF.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/.test(senha)) return "A senha precisa de um caractere especial (como @, #, $, !).";
  if (!/[A-Za-zÀ-ÿ]{4,}/.test(senha)) return "A senha precisa de uma palavra com pelo menos 4 letras.";
  return null;
}

// Senha PROVISÓRIA da frota: 6 primeiros dígitos do CPF + "@frota" (ex.: 471666@frota).
// Passa na regra do senha.js, mas qualquer pessoa que conheça o CPF consegue
// deduzi-la. Por isso o perfil fica com senha_provisoria = true e, a cada
// acesso, a ficha pede para o motorista cadastrar o e-mail dele e criar uma
// senha só dele (o trigger do passo 9 desliga a marca quando a senha muda).
function senhaPadrao(cpf: string): string {
  return `${cpf.slice(0, 6)}@frota`;
}

// O Supabase Auth exige e-mail e a frota normalmente não tem. Este subdomínio
// não recebe e-mail (nenhum MX), então nada é enviado para esses endereços.
const DOMINIO_SEM_EMAIL = "sem-email.ajborges.com.br";
const emailProvisorio = (cpf: string) => `frota.${cpf}@${DOMINIO_SEM_EMAIL}`;

const MAX_IMPORTAR = 200;
const final4 = (cpf: string) => cpf.slice(-4);

function limparNome(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[<>"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

// 10 ou 11 dígitos; aceita com 55 (DDI) na frente
function limparCelular(v: unknown): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof createClient>;
type Resultado = { ok: true; id: string } | { ok: false; status: number; motivo: string };

// Cria a conta e marca o perfil como frota aprovada. Desfaz a conta se algo falhar.
async function criarMotorista(admin: Admin, m: { nome: string; cpf: string; celular: string; email: string; senha: string }): Promise<Resultado> {
  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email: m.email,
    password: m.senha,
    email_confirm: true,
    user_metadata: { nome: m.nome, cpf: m.cpf, telefone: m.celular },
    app_metadata: { role: "motorista" },
  });
  if (erroCriar || !criado?.user) {
    const msg = String(erroCriar?.message ?? "");
    if ((erroCriar as { code?: string })?.code === "email_exists" || /already|exists|registered/i.test(msg)) {
      return { ok: false, status: 409, motivo: "Este e-mail já está em uso." };
    }
    if (/database error|cpf/i.test(msg)) return { ok: false, status: 409, motivo: "CPF já cadastrado." };
    console.error("gerenciar-frota: falha ao criar usuário:", (erroCriar as { code?: string })?.code ?? "erro");
    return { ok: false, status: 503, motivo: "Não foi possível criar a conta." };
  }
  const uid = criado.user.id;

  // O trigger criar_perfil_novo_usuario criou o perfil como motorista pendente
  const { data: linhas, error: erroPerfil } = await admin.from("perfis").update({
    status: "aprovado", vinculo: "frota", senha_provisoria: true,
    nome: m.nome, telefone: m.celular, cpf: m.cpf, email: m.email,
  }).eq("id", uid).select("id");
  if (erroPerfil || !linhas?.length) {
    console.error("gerenciar-frota: falha ao marcar perfil, desfazendo conta", uid);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return { ok: false, status: 503, motivo: "Não foi possível concluir o cadastro." };
  }
  return { ok: true, id: uid };
}

// Perfil de motorista da frota pelo id (para redefinir/desativar/reativar)
async function perfilFrota(admin: Admin, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const { data } = await admin.from("perfis")
    .select("id, cpf, role, vinculo, status").eq("id", id).maybeSingle();
  if (!data || data.role !== "motorista" || data.vinculo !== "frota") return null;
  return data as { id: string; cpf: string; status: string };
}

async function encerrarSessoes(admin: Admin, id: string): Promise<void> {
  const { error } = await admin.rpc("encerrar_sessoes_usuario", { p_id: id });
  if (error) console.error("gerenciar-frota: falha ao encerrar sessões", id, error.code ?? "erro");
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return resp(req, 405, { erro: "Método não permitido." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    if (!url || !serviceKey) {
      console.error("gerenciar-frota: variáveis ausentes");
      return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Quem chama: token do header Authorization, papel em app_metadata.role
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return resp(req, 401, { erro: "Sessão expirada. Entre novamente." });
    const { data: quem, error: erroQuem } = await admin.auth.getUser(token);
    if (erroQuem || !quem?.user) return resp(req, 401, { erro: "Sessão expirada. Entre novamente." });
    const papel = quem.user.app_metadata?.role;
    if (papel !== "admin" && papel !== "diretoria") return resp(req, 403, { erro: "Acesso negado." });

    const bruto = await req.text();
    if (bruto.length > 200 * 1024) return resp(req, 413, { erro: "Requisição muito grande." });
    let corpo: Record<string, unknown>;
    try { corpo = JSON.parse(bruto); } catch { return resp(req, 400, { erro: "Requisição inválida." }); }

    const acao = String(corpo?.acao ?? "");

    // ---------------- importar ----------------
    if (acao === "importar") {
      const lista = Array.isArray(corpo.motoristas) ? corpo.motoristas as Record<string, unknown>[] : null;
      if (!lista || lista.length === 0) return resp(req, 400, { erro: "Nenhum motorista enviado." });
      if (lista.length > MAX_IMPORTAR) return resp(req, 400, { erro: `Envie no máximo ${MAX_IMPORTAR} motoristas por vez.` });

      const pulados: { linha: number; cpf_final4: string; motivo: string }[] = [];
      const erros: { linha: number; cpf_final4: string; motivo: string }[] = [];
      const validos: { linha: number; nome: string; cpf: string; celular: string }[] = [];
      const vistos = new Set<string>();

      lista.forEach((m, i) => {
        const linha = Number.isInteger(m?.linha) ? Number(m.linha) : i + 1;
        const cpf = String(m?.cpf ?? "").replace(/\D/g, "");
        const nome = limparNome(m?.nome);
        const celular = limparCelular(m?.celular);
        if (!cpfValido(cpf)) return erros.push({ linha, cpf_final4: final4(cpf), motivo: "CPF inválido." });
        if (!nome) return erros.push({ linha, cpf_final4: final4(cpf), motivo: "Nome vazio." });
        if (!celular) return erros.push({ linha, cpf_final4: final4(cpf), motivo: "Celular inválido." });
        if (vistos.has(cpf)) return pulados.push({ linha, cpf_final4: final4(cpf), motivo: "CPF repetido no envio." });
        vistos.add(cpf);
        validos.push({ linha, nome, cpf, celular });
      });

      // Quem já existe em perfis é pulado (não altera ninguém)
      const existentes = new Set<string>();
      if (validos.length) {
        const { data, error } = await admin.from("perfis").select("cpf").in("cpf", validos.map((v) => v.cpf));
        if (error) {
          console.error("gerenciar-frota: importar, falha ao consultar perfis:", error.code ?? "erro");
          return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
        }
        (data ?? []).forEach((p) => existentes.add(String(p.cpf)));
      }

      let criados = 0;
      for (const v of validos) {
        if (existentes.has(v.cpf)) {
          pulados.push({ linha: v.linha, cpf_final4: final4(v.cpf), motivo: "CPF já cadastrado." });
          continue;
        }
        const r = await criarMotorista(admin, {
          nome: v.nome, cpf: v.cpf, celular: v.celular, email: emailProvisorio(v.cpf), senha: senhaPadrao(v.cpf),
        });
        if (r.ok) criados++;
        else if (r.status === 409) pulados.push({ linha: v.linha, cpf_final4: final4(v.cpf), motivo: r.motivo });
        else erros.push({ linha: v.linha, cpf_final4: final4(v.cpf), motivo: r.motivo });
      }

      console.log(`gerenciar-frota: importar por ${quem.user.id} recebidos=${lista.length} criados=${criados} pulados=${pulados.length} erros=${erros.length}`);
      return resp(req, 200, { criados, pulados, erros });
    }

    // ---------------- criar ----------------
    if (acao === "criar") {
      const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
      const nome = limparNome(corpo.nome);
      const celular = limparCelular(corpo.celular);
      if (!nome) return resp(req, 400, { erro: "Informe o nome completo." });
      if (!cpfValido(cpf)) return resp(req, 400, { erro: "CPF inválido." });
      if (!celular) return resp(req, 400, { erro: "Celular inválido. Use DDD + número." });

      let email = emailProvisorio(cpf);
      const emailInformado = String(corpo.email ?? "").trim().toLowerCase();
      if (emailInformado) {
        if (!emailValido(emailInformado) || emailInformado.endsWith("@" + DOMINIO_SEM_EMAIL)) {
          return resp(req, 400, { erro: "Informe um e-mail válido ou deixe em branco." });
        }
        email = emailInformado;
      }

      let senha = senhaPadrao(cpf);
      if (typeof corpo.senha === "string" && corpo.senha !== "") {
        const problema = erroSenha(corpo.senha, cpf);
        if (problema) return resp(req, 400, { erro: problema });
        senha = corpo.senha;
      }

      const { data: jaExiste } = await admin.from("perfis").select("id").eq("cpf", cpf).maybeSingle();
      if (jaExiste) return resp(req, 409, { erro: "CPF já cadastrado." });
      if (emailInformado) {
        const { data: emailEmUso } = await admin.from("perfis").select("id").eq("email", email).maybeSingle();
        if (emailEmUso) return resp(req, 409, { erro: "Este e-mail já está em uso." });
      }

      const r = await criarMotorista(admin, { nome, cpf, celular, email, senha });
      if (!r.ok) return resp(req, r.status, { erro: r.motivo });

      console.log(`gerenciar-frota: criar por ${quem.user.id} id=${r.id}`);
      return resp(req, 200, { sucesso: true, id: r.id });
    }

    // ---------------- redefinir_senha / desativar / reativar ----------------
    if (acao === "redefinir_senha" || acao === "desativar" || acao === "reativar") {
      const perfil = await perfilFrota(admin, corpo.id);
      if (!perfil) return resp(req, 404, { erro: "Motorista da frota não encontrado." });

      if (acao === "redefinir_senha") {
        const { error: erroSenhaNova } = await admin.auth.admin.updateUserById(perfil.id, { password: senhaPadrao(perfil.cpf) });
        if (erroSenhaNova) {
          console.error("gerenciar-frota: redefinir_senha falhou", perfil.id, (erroSenhaNova as { code?: string }).code ?? "erro");
          return resp(req, 503, { erro: "Não foi possível redefinir a senha." });
        }
        // O trigger do passo 9 acabou de pôr false (a senha mudou): volta para true
        const { error: erroMarca } = await admin.from("perfis").update({ senha_provisoria: true }).eq("id", perfil.id);
        if (erroMarca) console.error("gerenciar-frota: redefinir_senha, falha ao marcar provisória", perfil.id);
        await encerrarSessoes(admin, perfil.id);
      } else {
        const novo = acao === "desativar" ? "inativo" : "aprovado";
        const { error } = await admin.from("perfis").update({ status: novo }).eq("id", perfil.id);
        if (error) {
          console.error(`gerenciar-frota: ${acao} falhou`, perfil.id, error.code ?? "erro");
          return resp(req, 503, { erro: "Não foi possível salvar a alteração." });
        }
        if (acao === "desativar") await encerrarSessoes(admin, perfil.id);
      }

      console.log(`gerenciar-frota: ${acao} por ${quem.user.id} id=${perfil.id}`);
      return resp(req, 200, { sucesso: true });
    }

    return resp(req, 400, { erro: "Ação inválida." });
  } catch (e) {
    console.error("gerenciar-frota: erro interno:", (e as Error).name);
    return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
  }
});
