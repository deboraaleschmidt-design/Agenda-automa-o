import { requirePainelToken } from "../../../lib/auth";
import { sql } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const runs = await sql<{
    id: string;
    started_at: string;
    finished_at: string | null;
    trigger: string;
    status: string;
    detalhe: unknown;
  }>(
    `SELECT id, started_at, finished_at, trigger, status, detalhe
     FROM sync_runs
     ORDER BY started_at DESC
     LIMIT 5`,
  );

  const meses = await sql<{
    segmento: string;
    ano_mes: string;
    fechado: boolean;
    payload: unknown;
  }>(
    `SELECT segmento, ano_mes, fechado, payload
     FROM snapshots_mensais
     WHERE segmento = 'neutra'
     ORDER BY ano_mes`,
  );

  const counts = await sql<{ n: string }>(
    `SELECT count(*)::text AS n FROM atividades WHERE segmento = 'neutra'`,
  );

  return Response.json({
    ok: true,
    atividades_neutra: Number(counts[0]?.n || 0),
    snapshots_mensais: meses,
    ultimos_sync: runs,
  });
}
