"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-provider";

/**
 * LabThemeToggle — light/dark switch for any landing-lab variant.
 *
 * Wraps the app-wide theme system (lib/theme/theme-provider): the <html>
 * `.theme-light` / `.theme-dark` class is the single source of truth, so a
 * toggle here re-skins both the 2D Tailwind tokens (bg-bg, text-ink, …) AND the
 * 3D `--scene-*` tokens that WebGL scenes read. Drop it anywhere inside a
 * variant. Style overrides via `className`.
 */
export function LabThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"
      }
      className={
        "inline-flex size-9 items-center justify-center rounded-full border border-current/20 bg-transparent text-current transition-[transform,border-color,background-color] duration-200 hover:border-current/50 hover:bg-current/5 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60 " +
        className
      }
    >
      {theme === "dark" ? (
        <Sun className="size-4.5" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5" aria-hidden="true" />
      )}
    </button>
  );
}
