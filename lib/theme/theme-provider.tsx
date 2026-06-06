"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Always true on the client; kept for call-sites that gate first paint. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * The <html> element is the single source of truth: the pre-paint script in
 * app/layout.tsx stamps `.theme-*` + `data-theme` before hydration, and these
 * helpers read/write it. Using useSyncExternalStore (per the project's strict
 * react-hooks lint, which forbids set-state-in-effect) means the snapshot is
 * always current with no flash and no hydration mismatch.
 */
function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.remove("theme-light", "theme-dark");
  el.classList.add(`theme-${theme}`);
  el.setAttribute("data-theme", theme);
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  // Follow the OS while the visitor hasn't made an explicit choice. Updating
  // the class (not React state) keeps this a plain external-system sync; the
  // observer above then notifies React.
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  const onSystem = () => {
    if (localStorage.getItem("theme")) return;
    applyTheme(mql.matches ? "light" : "dark");
  };
  mql.addEventListener("change", onSystem);
  return () => {
    observer.disconnect();
    mql.removeEventListener("change", onSystem);
  };
}

const getThemeSnapshot = (): Theme =>
  document.documentElement.classList.contains("theme-light") ? "light" : "dark";
// Server render has no DOM to read; the dark instrument-room is the default.
const themeServerSnapshot = (): Theme => "dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    themeServerSnapshot,
  );

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem("theme", next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = getThemeSnapshot() === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, ready: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
