import type { Metadata } from "next";
import localFont from "next/font/local";
import { Experience } from "@/components/landing-labs/ostrie/Experience";

/**
 * /landing-labs/ostrie — «ОСТРИЁ» (no 01, codename EDITORIAL).
 *
 * Brutalist editorial kinetic-typography landing for PIERCERKZN. High-key light
 * (near-white paper, hairline rules, oversized black grotesk) with ONE surgical
 * magenta accent; resolves to ink-on-near-black in dark. Type-led: a single small
 * R3F chrome stud slowly rotating in the hero corner is the only 3D. Server
 * component → renders the client Experience shell.
 */

// Display face — Unbounded Bold: a geometric grotesk with real character for the
// oversized Russian headlines. Exposed as a CSS variable consumed by the ostrie
// CSS module (the page-load split-letter words) and the corner stud's drei <Text>.
const unbounded = localFont({
  src: "../../../public/fonts/Unbounded-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-ostrie-display",
});

// Secondary display — Russo One: a stout industrial face used for the editorial
// numerals and the rail card indices, so the page reads with two distinct voices.
const russo = localFont({
  src: "../../../public/fonts/RussoOne-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-ostrie-russo",
});

export const metadata: Metadata = {
  title: "ОСТРИЁ — PIERCERKZN",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={`${unbounded.variable} ${russo.variable}`}>
      <Experience />
    </div>
  );
}
