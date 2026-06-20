import type { Metadata } from "next";
import localFont from "next/font/local";
import { Experience } from "@/components/landing-labs/atlas/Experience";

/**
 * /landing-labs/atlas — «АТЛАС ТЕЛА» (no 03, codename BODY ATLAS).
 *
 * Clinical / precision-instrument landing concept for PIERCERKZN. The
 * centrepiece is an interactive 3D body atlas: hotspots at real piercing zones
 * on body.glb, each opening a deep-dive panel with the matching real jewelry
 * GLB spinning in a specimen viewer plus material / gauge / price spec. Server
 * component → renders the client Experience.
 */

// Distinctive display face — Russo One: geometric, technical, slightly
// industrial; reads as instrument labelling, which suits the clinical register.
const russoOne = localFont({
  src: "../../../public/fonts/RussoOne-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-atlas-display",
});

export const metadata: Metadata = {
  title: "АТЛАС ТЕЛА — PIERCERKZN",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={russoOne.variable}>
      <Experience />
    </div>
  );
}
