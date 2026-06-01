import type { PiercWebViewHandle } from "@/components/PiercWebView";
import type { TabId } from "@/constants/config";

/**
 * Module-scope registry that maps each tab to its current WebView
 * handle (or null when unmounted). Used by the deep-link handler in
 * `app/_layout.tsx` to navigate a specific tab's WebView when an
 * incoming `pierc://...` URL arrives.
 *
 * Picked over React Context for one reason: the deep-link handler
 * lives outside the tab tree (root layout) and only needs to imperatively
 * fire a `.navigate(url)` call. A Map keeps that simple — the consumers
 * are tab screens (`useEffect` to register/unregister on mount) and a
 * single root-level deep-link listener.
 */
const tabRegistry = new Map<TabId, PiercWebViewHandle | null>();

export function registerTabWebView(tab: TabId, handle: PiercWebViewHandle | null) {
  if (handle === null) {
    tabRegistry.delete(tab);
  } else {
    tabRegistry.set(tab, handle);
  }
}

export function getTabWebView(tab: TabId): PiercWebViewHandle | null {
  return tabRegistry.get(tab) ?? null;
}

/**
 * Resolve which tab owns a given path on the live deploy. Used by the
 * deep-link parser to figure out which tab to switch to.
 *
 *   /catalog, /catalog/<id>  → "catalog"
 *   /book, /book/success     → "book"
 *   /account                 → "account"
 *   /home, / and everything  → "home"
 */
export function tabForPath(pathname: string): TabId {
  const path = pathname.toLowerCase();
  if (path.startsWith("/catalog")) return "catalog";
  if (path.startsWith("/book")) return "book";
  if (path.startsWith("/account")) return "account";
  return "home";
}
