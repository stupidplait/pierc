import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

// Sink for Content-Security-Policy-Report-Only violations. The CSP header points
// `report-uri` / `report-to` here so violations are aggregated through the logger
// (stdout + MONITORING_WEBHOOK_URL) instead of only surfacing in each visitor's
// console — which is what made Report-Only mode toothless for observability.
//
// Unauthenticated by necessity (browsers POST here directly). It only logs: no
// DB writes, no reflection of the payload back to the client.
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    // Browsers send either `{ "csp-report": {...} }` (legacy report-uri) or an
    // array of report objects (modern report-to / Reporting API). Normalize both.
    const reports = Array.isArray(body)
      ? body
      : [(body as { "csp-report"?: unknown })["csp-report"] ?? body];
    for (const report of reports) {
      logger.warn("csp-violation", { report });
    }
  } catch {
    // Malformed report body — ignore; a report sink must never error.
  }
  return new NextResponse(null, { status: 204 });
}
