"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Hero } from "./Hero";
import ChooseIntro from "./ChooseIntro";
import Ch2Intro from "./Ch2Intro";
import Chapter2 from "./Chapter2";
import Chapter3 from "./Chapter3";
import Ch3Intro from "./Ch3Intro";
import { subscribeScroll } from "@/lib/hooks/useScrollBus";
import { useSectionSnap } from "@/lib/hooks/useSectionSnap";

const JewelryShowcase = dynamic(
  () => import("@/components/showcase/JewelryShowcase"),
  { ssr: false },
);

export function LandingShell() {
  const [activeJewelry, setActiveJewelry] = useState(0);
  const transitionProgress = useRef(0);
  const swapDirection = useRef(1);

  const chooseIntroRef = useRef<HTMLElement | null>(null);
  const chapter1Ref = useRef<HTMLDivElement | null>(null);
  const ch2IntroRef = useRef<HTMLElement | null>(null);
  const chapter2Ref = useRef<HTMLElement | null>(null);
  // Snap anchor at Chapter 2's midpoint (where its frame fully composes),
  // used in place of the section top in the snap list below.
  const chapter2SnapRef = useRef<HTMLDivElement | null>(null);
  const ch3IntroRef = useRef<HTMLElement | null>(null);
  const chapter3Ref = useRef<HTMLElement | null>(null);

  const ch2TitlePhase = useRef(0);
  const ch2Phase = useRef(0);
  const chapter2Phase = useRef(0);
  const ch3TitlePhase = useRef(0);

  /* Compute ch2TitlePhase across a 2vh window centered on the moment
     Ch2Intro fills the viewport. Mirrors the apex semantics that
     scrollPhase has for ChooseIntro / ВЫБЕРИ.

       rect.top =  vh   ⇒ raw 0.0   (section just below viewport)
       rect.top =  0    ⇒ raw 0.5   (section pinned at top — apex)
       rect.top = -vh   ⇒ raw 1.0   (section fully scrolled past)

     Combined with section snap, the user lands at rect.top = 0 with
     ПРИМЕРЬ centered. The user can't dwell at intermediate positions
     because the snap loop pulls them to the nearest section top after
     600 ms idle, so there's no perceptible "fade-in during Chapter 1
     tail" — transitions through that range happen at snap velocity.

     ch2Phase drives the WireframeRoom camera dolly:
       beat 1 (0.0 → 0.5): tilt + pullback to look at floor
       beat 2 (0.5 → 1.0): FOV zoom-in once rotation completes

     Because Ch2Intro is the last DOM section, the user can only scroll
     until rect.top = 0 (ch2TitlePhase max = 0.5). To make the entire
     dolly reachable inside that window, we map ch2Phase = clamp(0, 1,
     ch2TitlePhase * 2). At apex (ch2TitlePhase = 0.5) the camera lands
     fully rotated AND zoomed; ПРИМЕРЬ enters during the second half of
     the transition (after tilt completes), so the title surfaces over
     a stable floor view, exactly when the user is scrolled into Ch2Intro.

     chapter2Phase drives the Ch2 background grid (rendered as a 3D
     plane in WireframeRoom so the FluidTrailEffect post-process
     affects it). Ramps 0 → 1 across Chapter 2's own scroll-through:

       rect.top =  0    ⇒ raw 0.0   (section top hits viewport top)
       rect.top = -vh   ⇒ raw 1.0   (user has scrolled 1vh into section)

     With Chapter 2 sized 200svh and being the last DOM section, max
     scroll places the section's bottom at viewport bottom → rect.top
     reaches -vh, raw reaches 1.0. The grid's Y offset is driven by
     this phase; plus-marks parallax-scroll at 1.1 × the same phase. */
  useEffect(() => {
    const unsubscribe = subscribeScroll(() => {
      const vh = window.innerHeight || 1;

      const ch2 = ch2IntroRef.current;
      if (ch2) {
        const rect = ch2.getBoundingClientRect();
        const raw = (vh - rect.top) / (2 * vh);
        const titlePhase = Math.max(0, Math.min(1, raw));
        ch2TitlePhase.current = titlePhase;
        ch2Phase.current = Math.min(1, titlePhase * 2);
      }

      const chapter2 = chapter2Ref.current;
      if (chapter2) {
        const rect = chapter2.getBoundingClientRect();
        const raw = -rect.top / vh;
        chapter2Phase.current = Math.max(0, Math.min(1, raw));
      }

      /* ch3TitlePhase mirrors ch2TitlePhase semantics over the
         Ch3Intro section's 100svh: 0.5 = section pinned at top
         (apex). The slide-in/hold/slide-out beats land in the
         0.25 → 0.75 sub-window so they're fully resolved at the
         apex landing. */
      const ch3 = ch3IntroRef.current;
      if (ch3) {
        const rect = ch3.getBoundingClientRect();
        const raw = (vh - rect.top) / (2 * vh);
        ch3TitlePhase.current = Math.max(0, Math.min(1, raw));
      }
    });
    return unsubscribe;
  }, []);

  /* Section snap — wheel-hijacking smooth scroll loop with snap-to-
     nearest after 600 ms idle. Touch devices opt-out (native momentum
     handles the same role). Stop-points, top to bottom: ChooseIntro
     (ВЫБЕРИ) → Chapter 1 (showcase) → Ch2Intro (ПРИМЕРЬ) → Chapter 2
     *midpoint* → Ch3Intro (ЗАБРОНИРУЙ) → Chapter 3. Chapter 2 uses its
     midpoint anchor rather than chapter2Ref's top: the section is 200svh
     and only fully composes halfway down, so snapping to its top would
     leave the chapter on an empty transition frame. */
  useSectionSnap({
    sectionRefs: [chooseIntroRef, chapter1Ref, ch2IntroRef, chapter2SnapRef, ch3IntroRef, chapter3Ref],
  });

  return (
    <>
      <Hero
        activeJewelry={activeJewelry}
        transitionProgress={transitionProgress}
        swapDirection={swapDirection}
        ch2TitlePhase={ch2TitlePhase}
        ch2Phase={ch2Phase}
        chapter2Phase={chapter2Phase}
        ch3TitlePhase={ch3TitlePhase}
      />
      <ChooseIntro ref={chooseIntroRef} />
      <JewelryShowcase
        chapterRef={chapter1Ref}
        activeJewelry={activeJewelry}
        onJewelryChange={setActiveJewelry}
        transitionProgress={transitionProgress}
        swapDirection={swapDirection}
      />
      <Ch2Intro ref={ch2IntroRef} />
      <Chapter2 ref={chapter2Ref} snapAnchorRef={chapter2SnapRef} />
      <Ch3Intro ref={ch3IntroRef} />
      <Chapter3 ref={chapter3Ref} activeJewelry={activeJewelry} />
    </>
  );
}
