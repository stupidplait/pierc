import type { Provider, StartResult, PollResult } from "./types";

// Local self-hosted generation — the credit-zero fallback.
//
// SEAM ONLY (no worker yet). This provider sits at the TAIL of AUTO_PRIORITY
// so that when the paid providers (Replicate, Tripo3D) run out of credits or
// fail, the chain falls through to here. The intended runtime is a
// pull-based worker on owned hardware (see docs/22-local-fallback.md):
//
//   start() → enqueue a job the local worker will claim (no external API
//             call, so it never costs anything to *start*).
//   poll()  → report what the worker has written back to the job row.
//
// Until that worker exists, this provider is OFF by default
// (`LOCAL_3D_WORKER` unset), so the live behaviour of the app is unchanged:
// pickAutoProvider/pickNextAutoProvider simply skip it. Flipping
// `LOCAL_3D_WORKER=1` *before* the worker is built surfaces an explicit,
// honest error rather than silently hanging a job forever.

const isEnabled = () => process.env.LOCAL_3D_WORKER === "1";

const NOT_IMPLEMENTED_ERROR =
  "Локальная генерация ещё не реализована. Это заглушка для будущего " +
  "self-hosted воркера (см. docs/22-local-fallback.md). Снимите LOCAL_3D_WORKER, " +
  "пока воркер не готов.";

export const localProvider: Provider = {
  id: "local",

  // Off unless explicitly enabled — keeps the auto-chain behaviour identical
  // to today until the worker lands.
  isAvailable: () => isEnabled(),

  async start(): Promise<StartResult> {
    return { ok: false, error: NOT_IMPLEMENTED_ERROR };
  },

  async poll(): Promise<PollResult> {
    return { status: "FAILED", errorMessage: NOT_IMPLEMENTED_ERROR };
  },
};
