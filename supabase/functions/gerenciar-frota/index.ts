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
// status 'inativo' e a RPC encerrar_sessoes_usuario) e do passo13_comissao_motorista.sql
// (tipo_veiculo, comissao_alim_carreta e comissao_alim_rodotrem em perfis).
//
// Ações (POST JSON, campo "acao"):
//   importar        { motoristas: [{ linha?, nome, cpf, celular }] }  (até 200; todos carreta)
//   criar           { nome, cpf, celular, email?, senha?,
//                     tipo_veiculo?, comissao_alim_carreta?, comissao_alim_rodotrem? }
//   editar          { id, nome, cpf, celular, tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem }
//                   CPF novo = senha padrão do CPF novo, e-mail interno novo e sessões encerradas
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

// ---------- Tipo de veículo e comissões especiais do Alimentício (passo 13) ----------
const TIPOS_VEICULO = ["carreta", "rodotrem", "carreta_rodotrem"];

type Veiculo = {
  tipo_veiculo: string;
  comissao_alim_carreta: number | null;
  comissao_alim_rodotrem: number | null;
};

// Vazio = carreta (o padrão); outro texto fora da lista = inválido (null)
function lerTipoVeiculo(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return "carreta";
  return typeof v === "string" && TIPOS_VEICULO.includes(v) ? v : null;
}

// Comissão em %: vazio = null (segue a regra normal); aceita 10.5 ou "10,5";
// de 0 a 100 com até 2 casas. undefined no retorno = inválido.
function lerComissao(v: unknown): number | null | undefined {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  const t = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 0 && n <= 100 ? n : undefined;
}

// Os três campos do corpo; erro = mensagem para responder 400.
// Motorista só de carreta não usa a comissão de rodotrem: ela fica vazia.
function lerVeiculo(corpo: Record<string, unknown>): { ok: true; dados: Veiculo } | { ok: false; erro: string } {
  const tipo = lerTipoVeiculo(corpo.tipo_veiculo);
  if (!tipo) return { ok: false, erro: "Tipo de veículo inválido. Use carreta, rodotrem ou carreta_rodotrem." };
  const carreta = lerComissao(corpo.comissao_alim_carreta);
  if (carreta === undefined) return { ok: false, erro: "Comissão especial de carreta inválida. Use um número de 0 a 100 (ex.: 10,5) ou deixe em branco." };
  const rodotrem = lerComissao(corpo.comissao_alim_rodotrem);
  if (rodotrem === undefined) return { ok: false, erro: "Comissão especial de rodotrem inválida. Use um número de 0 a 100 (ex.: 10,5) ou deixe em branco." };
  return {
    ok: true,
    dados: { tipo_veiculo: tipo, comissao_alim_carreta: carreta, comissao_alim_rodotrem: tipo === "carreta" ? null : rodotrem },
  };
}

type Admin = ReturnType<typeof createClient>;
type Resultado = { ok: true; id: string } | { ok: false; status: number; motivo: string };

