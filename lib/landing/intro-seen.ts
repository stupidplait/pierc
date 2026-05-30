"use client";

import { useSyncExternalStore } from "react";

/**
 * Session-scoped "the landing intro already played" flag.
 *
 * The Preloader (`components/scene/Preloader.tsx`) shows on every mount of
 * the landing route because the Hero — and the WebGL scene it owns — fully
 * remounts on each client-side navigation back to `/`. We don't want to
 * suppress it entirely (the scene genuinely re-initializes and needs a
 * cover), but we also don't want to force the full branded draw every time.
 *
 * So we remember, for the current browser session, that the user has seen
 * the complete intro once:
 *
 *   - First visit of the session  → full experience (artificial minimum
 *                                    display time, logo draw).
 *   - Every later mount this session → drop the artificial minimum; the
 *                                    preloader lasts only as long as the
 *                                    scene is genuinely not ready, then
 *                                    fades the instant it is.
 *
 * `sessionStorage` (not `localStorage`) on purpose: a visitor returning a
 * day later starts a fresh session, hits a cold asset cache, and benefits
 * from the branded cover again — but never sees it twice while browsing.
 *
 * Implemented via `useSyncExternalStore` rather than `useEffect + setState`
 * so the project's `react-hooks/set-state-in-effect` lint rule stays happy
 * and hydration is mismatch-free (SSR + first client render both read the
 * server snapshot, then React reconciles to the real value before paint).
 */

const STORAGE_KEY = "piercerkzn:intro-seen";

// Module-scoped cache so getSnapshot returns a stable value across calls.
let seen = false;
let hydrated = false;

const subscribers = new Set<() => void>();

function readStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage can throw in private mode / when disabled — treat as unseen.
    return false;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  seen = readStorage();
  hydrated = true;
}

function subscribe(callback: () => void): () => void {
  ensureHydrated();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): boolean {
  ensureHydrated();
  return seen;
}

function getServerSnapshot(): boolean {
  // On the server we always assume the intro has not played, matching the
  // first client paint. The real value resolves on the client immediately
  // after hydration.
  return false;
}

/**
 * Mark the intro as having fully played for this session. Idempotent —
 * safe to call repeatedly. Notifies subscribers so any mounted Preloader
 * reflecting the flag updates.
 */
export function markIntroSeen(): void {
  ensureHydrated();
  if (seen) return;
  seen = true;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — the in-memory flag still suppresses replays this mount.
    }
  }
  for (const cb of subscribers) cb();
}

/**
 * Whether the landing intro has already played this session. `false`
 * during SSR and the first client paint; resolves to the stored value
 * immediately after hydration.
 */
export function useIntroSeen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
