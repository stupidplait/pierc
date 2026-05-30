"use client";

import styles from "./page.module.css";

interface Ch2TitleProps {
    sectionRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Ch2Title — second of two 100vh spacers between Chapter 1 and
 * Chapter 2. The camera has already settled on the floor close-up
 * by the start of this section; here it holds while ПРИМЕРЬ slides
 * in, holds, and slides out. Mirrors ChooseIntro's role for ВЫБЕРИ.
 *
 *   slide-in:   ch2TitlePhase 0.00 → 0.20
 *   held:       ch2TitlePhase 0.20 → 0.70
 *   slide-out:  ch2TitlePhase 0.70 → 1.00
 *
 * No DOM content; the title is rendered as a 3D Text mesh in the
 * scene (see AnimatedFloorText in WireframeRoom.tsx) so it sits
 * directly on the floor and is picked up by the bloom pass — no
 * HTML overlay needed.
 */
export default function Ch2Title({ sectionRef }: Ch2TitleProps) {
    return <section ref={sectionRef} className={styles.chooseIntroSpacer} aria-hidden="true" />;
}
