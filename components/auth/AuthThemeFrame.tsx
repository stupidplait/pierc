import type { ReactNode } from "react";

interface AuthThemeFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * AuthThemeFrame — skins the shared AuthForm's `bg-page` inputs as a
 * translucent, recessed field (so they read as fields against the solid card)
 * with a hairline border, in BOTH themes.
 *
 * The site was dark-only when this was written, so it used to hard-code a dark
 * surface via an inline style. Now the --page / --line overrides are
 * theme-aware: the dark default lives on `[data-auth-theme]`, and a
 * `:root.theme-light` rule swaps in a faint-ink field + hairline so the light
 * theme no longer gets dark-grey blocks on a white card. The values MUST live
 * in the injected <style> (not an inline `style={}`) precisely so the
 * light-theme rule can override the dark default — an inline style would always
 * win and re-pin the dark surface. Also unifies the input + submit radius.
 */
export function AuthThemeFrame({ children, className }: AuthThemeFrameProps) {
  return (
    <>
      <style>{`
        [data-auth-theme] {
          --page: rgba(10, 9, 8, 0.55);
          --line: rgba(239, 231, 216, 0.22);
        }
        :root.theme-light [data-auth-theme] {
          --page: rgba(10, 10, 10, 0.035);
          --line: rgba(10, 10, 10, 0.14);
        }
        [data-auth-theme] input[type="email"],
        [data-auth-theme] input[type="password"],
        [data-auth-theme] input[type="text"],
        [data-auth-theme] input[type="tel"],
        [data-auth-theme] button[type="submit"] {
          border-radius: 0.75rem;
        }
      `}</style>
      <div data-auth-theme className={className}>
        {children}
      </div>
    </>
  );
}
