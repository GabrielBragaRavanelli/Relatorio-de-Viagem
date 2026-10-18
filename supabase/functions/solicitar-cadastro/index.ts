// =============================================================================
// EDGE FUNCTION: solicitar-cadastro
// AJBorges Transporte & Logística - "Seja um Agregado Conosco"
//
// Recebe a ficha de cadastro de TERCEIROS e AGREGADOS (PF ou PJ).
//
// Terceiros NÃO possuem conta de login nem acessam fichas de viagem.
// Esta função:
//   1. Valida dados de identificação e veículos;
//   2. Não cria usuário em auth.users (user_id vai null);
//   3. Valida e-mail como opcional (apenas para contato);
//   4. Bloqueia CPF duplicado com cadastro pendente, em análise ou aprovado (409);
//   5. Grava a ficha na tabela cadastros_agregados;
//   6. Gera URLs assinadas para envio direto ao bucket "documentos-cadastro"
//      no caminho padronizado: terceiros/{cadastro_id}/{campo}_{i}_{nome}.
//
// Configuração no painel: Verify JWT DESLIGADO (quem chama ainda não tem conta).
// Secrets: LOGIN_PEPPER, ALLOWED_ORIGINS.
//
// Regra "anexo OU formulário", por documento (caixa "Não tenho o PDF"):
//   - CNH e cada CRLV (um por veículo da tipologia): sem_pdf false -> anexo
//     obrigatório e sem campos; sem_pdf true -> campos obrigatórios e sem anexo
//   - RNTRC (um por cadastro, do transportador): mesma regra da CNH
//   - Comprovante de residência: sempre opcional (anexo OU campos)
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

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);

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
const CAMPOS_ACESSO = ["motorista-nome", "motorista-sobrenome", "cpf", "celular"];
const CAMPOS_EMPRESA = ["nome-empresa", "cnpj", "telefone-empresa", "responsavel"];
const CAMPOS_CNH = [
  "nascimento", "rg", "rg-uf", "cidade-nasc", "mae", "cnh-registro", "cnh-emissao",
  "cnh-primeira", "cnh-uf", "cnh-validade", "cnh-categoria", "cnh-seguranca",
];
// Campos de cada CRLV: crlv{N}-<sufixo>, N = 1..4 (ordem da tipologia)
const CAMPOS_CRLV_SUFIXOS = [
  "placa", "renavam", "chassi", "marca", "modelo", "ano", "cor", "cidade-emp", "uf", "prop-nome", "prop-doc",
];
const camposCrlv = (n: number) => CAMPOS_CRLV_SUFIXOS.map((s) => `crlv${n}-${s}`);
const CAMPOS_RNTRC = ["rntrc", "val-rntrc"];
const CAMPOS_RESIDENCIA = ["mot-endereco", "mot-cidade", "mot-estado", "mot-cep"];

// Tipo de veículo -> veículos (um CRLV por veículo, na ordem)
const TIPOLOGIAS: Record<string, string[]> = {
  "VUC/¾": ["Caminhão"],
  "Toco (4×2)": ["Caminhão"],
  "Truck (6×2)": ["Caminhão"],
  "Bitruck (8×2)": ["Caminhão"],
  "Cavalo 4×2": ["Cavalo"],
  "Cavalo 6×2": ["Cavalo"],
  "Cavalo 6×4": ["Cavalo"],
  "Carreta simples (2e)": ["Cavalo", "Carreta"],
  "Carreta LS 3e": ["Cavalo", "Carreta"],
  "Romeu e Julieta": ["Caminhão", "Reboque"],
  "Bitrem": ["Cavalo", "1ª carreta", "2ª carreta"],
  "Rodotrem": ["Cavalo", "1ª carreta", "2ª carreta"],
  "Treminhão/Tritrem": ["Caminhão", "1º reboque", "2º reboque", "3º reboque"],
};
// "CRLV do Cavalo", "CRLV da 1ª carreta"
const nomeCrlv = (papel: string) => `CRLV ${/carreta$/i.test(papel) ? "da" : "do"} ${papel}`;

const MAX_ARQUIVOS = 3; // por documento
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAX = 10 * 1024 * 1024;

