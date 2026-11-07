import { requirePainelToken } from "../../../lib/auth";
import { classifyServiceAccountJson } from "../../../lib/sheets-creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auth-required diagnostic: reports only whether the runtime env JSON looks
 * parseable. Never returns secret content, email, or key material.
 */
export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const classified = classifyServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );

  return Response.json({
    ok: classified.shape === "ok",
    shape: classified.shape,
    startsWithBrace: classified.startsWithBrace,
    lengthClass: classified.lengthClass,
    hint:
      classified.shape === "ok"
        ? "Credencial presente no runtime. Se o Sync ainda falhar, o problema é permissão/API da planilha."
        : "Runtime ainda não tem JSON válido. Em My Secrets: Delete GOOGLE_SERVICE_ACCOUNT_JSON → Add com o mesmo nome (deve começar com {) → Publish do app → Sincronizar.",
  });
}
