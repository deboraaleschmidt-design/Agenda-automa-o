import { requirePainelToken } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { clientKey, rateLimit } from "../../../lib/rate-limit";
import { ensureSeed } from "../../../lib/seed";
import { isMesOrTotal } from "../../../lib/painel-parse";
import { syncPainelSnapshot } from "../../../lib/sheets-sync";
import {
  EMPRESA_SEED_ID,
  SETOR_DESCONEXAO,
  type PainelPayload,
} from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 2 * 60 * 1000;

function currentMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawMes = url.searchParams.get("mes")?.trim() || currentMes();
  if (!isMesOrTotal(rawMes)) {
    return Response.json(
      {
        error: "bad_request",
        message: "Parâmetro mes inválido. Use YYYY-MM ou TOTAL.",
      },
      { status: 400 },
    );
  }
  const mes = rawMes;
  const setor = url.searchParams.get("setor")?.trim() || SETOR_DESCONEXAO;
  if (setor !== SETOR_DESCONEXAO) {
    return Response.json(
      { error: "bad_request", message: "Setor não suportado neste slice." },
      { status: 400 },
    );
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  await ensureSeed(mes);

  let rows = await sql<{
    payload: PainelPayload;
    atualizado_em: string;
    fonte: string;
  }>(
    `SELECT payload, atualizado_em::text, fonte
     FROM painel_snapshots
     WHERE empresa_id = $1 AND setor = $2 AND mes = $3
     LIMIT 1`,
    [EMPRESA_SEED_ID, setor, mes],
  );

  let payload =
    rows[0] &&
    (typeof rows[0].payload === "string"
      ? (JSON.parse(rows[0].payload) as PainelPayload)
      : rows[0].payload);

  const updatedAt = payload?.atualizado_em
    ? Date.parse(payload.atualizado_em)
    : 0;
  const stale =
    !payload ||
    payload.fonte === "fixture" ||
    payload.status === "aguardando_credencial_sheets" ||
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt > STALE_MS;

  if (forceRefresh || stale) {
    const limited = rateLimit(
      `autosync:${clientKey(request)}`,
      20,
      5 * 60 * 1000,
    );
    if (!limited) {
      const result = await syncPainelSnapshot(mes);
      payload = result.payload;
    }
  }

  if (!payload) {
    return Response.json(
      { error: "not_found", message: `Sem snapshot para ${mes}` },
      { status: 404 },
    );
  }

  return Response.json({
    ...payload,
    por_tipo_servico: payload.por_tipo_servico || [],
  });
}
