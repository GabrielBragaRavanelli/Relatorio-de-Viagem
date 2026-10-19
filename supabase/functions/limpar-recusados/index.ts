// =============================================================================
// EDGE FUNCTION: limpar-recusados
// AJBorges Transporte & Logística
//
// Remove cadastros recusados há mais de 90 dias:
// - Documentos do bucket privado documentos-cadastro;
// - Contas antigas de motoristas, quando ainda recusadas;
// - Registro em cadastros_agregados.
//
// Cadastros novos de terceiros não possuem conta de login.
//
// Compatível com:
// - terceiros/{cadastro_id}/arquivo;
// - {user_id}/{cadastro_id}/arquivo, dos cadastros antigos.
//
// Configuração: Verify JWT DESLIGADO.
// Autorização: header x-cron-secret, comparado ao CRON_SECRET.
// Agendamento existente: pg_cron + pg_net.
//
// Logs: somente contagens, IDs e códigos de erro.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

function lerChave(
  legado: string,
  novo: string,
): string | undefined {
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

function resp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Resume os dois valores em SHA-256 e compara todos os bytes.
async function segredoConfere(
  recebido: string,
  esperado: string,
): Promise<boolean> {
  const resumo = async (texto: string) =>
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(texto),
      ),
    );

  const [a, b] = await Promise.all([
    resumo(recebido),
    resumo(esperado),
  ]);

  let diferenca = 0;

  for (let i = 0; i < a.length; i++) {
    diferenca |= a[i] ^ b[i];
  }

  return diferenca === 0;
}

// Não registra mensagens que possam conter dados pessoais.
function codigoErro(erro: unknown): string {
  const e = erro as {
    code?: string;
    status?: number;
    name?: string;
  } | null;

  return String(e?.code ?? e?.status ?? e?.name ?? "erro");
}

const BUCKET = "documentos-cadastro";
const DIAS_RETENCAO = 90;
const LOTE = 50;

type Cadastro = {
  id: string;
  user_id: string | null;
  documentos: unknown;
};

type Admin = ReturnType<typeof createClient>;

// Sempre inclui a pasta nova, mesmo sem documentos registrados.
// Mantém compatibilidade com os caminhos dos cadastros antigos.
function pastasDo(c: Cadastro, paths: string[]): string[] {
  const pastas = new Set<string>();

  pastas.add(`terceiros/${c.id}`);

  if (c.user_id) {
    pastas.add(`${c.user_id}/${c.id}`);
  }

  for (const path of paths) {
    const partes = path.split("/");

    if (
      partes.length === 3 &&
      partes[1] === c.id &&
      partes[0]
    ) {
      pastas.add(`${partes[0]}/${partes[1]}`);
    }
  }

  return [...pastas];
}

async function apagarArquivos(
  admin: Admin,
  c: Cadastro,
): Promise<void> {
  const lista = Array.isArray(c.documentos)
    ? c.documentos as Record<string, unknown>[]
    : [];

  const paths = lista
    .map((documento) => documento?.path)
    .filter(
      (path): path is string =>
        typeof path === "string" && path.length > 0,
    );

  const alvos = new Set(paths);

  for (const pasta of pastasDo(c, paths)) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(pasta, { limit: 1000 });

    if (error) {
      throw Object.assign(new Error("list"), {
        code: "storage_list:" + codigoErro(error),
      });
    }

    for (const arquivo of data ?? []) {
      if (arquivo.name) {
        alvos.add(`${pasta}/${arquivo.name}`);
      }
    }
  }

  const todos = [...alvos];

  for (let i = 0; i < todos.length; i += 100) {
    const { error } = await admin.storage
      .from(BUCKET)
      .remove(todos.slice(i, i + 100));

    if (error) {
      throw Object.assign(new Error("remove"), {
        code: "storage_remove:" + codigoErro(error),
      });
    }
  }
}

