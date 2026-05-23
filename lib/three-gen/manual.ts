import type { Provider, StartResult, PollResult } from "./types";

// Manual "provider" — the admin uploads a `.glb` file directly. There's no
// generation work to do here; this exists so callers can use the same
// Provider interface for both the auto and manual paths.
//
// In practice the manual path bypasses GenerationJob entirely (the upload
// action writes Jewelry.glbUrl directly). This adapter is here only for
// symmetry / future telemetry and reports the upload as immediately done.

export const manualProvider: Provider = {
  id: "manual",
  isAvailable: () => true,
  async start(): Promise<StartResult> {
    return {
      ok: true,
      providerJobId: null,
      resultGlbUrl: null,
    };
  },
  async poll(): Promise<PollResult> {
    // Manual jobs don't need polling.
    return { status: "PROCESSING" };
  },
};
