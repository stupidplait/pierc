/**
 * Native-shell palette. Single source of truth for the colours the
 * native chrome (tab bar, splash, loading/error/not-found screens,
 * status bar) renders with.
 *
 * These mirror the web app's own from-scratch standalone surfaces —
 * `app/global-error.tsx` (built without the Tailwind theme, for exactly
 * the "design system not guaranteed" context the native shell lives in)
 * and the dark `viewport.themeColor` in `app/layout.tsx` (`#0a0908`,
 * which tints the mobile browser chrome). The live web app rendered
 * inside the WebView is the dark "Steel Atelier" theme; keeping the
 * shell on the same warm-dark palette means no white flash on launch
 * and no palette seam between the native frame and the web content.
 */
export const theme = {
  /** Page / surface — matches layout.tsx dark themeColor + global-error bg. */
  bg: "#0a0908",
  /** Slightly raised surface (tab bar, cards). Warm near-black. */
  bgElevated: "#111110",
  /** Primary text. */
  ink: "#efe7d8",
  /** Secondary text. */
  inkMuted: "#a39d92",
  /** Tertiary / disabled text + inactive tab icons. */
  inkFaint: "#6b6359",
  /** Hairline borders / rules. */
  line: "#262320",
  /**
   * Brand accent (CTAs, active tab, the BrandMark disc). Matches the
   * live dark-theme `--accent` in app/globals.css — the exact magenta
   * the WebView renders for the header logo, active nav links and CTA
   * dot, so the native chrome and web content share one accent.
   */
  accent: "#f06ba0",
  /** Text / icons rendered on top of the accent fill (web `--on-primary`). */
  onAccent: "#ffffff",
} as const;
