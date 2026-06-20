import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Sink for client-side error beacons (see lib/observability/report-client.ts).
// Routes browser render/runtime errors through the same central logger as the
// server so production failures are observable in one place. Rate-limited because
// it is necessarily unauthenticated.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportSchema = z
  .object({
    message: z.string().min(1).max(2000),
    stack: z.string().max(8000).optional(),
    digest: z.string().max(200).optional(),
    url: z.string().max(2000).optional(),
    componentStack: z.string().max(8000).optional(),
    source: z.string().max(40).optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  const ip = await clientIp();
  const throttle = await rateLimit(`monitor:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!throttle.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { message, ...rest } = parsed.data;
  logger.error(`[client] ${message}`, { ...rest, ip });
  return NextResponse.json({ ok: true });
}
