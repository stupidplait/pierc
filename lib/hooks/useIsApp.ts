"use client";

import { useSyncExternalStore } from "react";

/**
 * True when the page is running inside the native mobile shell (the Expo
 * WebView in `mobile/`), false in a normal browser.
 *
 * The shell tags its requests with a `PiercApp` marker in the user-agent
 * (`applicationNameForUserAgent` on the WebView). A tiny pre-paint script in
 * `app/layout.tsx` reads that marker and sets `html[data-app="1"]` before first
 * paint, so chrome-hiding CSS keyed on `html[data-app]` never flashes. This hook
 * exposes the same flag to React for the few places that need to branch markup
 * (e.g. app-only secondary nav) rather than just style.
 *
 * Implemented as an external store (not `useState` + `useEffect`) to satisfy the
 * project's strict react-hooks lint, which rejects set-state-in-effect.
 */
function subscribe(): () => void {
  // The flag is set once, pre-paint, and never changes for the page's life — so
  // there's nothing to subscribe to. Return a no-op unsubscribe.
  return () => {};
}

function getSnapshot(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.app === "1"
  );
}

function getServerSnapshot(): boolean {
  // SSR can't see the client UA; assume browser. The pre-paint script corrects
  // the <html> attribute before paint, and the first client read reflects it.
  return false;
}

export function useIsApp(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
