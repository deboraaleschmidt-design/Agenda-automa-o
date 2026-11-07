import { requirePainelToken } from "../../../lib/auth";
import { ensureSeed } from "../../../lib/seed";
import { syncPainelSnapshot } from "../../../lib/sheets-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  let mes = url.searchParams.get("mes")?.trim() || currentMes();
  try {
    const body = (await request.json().catch(() => null)) as
      | { mes?: string }
      | null;
    if (body?.mes) mes = body.mes.trim();
  } catch {
    /* empty body ok */
  }

  await ensureSeed(mes);
  const result = await syncPainelSnapshot(mes);

  return Response.json({
    ok: true,
    usedFixture: result.usedFixture,
    mes,
    status: result.payload.status,
    fonte: result.payload.fonte,
    atualizado_em: result.payload.atualizado_em,
    mensagem: result.payload.mensagem,
  });
}
