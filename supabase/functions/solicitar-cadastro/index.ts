// =============================================================================
// EDGE FUNCTION: solicitar-cadastro
// AJBorges Transporte & Logística
//
// Cadastro de TERCEIROS e AGREGADOS (PF ou PJ), sem criação de conta de login.
//
// Configuração: Verify JWT DESLIGADO.
// Secrets: LOGIN_PEPPER, ALLOWED_ORIGINS.
//
// Os tokens de upload só são devolvidos após confirmar a gravação da lista
// dos documentos no cadastro.
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
      // Configuração inválida: tratada pelo handler.
    }
  }

  return undefined;
}

const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const permitida = ORIGENS.length === 0
    ? "*"
    : ORIGENS.includes(origem)
    ? origem
    : ORIGENS[0];

  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resp(req: Request, status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Não registra mensagens de erro que possam conter dados pessoais.
function codigoErro(erro: unknown): string {
  if (!erro || typeof erro !== "object") return "erro_desconhecido";

  const e = erro as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
  };

  return String(e.code ?? e.status ?? e.name ?? "erro_desconhecido");
}

async function hmac(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(texto),
  );

  return Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digito = (base: string, peso: number) => {
    let soma = 0;

    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (peso - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function emailValido(email: string): boolean {
  return email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ipDe(req: Request): string {
  return req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido";
}

type Admin = ReturnType<typeof createClient>;

async function contarTentativa(
  admin: Admin,
  chave: string,
  limite: number,
  janela: string,
  bloqueio: string,
): Promise<{ bloqueado: boolean }> {
  const { data, error } = await admin.rpc("registrar_tentativa", {
    p_chave: chave,
    p_limite: limite,
    p_janela: janela,
    p_bloqueio: bloqueio,
  });

  if (error) {
    console.error(
      "solicitar-cadastro: limite de tentativas indisponível:",
      codigoErro(error),
    );

    throw new Error("rate_limit_indisponivel");
  }

  const linha = Array.isArray(data) ? data[0] : data;

  return {
    bloqueado: !!linha?.esta_bloqueado,
  };
}

// Desfaz somente o cadastro recém-criado, ainda pendente.
// Retorna false se a remoção não puder ser confirmada.
async function desfazerCadastro(
  admin: Admin,
  cadastroId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from("cadastros_agregados")
      .delete()
      .eq("id", cadastroId)
      .eq("status", "pendente")
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "solicitar-cadastro: falha ao desfazer cadastro:",
        error ? codigoErro(error) : "cadastro_nao_removido",
      );

      return false;
    }

    return true;
  } catch (erro) {
    console.error(
      "solicitar-cadastro: exceção ao desfazer cadastro:",
      codigoErro(erro),
    );

    return false;
  }
}

// ---------- Campos aceitos ----------

const CAMPOS_ACESSO = [
  "motorista-nome",
  "motorista-sobrenome",
  "cpf",
  "celular",
];

const CAMPOS_EMPRESA = [
  "nome-empresa",
  "cnpj",
  "telefone-empresa",
  "responsavel",
];

const CAMPOS_CNH = [
  "nascimento",
  "rg",
  "rg-uf",
  "uf-nasc",
  "cidade-nasc",
  "mae",
  "cnh-registro",
  "cnh-emissao",
  "cnh-primeira",
  "cnh-uf",
  "cnh-validade",
  "cnh-categoria",
  "cnh-seguranca",
];

const CAMPOS_CRLV_SUFIXOS = [
  "placa",
  "renavam",
  "chassi",
  "marca",
  "modelo",
  "ano",
  "cor",
  "cidade-emp",
  "uf",
  "prop-nome",
  "prop-doc",
];

const camposCrlv = (n: number) =>
  CAMPOS_CRLV_SUFIXOS.map((s) => `crlv${n}-${s}`);

const CAMPOS_RNTRC = [
  "rntrc",
  "val-rntrc",
];

const CAMPOS_RESIDENCIA = [
  "mot-endereco",
  "mot-cidade",
  "mot-estado",
  "mot-cep",
];

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
  "Treminhão/Tritrem": [
    "Caminhão",
    "1º reboque",
    "2º reboque",
    "3º reboque",
  ],
};

