"use client";

// Beacon a client-side error to the server, which routes it through the central
// logger (and any configured monitoring webhook). Best-effort and silent — error
// reporting must never itself throw or block the UI.

type ClientContext = Record<string, unknown>;

export function reportClientError(error: unknown, context?: ClientContext): void {
  try {
    const payload = {
      source: "client",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      digest:
        error && typeof error === "object" && "digest" in error
          ? String((error as { digest?: unknown }).digest)
          : undefined,
      url: typeof location !== "undefined" ? location.href : undefined,
      ...context,
    };
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        "/api/monitoring",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/monitoring", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
  } catch {
    /* never throw from the reporter */
  }
}
