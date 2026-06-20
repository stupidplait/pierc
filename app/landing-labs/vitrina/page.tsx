import type { Metadata } from "next";
import localFont from "next/font/local";
import { Experience } from "@/components/landing-labs/vitrina/Experience";

/**
 * Landing Lab 04 — «ВИТРИНА» (BENTO SHOWCASE).
 *
 * Server shell: declares the display face (Unbounded, a high-contrast geometric
 * display with real character) scoped to a CSS variable, sets noindex metadata,
 * and renders the client <Experience/>. All interactivity, motion, and the
 * dynamic-imported WebGL tile live below in the client tree.
 */
const displayFont = localFont({
  src: "../../../public/fonts/Unbounded-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-vitrina-display",
});

const monoFont = localFont({
  src: "../../../public/fonts/RubikMonoOne-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-vitrina-mono",
});

export const metadata: Metadata = {
  title: "ВИТРИНА — PIERCERKZN",
  description:
    "Кинетическое бенто-портфолио студии пирсинга PIERCERKZN в Казани. 3D-примерка украшений, титан ASTM F136 и золото 585.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={`${displayFont.variable} ${monoFont.variable}`}>
      <Experience />
    </div>
  );
}