// As 27 UFs, no formato do select do formulário ("São Paulo (SP)").
const UFS = [
  "Acre (AC)",
  "Alagoas (AL)",
  "Amapá (AP)",
  "Amazonas (AM)",
  "Bahia (BA)",
  "Ceará (CE)",
  "Distrito Federal (DF)",
  "Espírito Santo (ES)",
  "Goiás (GO)",
  "Maranhão (MA)",
  "Mato Grosso (MT)",
  "Mato Grosso do Sul (MS)",
  "Minas Gerais (MG)",
  "Pará (PA)",
  "Paraíba (PB)",
  "Paraná (PR)",
  "Pernambuco (PE)",
  "Piauí (PI)",
  "Rio de Janeiro (RJ)",
  "Rio Grande do Norte (RN)",
  "Rio Grande do Sul (RS)",
  "Rondônia (RO)",
  "Roraima (RR)",
  "Santa Catarina (SC)",
  "São Paulo (SP)",
  "Sergipe (SE)",
  "Tocantins (TO)",
];

const nomeCrlv = (papel: string) =>
  `CRLV ${/carreta$/i.test(papel) ? "da" : "do"} ${papel}`;

const MAX_ARQUIVOS = 3;
const TIPOS_ACEITOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

const TAMANHO_MAX = 10 * 1024 * 1024;

const ROTULOS: Record<string, string> = {
  "nome-empresa": "Nome da empresa",
  "cnpj": "CNPJ",
  "telefone-empresa": "Telefone da empresa",
  "responsavel": "Responsável",
  "motorista-nome": "Nome",
  "motorista-sobrenome": "Sobrenome",
  "cpf": "CPF",
  "celular": "Celular",
  "nascimento": "Data de nascimento",
  "rg": "RG",
  "rg-uf": "UF do RG",
  "uf-nasc": "Estado de nascimento",
  "cidade-nasc": "Cidade de nascimento",
  "mae": "Nome da mãe",
  "cnh-registro": "Registro da CNH",
  "cnh-emissao": "Emissão da CNH",
  "cnh-primeira": "Data da 1ª CNH",
  "cnh-uf": "UF da CNH",
  "cnh-validade": "Validade da CNH",
  "cnh-categoria": "Categoria da CNH",
  "cnh-seguranca": "Código de segurança da CNH",
  "rntrc": "RNTRC: Número",
  "val-rntrc": "RNTRC: Validade",
};

const ROTULOS_CRLV: Record<string, string> = {
  "placa": "Placa",
  "renavam": "RENAVAM",
  "chassi": "Chassi",
  "marca": "Marca",
  "modelo": "Modelo",
  "ano": "Ano",
  "cor": "Cor",
  "cidade-emp": "Cidade de emplacamento",
  "uf": "UF",
  "prop-nome": "Nome do proprietário",
  "prop-doc": "CPF/CNPJ do proprietário",
};

function limparTexto(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number") {
    return "";
  }

  return String(v)
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 200);
}

function nomeArquivoSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80) || "arquivo";
}

