import type { Metadata } from "next";
import localFont from "next/font/local";
import { Experience } from "@/components/landing-labs/chrom/Experience";

/**
 * /landing-labs/chrom — «ХРОМ» (no 02, codename LIQUID METAL).
 *
 * Cinematic, maximal-WebGL landing concept for PIERCERKZN: a hero jewelry
 * piece rendered as liquid chrome that morphs toward the cursor, a spark/dust
 * particle field, postprocessing (bloom + chromatic aberration + noise +
 * vignette), a scroll-driven camera dolly through a void with floating GLBs,
 * and a cursor fluid trail. Server component → renders the client Experience.
 */

// Distinctive display face — Unbounded Bold (geometric, characterful) loaded as
// a CSS variable so the chrom CSS module + drei <Text> can both reference it.
const unbounded = localFont({
  src: "../../../public/fonts/Unbounded-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-chrom-display",
});

export const metadata: Metadata = {
  title: "ХРОМ — PIERCERKZN",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className={unbounded.variable}>
      <Experience />
    </div>
  );
}
