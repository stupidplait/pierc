"use client";

import styles from "./page.module.css";
import JewelryShowcase from "@/components/showcase/JewelryShowcase";
import BodyModelPreview from "./BodyModelPreview";
import ReserveSummary from "./ReserveSummary";
import Ch2Descent from "./Ch2Descent";
import Ch2Title from "./Ch2Title";

/**
 * HowItWorks — scroll-driven 3-chapter storytelling:
 *   Chapter 1:   Jewelry Showcase — browse + preview jewelry on the pedestal
 *   Ch2Descent:  100vh spacer hosting the Ch1→Ch2 camera storyboard
 *                (fly back, tilt down, descend toward floor)
 *   Ch2Title:    100vh spacer hosting the floating ПРИМЕРЬ title over
 *                the held floor view (mirrors ChooseIntro's role for ВЫБЕРИ)
 *   Chapter 2:   Body Model — select anchor points
 *   Chapter 3:   Reserve — summary + CTA to Telegram
 *
 * Each chapter and each intro spacer is 100vh. The parent page reads
 * scroll progress per section and feeds it into WireframeRoom so the
 * 3D scene reacts.
 */

interface HowItWorksProps {
    chapter1Ref: React.RefObject<HTMLDivElement | null>;
    ch2DescentRef: React.RefObject<HTMLDivElement | null>;
    ch2TitleRef: React.RefObject<HTMLDivElement | null>;
    chapter2Ref: React.RefObject<HTMLDivElement | null>;
    chapter3Ref: React.RefObject<HTMLDivElement | null>;
    ch2BodyPhase: React.RefObject<number>;
    activeJewelry: number;
    onJewelryChange: (index: number) => void;
    onNameChange: (name: string) => void;
    activeArea: string;
    onAreaChange: (areaId: string) => void;
    transitionProgress: React.RefObject<number>;
    swapDirection: React.RefObject<number>;
}

export default function HowItWorks({
    chapter1Ref,
    ch2DescentRef,
    ch2TitleRef,
    chapter2Ref,
    chapter3Ref,
    ch2BodyPhase,
    activeJewelry,
    onJewelryChange,
    onNameChange,
    activeArea,
    onAreaChange,
    transitionProgress,
    swapDirection,
}: HowItWorksProps) {
    return (
        <section className={styles.howItWorks} aria-label="How It Works">
            <JewelryShowcase
                chapterRef={chapter1Ref}
                activeJewelry={activeJewelry}
                onJewelryChange={onJewelryChange}
                onNameChange={onNameChange}
                transitionProgress={transitionProgress}
                swapDirection={swapDirection}
            />
            <Ch2Descent sectionRef={ch2DescentRef} />
            <Ch2Title sectionRef={ch2TitleRef} />
            <BodyModelPreview
                chapterRef={chapter2Ref}
                ch2BodyPhase={ch2BodyPhase}
                activeArea={activeArea}
                onAreaChange={onAreaChange}
            />
            {/* Chapter 3 (ЗАБРОНИРУЙ / Reserve) commented out per design pass —
                Ch2 is the current focus. chapter3Ref is still wired through so
                page-level scroll logic doesn't break. Restore by uncommenting. */}
            {/* <ReserveSummary chapterRef={chapter3Ref} activeJewelry={activeJewelry} /> */}
        </section>
    );
}
