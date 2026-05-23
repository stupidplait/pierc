import type { Provider, ProviderId } from "./types";
import { manualProvider } from "./manual";
import { tripo3dProvider } from "./tripo3d";

// Auto-generation priority. Currently Tripo3D-only; future providers
// (Replicate-hosted open-source models, etc.) slot in here without touching
// the calling code.
//
// Manual is intentionally not in the auto chain — it's only invoked from
// the manual upload UI.
const AUTO_PRIORITY: ProviderId[] = ["tripo3d"];

const all: Record<ProviderId, Provider> = {
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
 * chain. With only Tripo3D in the chain today, this always returns null;
 * kept so future fallback providers slot in without touching call sites.
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
    tripo3d: tripo3dProvider.isAvailable(),
    manual: manualProvider.isAvailable(),
    autoAvailable: pickAutoProvider() !== null,
    /** When true, the "Сгенерировать 3D" button is in test mode — no API calls. */
    dryRun: process.env.DRY_RUN_3D_GEN === "1",
  };
}

export type { Provider, ProviderId } from "./types";
