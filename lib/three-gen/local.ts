import { randomUUID } from "node:crypto";
import type { Provider, StartResult, PollResult } from "./types";
import { prisma } from "@/lib/prisma";

// Local self-hosted generation — the credit-zero fallback (see
// docs/22-local-fallback.md).
//
// PULL-WORKER design. There's no external API to call: `start()` simply mints a
// claimable job id, and a worker on owned hardware reaches OUT to claim it:
//
//   start() → return providerJobId `local:queued:<uuid>` (no network call, so it
//             never costs anything to start). The caller stores it on a normal
//             GenerationJob row (status PROCESSING), exactly like any provider.
//   worker  → POST /api/local-jobs/claim  → atomically flips the providerJobId
//             from the `local:queued:` prefix to `local:run:<uuid>` (the CAS claim
//             marker — no schema change needed), then generates the .glb and
//             POSTs it to /api/local-jobs/<id>/result, which re-hosts + finalizes
//             the job (SUCCEEDED + jewelry PENDING_REVIEW) directly.
//   poll()  → read the row's status. Finalization happens in the result endpoint,
//             so from the poll loop's perspective a local job is just "still
//             processing" until the worker reports back (or FAILED).
//
// OFF by default (`LOCAL_3D_WORKER` unset) so the live auto-chain is unchanged
// until a worker exists. When enabled it sits at the TAIL of AUTO_PRIORITY, so a
// generation only reaches it after the paid providers are exhausted.

const isEnabled = () => process.env.LOCAL_3D_WORKER === "1";

/** providerJobId prefix for a job awaiting a worker (the CAS claim marker). */
export const LOCAL_QUEUED_PREFIX = "local:queued:";
/** providerJobId prefix once a worker has claimed the job. */
export const LOCAL_RUNNING_PREFIX = "local:run:";

const DISABLED_ERROR =
  "Локальная генерация выключена. Установите LOCAL_3D_WORKER=1 и запустите " +
  "воркер (см. docs/22-local-fallback.md).";

export const localProvider: Provider = {
  id: "local",

  isAvailable: () => isEnabled(),

  async start(): Promise<StartResult> {
    if (!isEnabled()) return { ok: false, error: DISABLED_ERROR };
    // No external call — just a claimable id. The pull-worker finds PROCESSING
    // local jobs whose providerJobId still carries the queued prefix.
    return { ok: true, providerJobId: `${LOCAL_QUEUED_PREFIX}${randomUUID()}` };
  },

  async poll(providerJobId: string): Promise<PollResult> {
    const job = await prisma.generationJob.findFirst({
      where: { providerJobId },
      select: { status: true, errorMessage: true },
    });
    if (!job) {
      return { status: "FAILED", errorMessage: "Локальная задача не найдена." };
    }
    if (job.status === "FAILED") {
      return {
        status: "FAILED",
        errorMessage: job.errorMessage ?? "Локальная генерация не удалась.",
      };
    }
    // SUCCEEDED is set out-of-band by /api/local-jobs/[id]/result (which also
    // re-hosts + flips the jewelry to PENDING_REVIEW), so the poll loop never has
    // to finalize a local job — it only ever sees it as in-progress.
    return { status: "PROCESSING" };
  },
};