const ROTULOS: Record<string, string> = {
  "nome-empresa": "Nome da empresa", "cnpj": "CNPJ", "telefone-empresa": "Telefone da empresa", "responsavel": "Responsável",
  "motorista-nome": "Nome", "motorista-sobrenome": "Sobrenome", "cpf": "CPF", "celular": "Celular",
  "nascimento": "Data de nascimento", "rg": "RG", "rg-uf": "UF do RG", "cidade-nasc": "Cidade de nascimento",
  "mae": "Nome da mãe", "cnh-registro": "Registro da CNH", "cnh-emissao": "Emissão da CNH",
  "cnh-primeira": "Data da 1ª CNH", "cnh-uf": "UF da CNH", "cnh-validade": "Validade da CNH",
  "cnh-categoria": "Categoria da CNH", "cnh-seguranca": "Código de segurança da CNH",
  "rntrc": "RNTRC: Número", "val-rntrc": "RNTRC: Validade",
};
const ROTULOS_CRLV: Record<string, string> = {
  "placa": "Placa", "renavam": "RENAVAM", "chassi": "Chassi", "marca": "Marca", "modelo": "Modelo",
  "ano": "Ano", "cor": "Cor", "cidade-emp": "Cidade de emplacamento", "uf": "UF",
  "prop-nome": "Nome do proprietário", "prop-doc": "CPF/CNPJ do proprietário",
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

    // Limite: 5 envios por hora por IP (evita robôs enviando spam)
    const chaveIp = await hmac(pepper, `cadastro-ip:${ipDe(req)}`);
    if ((await contarTentativa(admin, chaveIp, 5, "1 hour", "1 hour")).bloqueado) {
      return resp(req, 429, { erro: "Muitos envios em pouco tempo. Tente novamente mais tarde." });
    }

    // ---------- Validação de Tipologia e Tipo ----------
    const tipo = corpo.tipo === "pj" ? "pj" : corpo.tipo === "pf" ? "pf" : "";
    if (!tipo) return resp(req, 400, { erro: "Tipo de cadastro inválido." });

    const tipologia = typeof corpo.tipologia === "string" ? corpo.tipologia : "";
    if (!Object.hasOwn(TIPOLOGIAS, tipologia)) return resp(req, 400, { erro: "Tipo de veículo inválido." });
    const papeis = TIPOLOGIAS[tipologia];
    const n = papeis.length;

    // E-mail é opcional (para contato). Se informado, valida o formato.
    const emailBruto = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
    let email: string | null = null;
    if (emailBruto) {
      if (!emailValido(emailBruto)) {
        return resp(req, 400, { erro: "Informe um e-mail válido para contato ou deixe o campo em branco." });
      }
      email = emailBruto;
    }

    // Documentos deste envio: nome no servidor -> descrição (com artigo) para as mensagens
    const documentosDoEnvio: Record<string, string> = { cnh: "a CNH" };
    papeis.forEach((papel, i) => { documentosDoEnvio[`crlv_${i + 1}`] = `o ${nomeCrlv(papel)}`; });
    documentosDoEnvio.rntrc = "o RNTRC";
    documentosDoEnvio.residencia = "o comprovante de residência";

    const semPdfBruto = (corpo.sem_pdf && typeof corpo.sem_pdf === "object") ? corpo.sem_pdf as Record<string, unknown> : {};
    const semPdf: Record<string, boolean> = {};
    for (const campo of Object.keys(documentosDoEnvio)) semPdf[campo] = semPdfBruto[campo] === true;

    // Campos permitidos: acesso, empresa (PJ) e os formulários abertos (caixa marcada)
    const camposDoc: Record<string, string[]> = { cnh: CAMPOS_CNH, rntrc: CAMPOS_RNTRC, residencia: CAMPOS_RESIDENCIA };
    for (let i = 1; i <= n; i++) camposDoc[`crlv_${i}`] = camposCrlv(i);
    const permitidos = new Set([...CAMPOS_ACESSO, ...(tipo === "pj" ? CAMPOS_EMPRESA : [])]);
    for (const [campo, lista] of Object.entries(camposDoc)) if (semPdf[campo]) lista.forEach((c) => permitidos.add(c));

    const dadosBrutos = (corpo.dados && typeof corpo.dados === "object") ? corpo.dados as Record<string, unknown> : {};
    const dados: Record<string, string> = {};
    for (const [k, v] of Object.entries(dadosBrutos)) {
      const valor = limparTexto(v);
      if (!valor) continue;
      if (!permitidos.has(k)) return resp(req, 400, { erro: "O formulário enviou um campo inesperado. Atualize a página e tente novamente." });
      dados[k] = valor;
    }

    const docsBrutos = (corpo.documentos && typeof corpo.documentos === "object" && !Array.isArray(corpo.documentos))
      ? corpo.documentos as Record<string, unknown> : {};
    const contagem: Record<string, number> = {};
    const docs: { campo: string; nome: string; tipo: string; tamanho: number }[] = [];
    for (const [campo, lista] of Object.entries(docsBrutos)) {
      if (!Object.hasOwn(documentosDoEnvio, campo) || !Array.isArray(lista)) {
        return resp(req, 400, { erro: "Tipo de documento inválido." });
      }
      if (lista.length === 0) continue;
      if (semPdf[campo]) {
        return resp(req, 400, { erro: `Você marcou "não tenho o PDF" para ${documentosDoEnvio[campo]}, mas anexou um arquivo. Desmarque a caixa ou remova o anexo.` });
      }
      if (lista.length > MAX_ARQUIVOS) {
        return resp(req, 400, { erro: `Envie no máximo ${MAX_ARQUIVOS} arquivos para ${documentosDoEnvio[campo]}.` });
      }
      for (const d of lista as Record<string, unknown>[]) {
        const tipoArq = String(d?.tipo ?? "");
        const tamanho = Number(d?.tamanho ?? 0);
        if (!TIPOS_ACEITOS.includes(tipoArq)) return resp(req, 400, { erro: "Envie apenas PDF, PNG ou JPG." });
        if (!(tamanho > 0 && tamanho <= TAMANHO_MAX)) return resp(req, 400, { erro: "Cada arquivo pode ter no máximo 10 MB." });
        docs.push({ campo, nome: limparTexto(d?.nome) || "arquivo", tipo: tipoArq, tamanho });
      }
      contagem[campo] = lista.length;
    }
    const temDoc = (c: string) => (contagem[c] ?? 0) > 0;

    // CNH, CRLVs e RNTRC: anexo obrigatório, ou formulário completo se marcou "não tenho o PDF"
    for (const campo of ["cnh", ...papeis.map((_, i) => `crlv_${i + 1}`), "rntrc"]) {
      if (!semPdf[campo] && !temDoc(campo)) {
        return resp(req, 400, { erro: `Anexe ${documentosDoEnvio[campo]} ou marque que não tem o PDF.` });
      }
    }
    const faltando: string[] = [];
    const exigir = (lista: string[], rotulo: (c: string) => string) =>
      lista.forEach((c) => { if (!dados[c]) faltando.push(rotulo(c)); });
    exigir(CAMPOS_ACESSO, (c) => ROTULOS[c] ?? c);
    if (tipo === "pj") exigir(["nome-empresa", "cnpj", "telefone-empresa", "responsavel"], (c) => ROTULOS[c] ?? c);
    if (semPdf.cnh) exigir(CAMPOS_CNH, (c) => ROTULOS[c] ?? c);
    papeis.forEach((papel, i) => {
      if (semPdf[`crlv_${i + 1}`]) {
        exigir(camposCrlv(i + 1), (c) => `${nomeCrlv(papel)}: ${ROTULOS_CRLV[c.replace(/^crlv\d-/, "")]}`);
      }
    });
    if (semPdf.rntrc) exigir(CAMPOS_RNTRC, (c) => ROTULOS[c] ?? c);
    if (faltando.length > 0) {
      return resp(req, 400, {
        erro: "Preencha os campos obrigatórios dos documentos que você marcou como \"não tenho o PDF\".",
        faltando,
      });
    }

    if (semPdf.rntrc && !/^\d{8,12}$/.test(dados["rntrc"])) return resp(req, 400, { erro: "RNTRC inválido." });

    const cpf = dados["cpf"].replace(/\D/g, "");
    if (!cpfValido(cpf)) return resp(req, 400, { erro: "CPF inválido." });
    const celular = dados["celular"].replace(/\D/g, "");
    if (celular.length < 10 || celular.length > 11) return resp(req, 400, { erro: "Celular inválido." });
    dados["cpf"] = cpf;

    const nome = `${dados["motorista-nome"]} ${dados["motorista-sobrenome"]}`.trim().slice(0, 120);

    // ---------- CPF já existe em cadastros_agregados? ----------
    // Bloqueia se já tiver cadastro pendente, em análise ou aprovado (409)
    // Se só tiver cadastros recusados, permite novo envio (o recusado fica até os 90 dias da LGPD)
    const { data: cadastrosCpf, error: erroConsulta } = await admin
      .from("cadastros_agregados")
      .select("id, status")
      .eq("cpf", cpf);

    if (erroConsulta) {
      console.error("solicitar-cadastro: falha ao consultar CPF:", erroConsulta.message);
      return resp(req, 503, { erro: "Não foi possível verificar cadastros anteriores. Tente novamente." });
    }

    const temAtivo = (cadastrosCpf ?? []).some((c: { status?: string }) => ["pendente", "analise", "aprovado"].includes(c.status ?? ""));
    if (temAtivo) {
      return resp(req, 409, {
        erro: "Já existe um cadastro para este CPF. Se precisar atualizar algum documento, fale com o time de Cadastros da AJBorges.",
      });
    }

    // ---------- Grava a ficha (SEM criar conta de usuário: user_id = null) ----------
    const { data: cad, error: erroCad } = await admin.from("cadastros_agregados").insert({
      user_id: null,
      tipo,
      status: "pendente",
      nome,
      cpf,
      email,
      celular,
      sem_carreta: n === 1,
      dados: { ...dados, _tipologia: tipologia, _sem_pdf: semPdf },
    }).select("id").single();

    if (erroCad || !cad) {
      console.error("solicitar-cadastro: falha ao gravar ficha:", erroCad?.message);
      return resp(req, 503, { erro: "Não foi possível concluir o cadastro. Tente novamente." });
    }

    // ---------- URLs assinadas para os documentos (pasta: terceiros/{cad.id}/...) ----------
    const uploads: { indice: number; campo: string; path: string; token: string }[] = [];
    const documentos: Record<string, unknown>[] = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const path = `terceiros/${cad.id}/${d.campo}_${i + 1}_${nomeArquivoSeguro(d.nome)}`;
      const { data: assinado, error: erroUrl } = await admin.storage
        .from("documentos-cadastro").createSignedUploadUrl(path);
      if (erroUrl || !assinado) {
        console.error("solicitar-cadastro: falha na URL de upload:", erroUrl?.message);
        // Rollback: apaga apenas a linha recém-criada em cadastros_agregados
        await admin.from("cadastros_agregados").delete().eq("id", cad.id);
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
