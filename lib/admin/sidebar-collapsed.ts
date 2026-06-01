"use client";

import { useSyncExternalStore } from "react";

/**
 * Persisted "admin sidebar is collapsed to icons" preference.
 *
 * The desktop rail can fold down to an icon-only strip. The choice is a UI
 * preference the admin makes once and expects to stick, so it lives in
 * `localStorage` (not session) and survives reloads.
 *
 * Implemented via `useSyncExternalStore` rather than `useEffect + setState`
 * so the project's `react-hooks/set-state-in-effect` lint rule stays happy and
 * hydration is mismatch-free: SSR and the first client paint both read the
 * server snapshot (expanded), then React reconciles to the stored value before
 * paint. Mirrors the pattern in `lib/landing/intro-seen.ts`.
 */

const STORAGE_KEY = "piercerkzn:admin-sidebar-collapsed";

// Module-scoped cache so getSnapshot returns a stable value across calls.
let collapsed = false;
let hydrated = false;

const subscribers = new Set<() => void>();

function readStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage can throw in private mode / when disabled — treat as expanded.
    return false;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  collapsed = readStorage();
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
  return collapsed;
}

function getServerSnapshot(): boolean {
  // The rail renders expanded on the server and first client paint; the stored
  // value resolves immediately after hydration.
  return false;
}

/** Set the collapsed preference and notify any mounted rail. Idempotent. */
export function setSidebarCollapsed(value: boolean): void {
  ensureHydrated();
  if (collapsed === value) return;
  collapsed = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Ignore — the in-memory flag still drives this mount.
    }
  }
  for (const cb of subscribers) cb();
}

/** Flip the collapsed preference. */
export function toggleSidebarCollapsed(): void {
  setSidebarCollapsed(!getSnapshot());
}

/**
 * Whether the admin rail is collapsed. `false` during SSR and the first client
 * paint; resolves to the stored value immediately after hydration.
 */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
