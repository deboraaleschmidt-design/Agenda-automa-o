import {
  clearSessionCookieHeader,
  requirePainelToken,
  resolveExpectedToken,
  sessionCookieHeader,
  tokensMatch,
} from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Establish httpOnly session cookie from Bearer or JSON body `{ token }`. */
export async function POST(request: Request) {
  const expected = resolveExpectedToken();
  if (!expected) {
    return Response.json(
      {
        error: "misconfigured",
        message: "PAINEL_API_TOKEN não configurado.",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  let bodyToken = "";
  try {
    const body = (await request.json()) as { token?: string } | null;
    bodyToken = body?.token?.trim() ?? "";
  } catch {
    /* empty ok if Bearer present */
  }
  const provided = bearer || bodyToken;
  if (!provided || !tokensMatch(provided, expected)) {
    return Response.json(
      { error: "unauthorized", message: "Token inválido ou ausente." },
      { status: 401 },
    );
  }

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieHeader(provided) } },
  );
}

/** Drop session cookie. */
export async function DELETE(request: Request) {
  const denied = requirePainelToken(request);
  if (denied && denied.status === 503) return denied;
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } },
  );
}

/** Probe whether current cookie/Bearer is valid. */
export async function GET(request: Request) {
  const denied = requirePainelToken(request);
  if (denied) return denied;
  return Response.json({ ok: true, authenticated: true });
}
