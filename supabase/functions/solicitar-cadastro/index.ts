// =============================================================================
// EDGE FUNCTION: solicitar-cadastro
// AJBorges Transporte & Logística - "Seja um Agregado Conosco"
//
// Recebe a ficha de cadastro (PF ou PJ), cria a conta do motorista com status
// PENDENTE (o login só funciona depois que a gestão aprovar), grava a ficha em
// cadastros_agregados e devolve URLs assinadas para o navegador enviar os
// documentos ao bucket privado "documentos-cadastro".
//
// Configuração no painel: Verify JWT DESLIGADO (quem chama ainda não tem conta).
// Secrets: LOGIN_PEPPER (o mesmo do login), ALLOWED_ORIGINS.
//
// Regra "anexo OU preenchimento" (conforme a Atlas):
//   - CNH anexada            -> campos da CNH/filiação ficam opcionais
//   - CRLV do cavalo anexado -> campos do cavalo ficam opcionais
//   - CRLV da carreta anexado (ou "sem carreta") -> campos da carreta opcionais
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

// Mesma regra do formulário: 6 primeiros dígitos do CPF + caractere especial
// + palavra de 4 letras ou mais, no mínimo 11 caracteres.
function erroSenha(senha: string, cpf: string): string | null {
  if (senha.length < 11) return "A senha precisa ter pelo menos 11 caracteres.";
  if (senha.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!senha.includes(cpf.slice(0, 6))) return "A senha precisa conter os 6 primeiros dígitos do seu CPF.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/.test(senha)) return "A senha precisa de um caractere especial (como @, #, $, !).";
  if (!/[A-Za-zÀ-ÿ]{4,}/.test(senha)) return "A senha precisa de uma palavra com pelo menos 4 letras.";
  return null;
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

// ---------- Campos aceitos (sufixos dos ids do formulário, sem "pf-"/"pj-") ----------
const CAMPOS_EMPRESA = ["nome-empresa", "cnpj", "telefone-empresa", "responsavel"];
const CAMPOS_SEMPRE = [
  "motorista-nome", "motorista-sobrenome", "cpf", "celular",
  "mot-endereco", "mot-cidade", "mot-estado", "mot-cep",
  "rastreador-pri", "id-rastreador-pri", "rntrc", "val-rntrc",
  "prop-doc", "prop-mae", "prop-endereco", "prop-cidade", "prop-estado", "prop-cep",
];
const CAMPOS_CNH = [
  "nascimento", "rg", "rg-uf", "cidade-nasc", "mae", "cnh-registro", "cnh-emissao",
  "cnh-primeira", "cnh-uf", "cnh-validade", "cnh-categoria", "cnh-seguranca",
];
const CAMPOS_CAVALO = [
  "veic-placa", "veic-marca", "veic-modelo", "veic-cor", "veic-ano", "veic-cidade-emp",
  "veic-uf", "veic-tipologia", "veic-carroceria", "veic-renavam", "veic-chassi",
];
const CAMPOS_CARRETA = [
  "carreta-placa", "carreta-marca", "carreta-modelo", "carreta-cor", "carreta-ano",
  "carreta-chassi", "carreta-renavam", "carreta-cidade-emp", "carreta-uf",
];
const CAMPOS_CARRETA_SEMPRE = [
  "carreta-rntrc", "prop-carreta-doc", "prop-carreta-mae", "prop-carreta-endereco",
  "prop-carreta-cidade", "prop-carreta-estado", "prop-carreta-cep",
];
const CAMPOS_OPCIONAIS = ["rastreador-sec", "id-rastreador-sec"];
const TODOS_CAMPOS = new Set([
  ...CAMPOS_EMPRESA, ...CAMPOS_SEMPRE, ...CAMPOS_CNH, ...CAMPOS_CAVALO,
  ...CAMPOS_CARRETA, ...CAMPOS_CARRETA_SEMPRE, ...CAMPOS_OPCIONAIS,
]);

const DOCS_ACEITOS: Record<string, number> = {
  // campo: quantidade máxima de arquivos
  cnh: 3, residencia: 3, crlv_cavalo: 3, crlv_carreta: 3, rntrc: 3, complementares: 5,
};
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAX = 10 * 1024 * 1024;

const ROTULOS: Record<string, string> = {
  "nome-empresa": "Nome da empresa", "cnpj": "CNPJ", "responsavel": "Responsável",
  "motorista-nome": "Nome", "motorista-sobrenome": "Sobrenome", "cpf": "CPF", "celular": "Celular",
  "mot-endereco": "Endereço", "mot-cidade": "Cidade", "mot-estado": "Estado", "mot-cep": "CEP",
  "rastreador-pri": "Rastreador primário", "id-rastreador-pri": "ID do rastreador primário",
  "rntrc": "RNTRC/ANTT", "val-rntrc": "Validade do RNTRC",
};

function limparTexto(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v).replace(/[<>"'`]/g, "").trim().slice(0, 200);
}

function nomeArquivoSeguro(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "arquivo";
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return resp(req, 405, { erro: "Método não permitido." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    const pepper = Deno.env.get("LOGIN_PEPPER");
    if (!url || !serviceKey || !pepper) {
      console.error("solicitar-cadastro: variáveis ausentes");
      return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
    }

    const bruto = await req.text();
    if (bruto.length > 64000) return resp(req, 413, { erro: "Requisição muito grande." });
    let corpo: Record<string, unknown>;
    try { corpo = JSON.parse(bruto); } catch { return resp(req, 400, { erro: "Requisição inválida." }); }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Limite: 5 envios por hora por IP (evita robôs criando contas)
    const chaveIp = await hmac(pepper, `cadastro-ip:${ipDe(req)}`);
    if ((await contarTentativa(admin, chaveIp, 5, "1 hour", "1 hour")).bloqueado) {
      return resp(req, 429, { erro: "Muitos envios em pouco tempo. Tente novamente mais tarde." });
    }

    // ---------- Validação ----------
    const tipo = corpo.tipo === "pj" ? "pj" : corpo.tipo === "pf" ? "pf" : "";
    if (!tipo) return resp(req, 400, { erro: "Tipo de cadastro inválido." });

    const semCarreta = corpo.sem_carreta === true;
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const senha = typeof corpo.senha === "string" ? corpo.senha : "";

    const dadosBrutos = (corpo.dados && typeof corpo.dados === "object") ? corpo.dados as Record<string, unknown> : {};
    const dados: Record<string, string> = {};
    for (const [k, v] of Object.entries(dadosBrutos)) {
      if (TODOS_CAMPOS.has(k)) dados[k] = limparTexto(v);
    }

    const docsBrutos = Array.isArray(corpo.documentos) ? corpo.documentos : [];
    if (docsBrutos.length > 20) return resp(req, 400, { erro: "Arquivos demais." });
    const contagem: Record<string, number> = {};
    const docs: { campo: string; nome: string; tipo: string; tamanho: number }[] = [];
    for (const d of docsBrutos as Record<string, unknown>[]) {
      const campo = String(d?.campo ?? "");
      if (!(campo in DOCS_ACEITOS)) return resp(req, 400, { erro: "Tipo de documento inválido." });
      const tipoArq = String(d?.tipo ?? "");
      const tamanho = Number(d?.tamanho ?? 0);
      if (!TIPOS_ACEITOS.includes(tipoArq)) return resp(req, 400, { erro: "Envie apenas PDF, PNG ou JPG." });
      if (!(tamanho > 0 && tamanho <= TAMANHO_MAX)) return resp(req, 400, { erro: "Cada arquivo pode ter no máximo 10 MB." });
      contagem[campo] = (contagem[campo] ?? 0) + 1;
      if (contagem[campo] > DOCS_ACEITOS[campo]) return resp(req, 400, { erro: "Arquivos demais em um dos documentos." });
      docs.push({ campo, nome: limparTexto(d?.nome) || "arquivo", tipo: tipoArq, tamanho });
    }
    const temDoc = (c: string) => (contagem[c] ?? 0) > 0;

    const faltando: string[] = [];
    const exigir = (lista: string[]) => lista.forEach((c) => { if (!dados[c]) faltando.push(c); });
    exigir(CAMPOS_SEMPRE);
    if (tipo === "pj") exigir(["nome-empresa", "cnpj", "responsavel"]);
    if (!temDoc("cnh")) exigir(CAMPOS_CNH);
    if (!temDoc("crlv_cavalo")) exigir(CAMPOS_CAVALO);
    if (!semCarreta) {
      exigir(CAMPOS_CARRETA_SEMPRE);
      if (!temDoc("crlv_carreta")) exigir(CAMPOS_CARRETA);
    }
    if (!temDoc("residencia")) faltando.push("comprovante de residência (anexo)");
    if (faltando.length > 0) {
      return resp(req, 400, {
        erro: "Preencha os campos obrigatórios ou anexe os documentos correspondentes.",
        faltando: faltando.map((c) => ROTULOS[c] ?? c),
      });
    }

    const cpf = dados["cpf"].replace(/\D/g, "");
    if (!cpfValido(cpf)) return resp(req, 400, { erro: "CPF inválido." });
    if (!emailValido(email)) return resp(req, 400, { erro: "Informe um e-mail válido." });
    const celular = dados["celular"].replace(/\D/g, "");
    if (celular.length < 10 || celular.length > 11) return resp(req, 400, { erro: "Celular inválido." });
    const problemaSenha = erroSenha(senha, cpf);
    if (problemaSenha) return resp(req, 400, { erro: problemaSenha });
    dados["cpf"] = cpf;

    const nome = `${dados["motorista-nome"]} ${dados["motorista-sobrenome"]}`.trim().slice(0, 120);

    // ---------- CPF já existe? ----------
    const { data: existente } = await admin.from("perfis")
      .select("id, status, role").eq("cpf", cpf).maybeSingle();
    if (existente) {
      if (existente.role !== "motorista") return resp(req, 409, { erro: "Este CPF já está cadastrado." });
      if (existente.status === "aprovado") {
        return resp(req, 409, { erro: "Este CPF já tem cadastro aprovado. Entre pela tela de login." });
      }
      if (existente.status === "pendente") {
        return resp(req, 409, { erro: "Já existe um cadastro em análise para este CPF. Aguarde a gestão." });
      }
      // Recusado: apaga a conta antiga para permitir um novo envio
      await admin.from("perfis").delete().eq("id", existente.id);
      await admin.auth.admin.deleteUser(existente.id).catch(() => {});
    }

    // ---------- Cria a conta (pendente) ----------
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, cpf, telefone: celular },
      app_metadata: { role: "motorista" },
    });
    if (erroCriar || !criado?.user) {
      const msg = String(erroCriar?.message ?? "");
      if ((erroCriar as { code?: string })?.code === "email_exists" || /already|exists|registered/i.test(msg)) {
        return resp(req, 409, { erro: "Este e-mail já está cadastrado. Use outro e-mail ou recupere a senha." });
      }
      if (/database error|cpf/i.test(msg)) return resp(req, 409, { erro: "Este CPF já está cadastrado." });
      console.error("solicitar-cadastro: falha ao criar usuário:", msg);
      return resp(req, 503, { erro: "Não foi possível concluir o cadastro. Tente novamente." });
    }
    const uid = criado.user.id;

    // ---------- Grava a ficha ----------
    const { data: cad, error: erroCad } = await admin.from("cadastros_agregados").insert({
      user_id: uid, tipo, status: "pendente", nome, cpf, email, celular,
      sem_carreta: semCarreta, dados,
    }).select("id").single();
    if (erroCad || !cad) {
      console.error("solicitar-cadastro: falha ao gravar ficha:", erroCad?.message);
      await admin.auth.admin.deleteUser(uid).catch(() => {});
      return resp(req, 503, { erro: "Não foi possível concluir o cadastro. Tente novamente." });
    }

    // ---------- URLs assinadas para os documentos ----------
    const uploads: { indice: number; campo: string; path: string; token: string }[] = [];
    const documentos: Record<string, unknown>[] = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const path = `${uid}/${cad.id}/${d.campo}_${i + 1}_${nomeArquivoSeguro(d.nome)}`;
      const { data: assinado, error: erroUrl } = await admin.storage
        .from("documentos-cadastro").createSignedUploadUrl(path);
      if (erroUrl || !assinado) {
        console.error("solicitar-cadastro: falha na URL de upload:", erroUrl?.message);
        await admin.from("cadastros_agregados").delete().eq("id", cad.id);
        await admin.auth.admin.deleteUser(uid).catch(() => {});
        return resp(req, 503, { erro: "Não foi possível preparar o envio dos documentos. Tente novamente." });
      }
      uploads.push({ indice: i, campo: d.campo, path: assinado.path ?? path, token: assinado.token });
      documentos.push({ ...d, path: assinado.path ?? path });
    }
    await admin.from("cadastros_agregados").update({ documentos }).eq("id", cad.id);

    return resp(req, 200, { sucesso: true, cadastro_id: cad.id, uploads });
  } catch (e) {
    console.error("solicitar-cadastro: erro interno:", (e as Error).message);
    return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
  }
});
