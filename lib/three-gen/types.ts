// 3D-generation provider abstraction.
//
// A provider takes input photos and returns a `.glb` URL. Implementations
// can be synchronous (manual upload), short-running (small models), or
// long-running (real auto-generation that needs a polling cron job).
//
// The pipeline is wired in two layers:
//   1. UI invokes a server action that creates a GenerationJob row +
//      delegates to the provider's `start()` here.
//   2. For async providers, /api/cron/poll-jobs (Task 15-ish) calls
//      `poll()` until SUCCEEDED / FAILED, then admin reviews + approves.
//
// In v1, only the `manual` provider is functional — the others are
// gracefully-failing stubs that report "Provider not configured" until
// API keys are added to .env.

export type ProviderId = "tripo3d" | "manual";

export interface ProviderInput {
  /** Public URLs of the photos to feed into the generator. */
  photoUrls: string[];
  /** Free-form notes the admin wrote (for providers that accept hints). */
  hint?: string;
}

export type StartResult =
  | {
      ok: true;
      /** Provider-side job id; null for synchronous providers. */
      providerJobId: string | null;
      /** If the provider produces a result synchronously, return it here. */
      resultGlbUrl?: string | null;
    }
  | { ok: false; error: string };

export type PollResult =
  | { status: "PROCESSING" }
  | { status: "SUCCEEDED"; resultGlbUrl: string }
  | { status: "FAILED"; errorMessage: string };

export interface Provider {
  id: ProviderId;
  /** Returns whether the provider is fully configured (e.g. API key set). */
  isAvailable(): boolean;
  /** Kick off a generation. */
  start(input: ProviderInput): Promise<StartResult>;
  /** Check on an in-flight job (only meaningful for async providers). */
  poll(providerJobId: string): Promise<PollResult>;
}
