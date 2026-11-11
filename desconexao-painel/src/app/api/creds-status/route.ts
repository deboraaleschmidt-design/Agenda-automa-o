import { requirePainelToken } from "../../../lib/auth";
import {
  classifyServiceAccountJson,
  readServiceAccountJsonEnv,
  SHEETS_SA_SECRET_NAME,
} from "../../../lib/sheets-creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auth-required diagnostic: reports only whether the runtime env JSON looks
 * parseable. Never returns secret content, email, or key material.
 * Reads ONLY GOOGLE_SERVICE_ACCOUNT_JSON_V2.
 */
export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;

  const classified = classifyServiceAccountJson(readServiceAccountJsonEnv());

  return Response.json({
    ok: classified.shape === "ok",
    secretName: SHEETS_SA_SECRET_NAME,
    shape: classified.shape,
    startsWithBrace: classified.startsWithBrace,
    lengthClass: classified.lengthClass,
    hint:
      classified.shape === "ok"
        ? "Credencial V2 presente no runtime. Se o Sync ainda falhar, o problema é permissão/API da planilha."
        : `Runtime ainda não tem JSON válido em ${SHEETS_SA_SECRET_NAME}. Em My Secrets: confira esse secret (deve começar com {) → Publish do app → Sincronizar.`,
  });
}
