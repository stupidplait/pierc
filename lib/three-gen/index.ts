import type { Provider, ProviderId } from "./types";
import { manualProvider } from "./manual";
import { replicateProvider } from "./replicate";
import { tripo3dProvider } from "./tripo3d";

// Auto-generation priority. Replicate (Hunyuan3D-2 by default — see
// docs/18-replicate-3d.md) is the new primary; Tripo3D demoted to the
// fallback slot. Both are roughly equivalent on jewelry shapes and the
// chain falls through gracefully if either fails or is unconfigured.
//
// Manual is intentionally not in the auto chain — it's only invoked
// from the manual upload UI.
const AUTO_PRIORITY: ProviderId[] = ["replicate", "tripo3d"];

const all: Record<ProviderId, Provider> = {
  replicate: replicateProvider,
  tripo3d: tripo3dProvider,
  manual: manualProvider,
};

export function getProvider(id: ProviderId): Provider {
  return all[id];
}

/** Returns the first configured auto-generation provider, or null. */
export function pickAutoProvider(): Provider | null {
  for (const id of AUTO_PRIORITY) {
    if (all[id].isAvailable()) return all[id];
  }
  return null;
}

/**
 * Returns the next available auto-provider after `after` in the priority
 * chain. With Replicate at the head and Tripo3D as the fallback, this
 * returns Tripo3D when a Replicate generation fails (assuming
 * `TRIPO3D_API_KEY` is set).
 */
export function pickNextAutoProvider(after: ProviderId): Provider | null {
  const idx = AUTO_PRIORITY.indexOf(after);
  if (idx < 0) return null;
  for (let i = idx + 1; i < AUTO_PRIORITY.length; i++) {
    if (all[AUTO_PRIORITY[i]].isAvailable()) return all[AUTO_PRIORITY[i]];
  }
  return null;
}

/** Status report for the admin UI: which providers are wired up. */
export function getProviderStatus() {
  return {
    replicate: replicateProvider.isAvailable(),
    tripo3d: tripo3dProvider.isAvailable(),
    manual: manualProvider.isAvailable(),
    autoAvailable: pickAutoProvider() !== null,
    /** When true, the "Сгенерировать 3D" button is in test mode — no API calls. */
    dryRun: process.env.DRY_RUN_3D_GEN === "1",
  };
}

export type { Provider, ProviderId } from "./types";
