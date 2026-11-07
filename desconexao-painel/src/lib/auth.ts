import { timingSafeEqual } from "node:crypto";

/** Server-only Bearer token check for private API access. */
export function requirePainelToken(request: Request): Response | null {
  const expected = resolveExpectedToken();
  return checkToken(request, expected);
}

function checkToken(request: Request, expected: string): Response | null {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const query = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const provided = bearer || query;
  if (!provided || !tokensMatch(provided, expected)) {
    return Response.json(
      { error: "unauthorized", message: "Token inválido ou ausente." },
      { status: 401 },
    );
  }
  return null;
}

function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function resolveExpectedToken(): string {
  const fromEnv = process.env.PAINEL_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    return "slice1-aguardando-secret";
  }
  return "dev-local-token";
}
