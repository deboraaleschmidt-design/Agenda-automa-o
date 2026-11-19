import { requirePainelToken } from "../../../../lib/auth";
import { syncBancoFromSheets } from "../../../../lib/banco-sync";
import { ensureSeed } from "../../../../lib/seed";
import { syncPainelSnapshot } from "../../../../lib/sheets-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron 07:00 (America/Sao_Paulo) — agendar externamente:
 * POST /api/cron/sync com o mesmo Bearer/cookie do painel.
 * Não há scheduler embutido no publish-app; Debora/ops aponta o cron.
 */
export async function POST(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const d = new Date();
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  await ensureSeed(mes);
  const painel = await syncPainelSnapshot(mes);
  const banco = await syncBancoFromSheets({ trigger: "cron" });

  return Response.json({
    ok: banco.ok,
    mes,
    painel: {
      status: painel.payload.status,
      fonte: painel.payload.fonte,
      usedFixture: painel.usedFixture,
    },
    banco,
  });
}