// Cria a conta e marca o perfil como frota aprovada. Desfaz a conta se algo falhar.
// veiculo vazio = o padrão da tabela (carreta, sem comissões especiais).
async function criarMotorista(admin: Admin, m: { nome: string; cpf: string; celular: string; email: string; senha: string; veiculo?: Veiculo }): Promise<Resultado> {
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
    ...(m.veiculo ?? {}),
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
      const veiculo = lerVeiculo(corpo);
      if (!veiculo.ok) return resp(req, 400, { erro: veiculo.erro });

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

      const r = await criarMotorista(admin, { nome, cpf, celular, email, senha, veiculo: veiculo.dados });
      if (!r.ok) return resp(req, r.status, { erro: r.motivo });

      console.log(`gerenciar-frota: criar por ${quem.user.id} id=${r.id} tipo=${veiculo.dados.tipo_veiculo}`);
      return resp(req, 200, { sucesso: true, id: r.id });
    }

    // ---------------- editar ----------------
    // Ordem: perfis primeiro (dá para voltar com os valores antigos) e depois o Auth numa
    // chamada só (metadados, senha e e-mail juntos). Se o Auth recusar, o perfis volta.
    if (acao === "editar") {
      const perfil = await perfilFrota(admin, corpo.id);
      if (!perfil) return resp(req, 404, { erro: "Motorista não encontrado." });

      const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
      const nome = limparNome(corpo.nome);
      const celular = limparCelular(corpo.celular);
      if (!nome) return resp(req, 400, { erro: "Informe o nome completo." });
      if (!cpfValido(cpf)) return resp(req, 400, { erro: "CPF inválido." });
      if (!celular) return resp(req, 400, { erro: "Celular inválido. Use DDD + número." });
      const veiculo = lerVeiculo(corpo);
      if (!veiculo.ok) return resp(req, 400, { erro: veiculo.erro });

      // CPF de outro perfil (qualquer papel)
      const { data: outros, error: erroOutros } = await admin.from("perfis").select("id").eq("cpf", cpf).neq("id", perfil.id).limit(1);
      if (erroOutros) {
        console.error("gerenciar-frota: editar, falha ao consultar CPF", perfil.id, erroOutros.code ?? "erro");
        return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
      }
      if (outros?.length) return resp(req, 409, { erro: "Já existe um cadastro com este CPF." });

      // Como está hoje (para desfazer)
      const { data: antes, error: erroAntes } = await admin.from("perfis")
        .select("nome, cpf, telefone, email, senha_provisoria, tipo_veiculo, comissao_alim_carreta, comissao_alim_rodotrem")
        .eq("id", perfil.id).maybeSingle();
      const { data: conta, error: erroConta } = await admin.auth.admin.getUserById(perfil.id);
      if (erroAntes || !antes || erroConta || !conta?.user) {
        console.error("gerenciar-frota: editar, falha ao ler o cadastro atual", perfil.id);
        return resp(req, 503, { erro: "Serviço temporariamente indisponível." });
      }

      const cpfAntigo = String(antes.cpf ?? "");
      const cpfAlterado = cpf !== cpfAntigo;
      const emailAntes = String(conta.user.email ?? "").toLowerCase();
      // Só o e-mail interno acompanha o CPF; e-mail de verdade do motorista fica como está
      const emailNovo = cpfAlterado && emailAntes === emailProvisorio(cpfAntigo) ? emailProvisorio(cpf) : null;

      // 1. perfis
      const { data: linhas, error: erroPerfil } = await admin.from("perfis").update({
        nome, cpf, telefone: celular, ...veiculo.dados,
        ...(emailNovo ? { email: emailNovo } : {}),
        ...(cpfAlterado ? { senha_provisoria: true } : {}),
      }).eq("id", perfil.id).select("id");
      if (erroPerfil || !linhas?.length) {
        if ((erroPerfil as { code?: string } | null)?.code === "23505") {
          return resp(req, 409, { erro: "Já existe um cadastro com este CPF." });
        }
        console.error("gerenciar-frota: editar, falha ao gravar perfis", perfil.id, `cpf_final4=${final4(cpf)}`, erroPerfil?.code ?? "sem linhas");
        return resp(req, 500, { erro: "Não foi possível salvar. Nada foi alterado." });
      }

      // 2. Auth: metadados e, com CPF novo, a senha padrão do CPF novo e o e-mail interno novo
      const atributos: Record<string, unknown> = {
        user_metadata: { ...(conta.user.user_metadata ?? {}), nome, cpf, telefone: celular },
      };
      if (cpfAlterado) atributos.password = senhaPadrao(cpf);
      if (emailNovo) {
        atributos.email = emailNovo;
        atributos.email_confirm = true;
      }
      const { error: erroAuth } = await admin.auth.admin.updateUserById(perfil.id, atributos);
      if (erroAuth) {
        console.error("gerenciar-frota: editar, Auth recusou; desfazendo perfis", perfil.id, `cpf_final4=${final4(cpf)}`,
          (erroAuth as { code?: string }).code ?? "erro");
        const { error: erroVolta } = await admin.from("perfis").update({
          nome: antes.nome, cpf: antes.cpf, telefone: antes.telefone, email: antes.email,
          senha_provisoria: antes.senha_provisoria, tipo_veiculo: antes.tipo_veiculo,
          comissao_alim_carreta: antes.comissao_alim_carreta, comissao_alim_rodotrem: antes.comissao_alim_rodotrem,
        }).eq("id", perfil.id);
        if (erroVolta) {
          console.error("gerenciar-frota: editar, FALHA AO DESFAZER perfis", perfil.id, `cpf_final4=${final4(cpfAntigo)}`, erroVolta.code ?? "erro");
        }
        return resp(req, 500, { erro: "Não foi possível salvar. Nada foi alterado." });
      }

      if (cpfAlterado) {
        // O trigger do passo 9 acabou de pôr false (a senha mudou): volta para true, como no redefinir_senha
        const { error: erroMarca } = await admin.from("perfis").update({ senha_provisoria: true }).eq("id", perfil.id);
        if (erroMarca) console.error("gerenciar-frota: editar, falha ao marcar provisória", perfil.id);
        await encerrarSessoes(admin, perfil.id);
      }

      console.log(`gerenciar-frota: editar por ${quem.user.id} id=${perfil.id} cpf_alterado=${cpfAlterado} tipo=${veiculo.dados.tipo_veiculo}`);
      return resp(req, 200, { sucesso: true, id: perfil.id, cpf_alterado: cpfAlterado });
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