function objetoValido(
  valor: unknown,
): valor is Record<string, unknown> {
  return valor !== null &&
    typeof valor === "object" &&
    !Array.isArray(valor);
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors(req),
    });
  }

  if (req.method !== "POST") {
    return resp(req, 405, {
      erro: "Método não permitido.",
    });
  }

  let admin: Admin | null = null;
  let cadastroCriadoId: string | null = null;
  let cadastroPreparado = false;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = lerChave(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEYS",
    );

    const pepper = Deno.env.get("LOGIN_PEPPER");

    if (!url || !serviceKey || !pepper) {
      console.error("solicitar-cadastro: variáveis ausentes");

      return resp(req, 503, {
        erro: "Serviço temporariamente indisponível.",
      });
    }

    const bruto = await req.text();

    if (bruto.length > 64000) {
      return resp(req, 413, {
        erro: "Requisição muito grande.",
      });
    }

    let recebido: unknown;

    try {
      recebido = JSON.parse(bruto);
    } catch {
      return resp(req, 400, {
        erro: "Requisição inválida.",
      });
    }

    if (!objetoValido(recebido)) {
      return resp(req, 400, {
        erro: "Requisição inválida.",
      });
    }

    const corpo = recebido;

    // ---------- Aceite da Política de Privacidade (LGPD) ----------

    if (corpo.aceite_lgpd !== true) {
      return resp(req, 400, {
        erro: "É preciso aceitar a Política de Privacidade para enviar o cadastro.",
      });
    }

    const versaoPolitica = limparTexto(corpo.versao_politica).slice(0, 20);

    admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Limite de 5 envios por hora por IP.
    const chaveIp = await hmac(
      pepper,
      `cadastro-ip:${ipDe(req)}`,
    );

    const tentativa = await contarTentativa(
      admin,
      chaveIp,
      5,
      "1 hour",
      "1 hour",
    );

    if (tentativa.bloqueado) {
      return resp(req, 429, {
        erro: "Muitos envios em pouco tempo. Tente novamente mais tarde.",
      });
    }

    // ---------- Tipo e tipologia ----------

    const tipo = corpo.tipo === "pj"
      ? "pj"
      : corpo.tipo === "pf"
      ? "pf"
      : "";

    if (!tipo) {
      return resp(req, 400, {
        erro: "Tipo de cadastro inválido.",
      });
    }

    const tipologia = typeof corpo.tipologia === "string"
      ? corpo.tipologia
      : "";

    if (!Object.hasOwn(TIPOLOGIAS, tipologia)) {
      return resp(req, 400, {
        erro: "Tipo de veículo inválido.",
      });
    }

    const papeis = TIPOLOGIAS[tipologia];
    const n = papeis.length;

    // ---------- E-mail opcional ----------

    if (
      corpo.email !== undefined &&
      corpo.email !== null &&
      typeof corpo.email !== "string"
    ) {
      return resp(req, 400, {
        erro: "Informe um e-mail válido para contato ou deixe o campo em branco.",
      });
    }

    const emailBruto = typeof corpo.email === "string"
      ? corpo.email.trim().toLowerCase()
      : "";

    let email: string | null = null;

    if (emailBruto) {
      if (!emailValido(emailBruto)) {
        return resp(req, 400, {
          erro: "Informe um e-mail válido para contato ou deixe o campo em branco.",
        });
      }

      email = emailBruto;
    }

    // ---------- Documentos deste envio ----------

    const documentosDoEnvio: Record<string, string> = {
      cnh: "a CNH",
    };

    papeis.forEach((papel, i) => {
      documentosDoEnvio[`crlv_${i + 1}`] = `o ${nomeCrlv(papel)}`;
    });

    documentosDoEnvio.rntrc = "o RNTRC";
    documentosDoEnvio.residencia = "o comprovante de residência";

    const semPdfBruto = objetoValido(corpo.sem_pdf)
      ? corpo.sem_pdf
      : {};

    const semPdf: Record<string, boolean> = {};

    for (const campo of Object.keys(documentosDoEnvio)) {
      semPdf[campo] = semPdfBruto[campo] === true;
    }

    // ---------- Campos permitidos ----------

    const camposDoc: Record<string, string[]> = {
      cnh: CAMPOS_CNH,
      rntrc: CAMPOS_RNTRC,
      residencia: CAMPOS_RESIDENCIA,
    };

    for (let i = 1; i <= n; i++) {
      camposDoc[`crlv_${i}`] = camposCrlv(i);
    }

    const permitidos = new Set([
      ...CAMPOS_ACESSO,
      ...(tipo === "pj" ? CAMPOS_EMPRESA : []),
    ]);

    for (const [campo, lista] of Object.entries(camposDoc)) {
      if (semPdf[campo]) {
        lista.forEach((c) => permitidos.add(c));
      }
    }

    const dadosBrutos = objetoValido(corpo.dados)
      ? corpo.dados
      : {};

    const dados: Record<string, string> = {};

    for (const [k, v] of Object.entries(dadosBrutos)) {
      const valor = limparTexto(v);

      if (!valor) continue;

      if (!permitidos.has(k)) {
        return resp(req, 400, {
          erro: "O formulário enviou um campo inesperado. Atualize a página e tente novamente.",
        });
      }

      dados[k] = valor;
    }

    // ---------- Estados (mesmos valores do select do formulário) ----------

    for (const [k, v] of Object.entries(dados)) {
      const ehEstado = k === "uf-nasc" ||
        k === "mot-estado" ||
        /^crlv\d+-uf$/.test(k);

      if (ehEstado && !UFS.includes(v)) {
        return resp(req, 400, {
          erro: "Estado inválido.",
        });
      }
    }

    // ---------- Validação dos anexos ----------

    const docsBrutos = objetoValido(corpo.documentos)
      ? corpo.documentos
      : {};

    const contagem: Record<string, number> = {};

    const docs: {
      campo: string;
      nome: string;
      tipo: string;
      tamanho: number;
    }[] = [];

    for (const [campo, lista] of Object.entries(docsBrutos)) {
      if (
        !Object.hasOwn(documentosDoEnvio, campo) ||
        !Array.isArray(lista)
      ) {
        return resp(req, 400, {
          erro: "Tipo de documento inválido.",
        });
      }

      if (lista.length === 0) continue;

      if (semPdf[campo]) {
        return resp(req, 400, {
          erro: `Você marcou "não tenho o PDF" para ${
            documentosDoEnvio[campo]
          }, mas anexou um arquivo. Desmarque a caixa ou remova o anexo.`,
        });
      }

      if (lista.length > MAX_ARQUIVOS) {
        return resp(req, 400, {
          erro: `Envie no máximo ${MAX_ARQUIVOS} arquivos para ${
            documentosDoEnvio[campo]
          }.`,
        });
      }

      for (const documento of lista) {
        if (!objetoValido(documento)) {
          return resp(req, 400, {
            erro: "Documento inválido.",
          });
        }

        const tipoArq = String(documento.tipo ?? "");
        const tamanho = Number(documento.tamanho ?? 0);

        if (!TIPOS_ACEITOS.includes(tipoArq)) {
          return resp(req, 400, {
            erro: "Envie apenas PDF, PNG ou JPG.",
          });
        }

        if (
          !Number.isFinite(tamanho) ||
          !Number.isInteger(tamanho) ||
          tamanho <= 0 ||
          tamanho > TAMANHO_MAX
        ) {
          return resp(req, 400, {
            erro: "Cada arquivo deve ter tamanho válido e no máximo 10 MB.",
          });
        }

        docs.push({
          campo,
          nome: limparTexto(documento.nome) || "arquivo",
          tipo: tipoArq,
          tamanho,
        });
      }

      contagem[campo] = lista.length;
    }

    const temDoc = (campo: string) =>
      (contagem[campo] ?? 0) > 0;

    // ---------- Regra: anexo ou formulário ----------

    for (
      const campo of [
        "cnh",
        ...papeis.map((_, i) => `crlv_${i + 1}`),
        "rntrc",
      ]
    ) {
      if (!semPdf[campo] && !temDoc(campo)) {
        return resp(req, 400, {
          erro: `Anexe ${
            documentosDoEnvio[campo]
          } ou marque que não tem o PDF.`,
        });
      }
    }

    const faltando: string[] = [];

    const exigir = (
      lista: string[],
      rotulo: (campo: string) => string,
    ) => {
      lista.forEach((campo) => {
        if (!dados[campo]) {
          faltando.push(rotulo(campo));
        }
      });
    };

    exigir(
      CAMPOS_ACESSO,
      (campo) => ROTULOS[campo] ?? campo,
    );

    if (tipo === "pj") {
      exigir(
        CAMPOS_EMPRESA,
        (campo) => ROTULOS[campo] ?? campo,
      );
    }

    if (semPdf.cnh) {
      exigir(
        CAMPOS_CNH,
        (campo) => ROTULOS[campo] ?? campo,
      );
    }

    papeis.forEach((papel, i) => {
      if (semPdf[`crlv_${i + 1}`]) {
        exigir(
          camposCrlv(i + 1),
          (campo) =>
            `${nomeCrlv(papel)}: ${
              ROTULOS_CRLV[campo.replace(/^crlv\d+-/, "")] ?? campo
            }`,
        );
      }
    });

    if (semPdf.rntrc) {
      exigir(
        CAMPOS_RNTRC,
        (campo) => ROTULOS[campo] ?? campo,
      );
    }

    if (faltando.length > 0) {
      return resp(req, 400, {
        erro: 'Preencha os campos obrigatórios dos documentos que você marcou como "não tenho o PDF".',
        faltando,
      });
    }

    if (
      semPdf.rntrc &&
      !/^\d{8,12}$/.test(dados.rntrc)
    ) {
      return resp(req, 400, {
        erro: "RNTRC inválido.",
      });
    }

    // ---------- CPF e celular ----------

    const cpf = dados.cpf.replace(/\D/g, "");

    if (!cpfValido(cpf)) {
      return resp(req, 400, {
        erro: "CPF inválido.",
      });
    }

    const celular = dados.celular.replace(/\D/g, "");

    if (celular.length < 10 || celular.length > 11) {
      return resp(req, 400, {
        erro: "Celular inválido.",
      });
    }

    dados.cpf = cpf;

    const nome = `${
      dados["motorista-nome"]
    } ${dados["motorista-sobrenome"]}`
      .trim()
      .slice(0, 120);

    // ---------- CPF com cadastro ativo ----------

    const { data: cadastrosCpf, error: erroConsulta } = await admin
      .from("cadastros_agregados")
      .select("id, status")
      .eq("cpf", cpf);

    if (erroConsulta) {
      console.error(
        "solicitar-cadastro: falha ao consultar CPF:",
        codigoErro(erroConsulta),
      );

      return resp(req, 503, {
        erro: "Não foi possível verificar cadastros anteriores. Tente novamente.",
      });
    }

    const temAtivo = (cadastrosCpf ?? []).some(
      (cadastro) =>
        ["pendente", "analise", "aprovado"].includes(cadastro.status),
    );

    if (temAtivo) {
      return resp(req, 409, {
        erro: "Já existe um cadastro para este CPF. Se precisar atualizar algum documento, fale com o time de Cadastros da AJBorges.",
      });
    }

    // ---------- Criação sem conta de login ----------

    const { data: cad, error: erroCad } = await admin
      .from("cadastros_agregados")
      .insert({
        user_id: null,
        tipo,
        status: "pendente",
        nome,
        cpf,
        email,
        celular,
        sem_carreta: n === 1,
        dados: {
          ...dados,
          _tipologia: tipologia,
          _sem_pdf: semPdf,
          _aceite_lgpd: {
            em: new Date().toISOString(),
            versao: versaoPolitica,
          },
        },
      })
      .select("id")
      .single();

    if (erroCad || !cad) {
      console.error(
        "solicitar-cadastro: falha ao gravar cadastro:",
        erroCad ? codigoErro(erroCad) : "cadastro_nao_criado",
      );

      return resp(req, 503, {
        erro: "Não foi possível concluir o cadastro. Tente novamente.",
      });
    }

    cadastroCriadoId = cad.id;

    // ---------- Preparação dos uploads ----------

    const uploads: {
      indice: number;
      campo: string;
      path: string;
      token: string;
    }[] = [];

    const documentos: Record<string, unknown>[] = [];

    for (let i = 0; i < docs.length; i++) {
      const documento = docs[i];

      const path = `terceiros/${cad.id}/${documento.campo}_${
        i + 1
      }_${nomeArquivoSeguro(documento.nome)}`;

      const { data: assinado, error: erroUrl } = await admin.storage
        .from("documentos-cadastro")
        .createSignedUploadUrl(path);

      if (
        erroUrl ||
        !assinado ||
        typeof assinado.token !== "string" ||
        !assinado.token
      ) {
        console.error(
          "solicitar-cadastro: falha na URL de upload:",
          erroUrl ? codigoErro(erroUrl) : "token_ausente",
        );

        const desfeito = await desfazerCadastro(admin, cad.id);

        return resp(req, 503, {
          erro: desfeito
            ? "Não foi possível preparar o envio dos documentos. Tente novamente mais tarde."
            : "Não foi possível concluir o envio. Entre em contato com o time de Cadastros antes de tentar novamente.",
        });
      }

      const caminho = assinado.path ?? path;

      uploads.push({
        indice: i,
        campo: documento.campo,
        path: caminho,
        token: assinado.token,
      });

      documentos.push({
        ...documento,
        path: caminho,
      });
    }

    // ---------- Confirmação da gravação dos documentos ----------

    const {
      data: cadastroAtualizado,
      error: erroDocumentos,
    } = await admin
      .from("cadastros_agregados")
      .update({ documentos })
      .eq("id", cad.id)
      .select("id")
      .single();

    if (erroDocumentos || !cadastroAtualizado) {
      console.error(
        "solicitar-cadastro: falha ao registrar documentos:",
        erroDocumentos
          ? codigoErro(erroDocumentos)
          : "cadastro_nao_atualizado",
      );

      const desfeito = await desfazerCadastro(admin, cad.id);

      return resp(req, 503, {
        erro: desfeito
          ? "Não foi possível preparar o envio dos documentos. Tente novamente mais tarde."
          : "Não foi possível concluir o envio. Entre em contato com o time de Cadastros antes de tentar novamente.",
      });
    }

    cadastroPreparado = true;

    return resp(req, 200, {
      sucesso: true,
      cadastro_id: cad.id,
      uploads,
    });
  } catch (erro) {
    console.error(
      "solicitar-cadastro: erro interno:",
      codigoErro(erro),
    );

    // Também tenta desfazer em caso de exceção durante a preparação.
    if (admin && cadastroCriadoId && !cadastroPreparado) {
      const desfeito = await desfazerCadastro(
        admin,
        cadastroCriadoId,
      );

      if (!desfeito) {
        return resp(req, 503, {
          erro: "Não foi possível concluir o envio. Entre em contato com o time de Cadastros antes de tentar novamente.",
        });
      }
    }

    return resp(req, 503, {
      erro: "Serviço temporariamente indisponível. Tente novamente mais tarde.",
    });
  }
});