import type { Metadata } from "next";
import localFont from "next/font/local";
import { Experience } from "@/components/landing-labs/director/Experience";

/**
 * РЕЖИССЁРСКАЯ ВЕРСИЯ — Director's Cut (variant 05).
 *
 * A cinema-edit-suite reinterpretation of the production landing's 3-act scroll
 * (ВЫБЕРИ → ПРИМЕРЬ → ЗАБРОНИРУЙ). Server component: declares metadata + loads
 * the distinctive display face, then hands off to the "use client" Experience
 * which dynamic-imports the WebGL ring with { ssr:false }.
 */

// Unbounded — a heavy geometric display face with real character (not Inter).
// Scoped to this variant via a CSS variable so it never leaks to other routes.
const display = localFont({
  src: "../../../public/fonts/Unbounded-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-director-display",
});

export const metadata: Metadata = {
  title: "РЕЖИССЁРСКАЯ ВЕРСИЯ — PIERCERKZN",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={display.variable}>
      <Experience />
    </div>
  );
}
