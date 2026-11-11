import { timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "desconexao_painel_session";

/** True only for local VM/dev without hosted DATABASE_URL. */
export function isLocalDevAuth(): boolean {
  return (
    process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL?.trim()
  );
}

/**
 * Expected Bearer/cookie token.
 * Production (or any hosted run with DATABASE_URL) fails closed if secret missing.
 * Local-dev only: falls back to `dev-local-token` when PAINEL_API_TOKEN unset.
 */
export function resolveExpectedToken(): string | null {
  const fromEnv = process.env.PAINEL_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (isLocalDevAuth()) return "dev-local-token";
  return null;
}

/** Server-only auth: Authorization Bearer or httpOnly session cookie. Never query string. */
export function requirePainelToken(request: Request): Response | null {
  const expected = resolveExpectedToken();
  if (!expected) {
    return Response.json(
      {
        error: "misconfigured",
        message:
          "PAINEL_API_TOKEN não configurado. Defina o secret no app antes de usar a API.",
      },
      { status: 503 },
    );
  }
  return checkToken(request, expected);
}

function checkToken(request: Request, expected: string): Response | null {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const cookie = readCookie(request, SESSION_COOKIE);
  const provided = bearer || cookie;
  if (!provided || !tokensMatch(provided, expected)) {
    return Response.json(
      { error: "unauthorized", message: "Token inválido ou ausente." },
      { status: 401 },
    );
  }
  return null;
}

export function readCookie(request: Request, name: string): string {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=").trim());
  }
  return "";
}

export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sessionCookieHeader(token: string, maxAgeSec = 60 * 60 * 12): string {
  const secure =
    process.env.NODE_ENV === "production" || Boolean(process.env.DATABASE_URL);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  const secure =
    process.env.NODE_ENV === "production" || Boolean(process.env.DATABASE_URL);
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
