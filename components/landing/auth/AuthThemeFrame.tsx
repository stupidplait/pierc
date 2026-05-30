import type { CSSProperties, ReactNode } from "react";

// The site is a single dark "Steel Atelier" theme, so the auth surface is
// always dark. These override `--page` / `--line` for descendants so the
// shared PublicAuthForm's `bg-page` inputs become a translucent dark surface
// (the grid backdrop bleeds through) with a pale hairline border.
const darkVars = {
  "--page": "rgba(10, 9, 8, 0.55)",
  "--line": "rgba(239, 231, 216, 0.22)",
} as CSSProperties;

interface AuthThemeFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * AuthThemeFrame — wraps the shared PublicAuthForm with the dark auth surface
 * tokens and unifies the radius of the text inputs and the submit button to a
 * single 0.75rem so they share one shape vocabulary.
 */
export function AuthThemeFrame({ children, className }: AuthThemeFrameProps) {
  return (
    <>
      <style>{`
        [data-auth-theme] input[type="email"],
        [data-auth-theme] input[type="password"],
        [data-auth-theme] input[type="text"],
        [data-auth-theme] button[type="submit"] {
          border-radius: 0.75rem;
        }
      `}</style>
      <div data-auth-theme="dark" className={className} style={darkVars}>
        {children}
      </div>
    </>
  );
}
