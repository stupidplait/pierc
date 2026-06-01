/**
 * App-wide configuration. Single source of truth for the URL the
 * WebView loads. Override in dev via `EXPO_PUBLIC_APP_URL` (any
 * `EXPO_PUBLIC_*` env var is inlined into the JS bundle by Expo).
 */
const PROD_URL = "https://pierc-one.vercel.app";

export const APP_URL =
  (process.env.EXPO_PUBLIC_APP_URL as string | undefined)?.trim() || PROD_URL;

/**
 * Tab → entry-URL mapping. Tapping a tab loads this URL in the WebView.
 * Inside a tab, the WebView can navigate freely (e.g., from /catalog
 * to /catalog/<id>) and the tab still appears selected.
 */
export const TABS = {
  // The browser landing at "/" is a desktop scroll-driven WebGL experience that
  // doesn't fit a phone; the Home tab loads the lightweight app home instead.
  home: { path: "/home", title: "Главная", icon: "home-outline" },
  catalog: { path: "/catalog", title: "Каталог", icon: "diamond-outline" },
  book: { path: "/book", title: "Запись", icon: "calendar-outline" },
  account: { path: "/account", title: "Профиль", icon: "person-outline" },
} as const;

export type TabId = keyof typeof TABS;

/**
 * Build the absolute URL for a given path on the live deploy.
 */
export function urlFor(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL.replace(/\/$/, "")}${trimmed}`;
}

/**
 * Returns true when the URL points outside the studio's own domain
 * — used by the WebView to decide whether to open the link in the
 * system browser instead of inside the WebView.
 */
export function isExternalUrl(url: string): boolean {
  try {
    const target = new URL(url);
    const home = new URL(APP_URL);
    return target.host !== home.host;
  } catch {
    return false;
  }
}
