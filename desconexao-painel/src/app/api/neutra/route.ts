import { requirePainelToken } from "../../../lib/auth";
import { cacheGet, cacheSet, CACHE_TTL_MS } from "../../../lib/memory-cache";
import { clientKey, rateLimit } from "../../../lib/rate-limit";
import type { NeutraPayload } from "../../../lib/neutra-parse";
import { syncNeutra } from "../../../lib/neutra-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes")?.trim() || "TOTAL";
  const refresh = url.searchParams.get("refresh") === "1";
  const cacheKey = `neutra:${mes}`;

  if (!refresh) {
    const cached = cacheGet<NeutraPayload>(cacheKey);
    if (cached) return Response.json(cached);
  } else {
    const limited = rateLimit(
      `neutrasync:${clientKey(request)}`,
      12,
      5 * 60 * 1000,
    );
    if (limited) return limited;
  }

  const payload = await syncNeutra(mes);
  if (payload.fonte === "sheets" && payload.status === "ok") {
    cacheSet(cacheKey, payload, CACHE_TTL_MS);
  }
  return Response.json(payload);
}