// Mantém a limpeza das contas dos cadastros antigos.
// Cadastros novos possuem user_id = null e não entram nesse fluxo.
async function apagarConta(
  admin: Admin,
  c: Cadastro,
): Promise<boolean> {
  if (!c.user_id) return false;

  const { data: perfil, error } = await admin
    .from("perfis")
    .select("id, role, status")
    .eq("id", c.user_id)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error("perfil"), {
      code: "perfil_select:" + codigoErro(error),
    });
  }

  if (!perfil) {
    // Recupera uma eventual exclusão parcial de execução anterior:
    // perfil removido, mas conta de login ainda existente.
    const { data: usuario, error: erroUsuario } = await admin
      .auth.admin.getUserById(c.user_id);

    if (erroUsuario || !usuario?.user) return false;

    if (usuario.user.app_metadata?.role !== "motorista") {
      return false;
    }

    const { error: erroExcluir } = await admin
      .auth.admin.deleteUser(c.user_id);

    if (erroExcluir) {
      throw Object.assign(new Error("auth"), {
        code: "auth_delete:" + codigoErro(erroExcluir),
      });
    }

    return true;
  }

  // Não exclui contas com perfil de admin/diretoria
  // nem motoristas com status diferente de recusado.
  if (
    perfil.role !== "motorista" ||
    perfil.status !== "recusado"
  ) {
    return false;
  }

  const { error: erroPerfil } = await admin
    .from("perfis")
    .delete()
    .eq("id", c.user_id)
    .eq("role", "motorista")
    .eq("status", "recusado");

  if (erroPerfil) {
    throw Object.assign(new Error("perfil"), {
      code: "perfil_delete:" + codigoErro(erroPerfil),
    });
  }

  const { error: erroExcluir } = await admin
    .auth.admin.deleteUser(c.user_id);

  if (erroExcluir) {
    throw Object.assign(new Error("auth"), {
      code: "auth_delete:" + codigoErro(erroExcluir),
    });
  }

  return true;
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return resp(405, {
      erro: "Método não permitido.",
    });
  }

  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  const recebido = req.headers.get("x-cron-secret") ?? "";

  if (!segredo) {
    console.error("limpar-recusados: CRON_SECRET ausente");
  }

  if (
    !segredo ||
    !recebido ||
    !(await segredoConfere(recebido, segredo))
  ) {
    return resp(401, {
      erro: "Não autorizado.",
    });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");

    const serviceKey = lerChave(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEYS",
    );

    if (!url || !serviceKey) {
      console.error("limpar-recusados: variáveis ausentes");

      return resp(503, {
        erro: "Serviço temporariamente indisponível.",
      });
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const limite = new Date(
      Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await admin
      .from("cadastros_agregados")
      .select("id, user_id, documentos")
      .eq("status", "recusado")
      .lt("analisado_em", limite)
      .order("analisado_em", { ascending: true })
      .limit(LOTE);

    if (error) {
      console.error(
        "limpar-recusados: falha na busca:",
        codigoErro(error),
      );

      return resp(503, {
        erro: "Serviço temporariamente indisponível.",
      });
    }

    let apagados = 0;
    let falhas = 0;
    let contas = 0;

    for (const cadastro of (data ?? []) as Cadastro[]) {
      try {
        await apagarArquivos(admin, cadastro);

        if (await apagarConta(admin, cadastro)) {
          contas++;
        }

        // Esta condição protege apenas a exclusão da linha.
        // Não desfaz arquivos já removidos caso o status seja
        // alterado por outra operação durante a limpeza.
        const { data: linhas, error: erroLinha } = await admin
          .from("cadastros_agregados")
          .delete()
          .eq("id", cadastro.id)
          .eq("status", "recusado")
          .select("id");

        if (erroLinha) {
          throw Object.assign(new Error("linha"), {
            code: "cadastro_delete:" + codigoErro(erroLinha),
          });
        }

        if (!linhas?.length) {
          throw Object.assign(new Error("linha"), {
            code: "cadastro_nao_recusado",
          });
        }

        apagados++;
      } catch (erro) {
        falhas++;

        console.error(
          `limpar-recusados: falha no cadastro ${cadastro.id}:`,
          codigoErro(erro),
        );
      }
    }

    console.log(
      `limpar-recusados: encontrados=${data?.length ?? 0}` +
        ` apagados=${apagados}` +
        ` contas=${contas}` +
        ` falhas=${falhas}`,
    );

    return resp(200, {
      apagados,
      falhas,
    });
  } catch (erro) {
    console.error(
      "limpar-recusados: erro interno:",
      codigoErro(erro),
    );

    return resp(503, {
      erro: "Serviço temporariamente indisponível.",
    });
  }
});