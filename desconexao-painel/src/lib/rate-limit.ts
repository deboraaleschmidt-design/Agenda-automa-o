import { createHash } from "node:crypto";
import { SESSION_COOKIE, readCookie } from "./auth";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window rate limit. Returns null if allowed, or a 429 Response.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Response | null {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return Response.json(
      {
        error: "rate_limited",
        message: "Muitas sincronizações. Aguarde e tente de novo.",
        retry_after_sec: retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }
  // Opportunistic cleanup
  if (buckets.size > 500) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }
  return null;
}

/**
 * Login attempts: never key off spoofable proxy IP headers, and never off the
 * submitted token (rotating fake Bearers would bypass the limit). Shared bucket
 * is correct for this private single-owner panel.
 */
export function loginClientKey(): string {
  return "anon";
}

/**
 * Authenticated routes: key by a short hash of Bearer/session credential.
 * Does NOT trust X-Forwarded-For / X-Real-IP (client-spoofable when forwarded).
 */
export function clientKey(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const cookie = readCookie(request, SESSION_COOKIE);
  const material = bearer || cookie;
  if (material) {
    const digest = createHash("sha256")
      .update(material)
      .digest("hex")
      .slice(0, 16);
    return `cred:${digest}`;
  }
  return "anon";
}
