import { requirePainelToken } from "../../../lib/auth";
import { cacheGet, cacheSet, CACHE_TTL_MS } from "../../../lib/memory-cache";
import { clientKey, rateLimit } from "../../../lib/rate-limit";
import { syncFinanceiro } from "../../../lib/finance-sync";
import type { FinancePayload } from "../../../lib/finance-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes")?.trim() || "TOTAL";
  const segmento = (url.searchParams.get("segmento")?.trim() || "todos").toLowerCase();
  const refresh = url.searchParams.get("refresh") === "1";
  const cacheKey = `fin:${segmento}:${mes}`;

  if (!refresh) {
    const cached = cacheGet<FinancePayload>(cacheKey);
    if (cached) return Response.json(cached);
  } else {
    const limited = rateLimit(
      `finsync:${clientKey(request)}`,
      12,
      5 * 60 * 1000,
    );
    if (limited) return limited;
  }

  const payload = await syncFinanceiro({ mes, segmento });
  if (payload.fonte === "sheets" && payload.status === "ok") {
    cacheSet(cacheKey, payload, CACHE_TTL_MS);
  }
  return Response.json(payload);
}
