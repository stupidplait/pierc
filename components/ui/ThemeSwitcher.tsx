"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-provider";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      className={`inline-flex size-9 items-center justify-center rounded-xl border border-ink-line-strong bg-transparent text-ink transition-colors duration-200 hover:border-ink hover:bg-ink/5 active:scale-[0.97] [text-shadow:0_0_20px_var(--bg),0_0_40px_var(--bg),0_1px_2px_rgba(0,0,0,0.8)] filter-[drop-shadow(0_0_20px_var(--bg))_drop-shadow(0_0_40px_var(--bg))] ${FOCUS_RING}`}
    >
      {theme === "dark" ? (
        <Sun className="size-4.5" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5" aria-hidden="true" />
      )}
    </button>
  );
}
