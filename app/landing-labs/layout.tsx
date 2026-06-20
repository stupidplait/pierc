import type { Metadata } from "next";

/**
 * Landing Labs — sandbox route group for 5 alternative landing concepts.
 *
 * Lives at the app root (outside the (public) group) so variants render
 * full-bleed with NO site Header/Footer — only the root layout's ThemeProvider
 * + MotionProvider wrap them, which is exactly what the variants need (theme
 * tokens + the app-wide LazyMotion `m` runtime).
 *
 * noindex: this is an internal design sandbox, not public content.
 */
export const metadata: Metadata = {
  title: "Landing Labs — PIERCERKZN",
  robots: { index: false, follow: false },
};

export default function LandingLabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
