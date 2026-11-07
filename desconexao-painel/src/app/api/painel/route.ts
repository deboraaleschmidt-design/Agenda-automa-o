import { requirePainelToken } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { ensureSeed } from "../../../lib/seed";
import { EMPRESA_SEED_ID, SETOR_DESCONEXAO, type PainelPayload } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const mes = url.searchParams.get("mes")?.trim() || currentMes();
  const setor = url.searchParams.get("setor")?.trim() || SETOR_DESCONEXAO;

  await ensureSeed(mes);

  const rows = await sql<{ payload: PainelPayload; atualizado_em: string; fonte: string }>(
    `SELECT payload, atualizado_em::text, fonte
     FROM painel_snapshots
     WHERE empresa_id = $1 AND setor = $2 AND mes = $3
     LIMIT 1`,
    [EMPRESA_SEED_ID, setor, mes],
  );

  if (rows.length === 0) {
    return Response.json(
      { error: "not_found", message: `Sem snapshot para ${mes}` },
      { status: 404 },
    );
  }

  const row = rows[0];
  const payload =
    typeof row.payload === "string"
      ? (JSON.parse(row.payload) as PainelPayload)
      : row.payload;

  return Response.json({
    ...payload,
    atualizado_em: payload.atualizado_em || row.atualizado_em,
    fonte: payload.fonte || row.fonte,
  });
}
