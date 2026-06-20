// Central structured logging + error-reporting choke point.
//
// Today it emits structured lines to stdout/stderr (captured by Vercel's log
// drains) and, when MONITORING_WEBHOOK_URL is set, best-effort forwards warn/error
// events to that webhook (Slack/Discord/an own relay/a Sentry relay). Every error
// path in the app routes through here, so swapping in a dedicated monitor later
// (e.g. @sentry/nextjs) only means editing this one module — no call sites change.
//
// Safe in both server and client bundles: on the client MONITORING_WEBHOOK_URL is
// undefined (it is not NEXT_PUBLIC), so forwarding no-ops and only console output
// remains; client errors are beaconed server-side via /api/monitoring instead.

type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

interface LogEntry extends Context {
  level: Level;
  message: string;
  ts: string;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function serializeError(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  return { message: typeof error === "string" ? error : safeJson(error) };
}

function emit(level: Level, message: string, context?: Context): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...context,
  };
  const line = context ? `[${level}] ${message} ${safeJson(context)}` : `[${level}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  return entry;
}

async function forward(entry: LogEntry): Promise<void> {
  const url = process.env.MONITORING_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: safeJson(entry),
      // Monitoring must never block or hang the request path.
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* a monitoring outage must never surface as an app error */
  }
}

export const logger = {
  info(message: string, context?: Context): void {
    emit("info", message, context);
  },
  warn(message: string, context?: Context): void {
    void forward(emit("warn", message, context));
  },
  error(message: string, context?: Context): void {
    void forward(emit("error", message, context));
  },
};

/** Report a caught exception with structured context. */
export function reportError(error: unknown, context?: Context): void {
  const e = serializeError(error);
  void forward(
    emit("error", e.message, { ...context, name: e.name, stack: e.stack }),
  );
}
