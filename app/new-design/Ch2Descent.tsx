"use client";

import styles from "./page.module.css";

interface Ch2DescentProps {
    sectionRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Ch2Descent — first of two 100vh spacers between Chapter 1 and
 * Chapter 2. Hosts the Ch1→Ch2 camera storyboard:
 *
 *   stage A (0.00 → 0.20 ch2DescentPhase): extra pull-back from Ch1.
 *   stage B (0.20 → 0.45):                  tilt straight DOWN at floor.
 *   stage C (0.45 → 0.75):                  descend toward floor.
 *   stage D (0.75 → 1.00):                  final settle, gentle zoom.
 *
 * No DOM content; the camera move happens inside the 3D scene. The
 * full 100vh gives each stage ~20-28vh of scroll — much more breathing
 * room than the previous half-of-Ch2Intro compression.
 *
 * After this section the camera holds at stage-D values for the entire
 * Ch2Title section so ПРИМЕРЬ can float in over a steady floor view.
 */
export default function Ch2Descent({ sectionRef }: Ch2DescentProps) {
    return <section ref={sectionRef} className={styles.chooseIntroSpacer} aria-hidden="true" />;
}
