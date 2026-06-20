import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";

// Self-contained, Postgres-backed fixed-window rate limiter. No external infra
// (Upstash etc.) required — swap the storage in this one module if you later
// want a dedicated KV. Keyed by an arbitrary string (usually `${scope}:${ip}`).
//
// Fails OPEN on any storage error (including the table not being migrated yet)
// so a limiter outage never blocks legitimate users; only a real over-limit
// count returns ok:false.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const { limit, windowMs } = opts;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);

  try {
    // upsert + atomic increment: two concurrent calls can't both read a stale
    // count — Postgres serializes the increment under row lock.
    const row = await prisma.rateLimit.upsert({
      where: { id },
      create: { id, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    return {
      ok: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterSec: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
    };
  } catch (err) {
    // Fail OPEN (see header) so a limiter outage never blocks real users — but
    // log it. An open limiter is a security-relevant state (all throttles are
    // off) and must be observable rather than silent.
    logger.error("rate-limit storage error (failing open)", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: limit, retryAfterSec: 0 };
  }
}

// Trusted client IP from proxy headers. On Vercel the platform sets x-real-ip to
// the real connecting IP and APPENDS that IP to x-forwarded-for, so the RIGHTMOST
// x-forwarded-for entry is the trustworthy one. We must NOT trust the leftmost
// entry: a client can prepend its own X-Forwarded-For value, which would yield a
// fresh rate-limit key per request and silently bypass every throttle.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }
  return "unknown";
}

// Prune expired counters. Called opportunistically by the expiry cron so the
// table doesn't grow unbounded.
export async function pruneRateLimits(): Promise<number> {
  try {
    const res = await prisma.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return res.count;
  } catch {
    return 0;
  }
}
