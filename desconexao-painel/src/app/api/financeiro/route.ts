import { requirePainelToken } from "../../../lib/auth";
import { clientKey, rateLimit } from "../../../lib/rate-limit";
import { syncFinanceiro } from "../../../lib/finance-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";
  if (refresh) {
    const limited = rateLimit(`finsync:${clientKey(request)}`, 12, 5 * 60 * 1000);
    if (limited) return limited;
  }
  const payload = await syncFinanceiro();
  return Response.json(payload);
}
