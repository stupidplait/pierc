"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Preloader from "@/components/scene/Preloader";
import { useScrollBus } from "@/lib/hooks/useScrollBus";

const WireframeRoom = dynamic(() => import("@/components/scene/WireframeRoom"), {
  ssr: false,
});

interface HeroProps {
  activeJewelry: number;
  transitionProgress: React.RefObject<number>;
  swapDirection: React.RefObject<number>;
  ch2TitlePhase?: React.RefObject<number>;
  ch2Phase?: React.RefObject<number>;
  chapter2Phase?: React.RefObject<number>;
  ch3TitlePhase?: React.RefObject<number>;
}

export function Hero({ activeJewelry, transitionProgress, swapDirection, ch2TitlePhase, ch2Phase, chapter2Phase, ch3TitlePhase }: HeroProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const pointerActiveRef = useRef(true);
  const scrollPhaseRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("landing-mounted");
    return () => {
      html.classList.remove("landing-mounted");
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerActiveRef.current = true;
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      pointerActiveRef.current = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useScrollBus((s) => {
    scrollPhaseRef.current = s.scrollPhase;
  });

  const handleDismissStart = useCallback(() => {
    setRevealed(true);
  }, []);

  return (
    <>
      <div
        ref={stageRef}
        data-revealed={revealed ? "1" : "0"}
        className="fixed inset-0 z-[1] overflow-hidden bg-scene-bg opacity-0 transition-opacity duration-150 ease-out data-[revealed=1]:opacity-100"
      >
        <WireframeRoom
          scopeRef={stageRef}
          fontUrl="/fonts/Montserrat-ExtraBold.ttf"
          mouseRef={mouseRef}
          pointerActiveRef={pointerActiveRef}
          onReady={() => setSceneReady(true)}
          revealed={revealed}
          scrollPhase={scrollPhaseRef}
          activeJewelry={activeJewelry}
          transitionProgress={transitionProgress}
          swapDirection={swapDirection}
          ch2TitlePhase={ch2TitlePhase}
          ch2Phase={ch2Phase}
          chapter2Phase={chapter2Phase}
          ch3TitlePhase={ch3TitlePhase}
        />
      </div>

      <section
        aria-label="PiercerKZN — hero"
        className="relative h-[100svh] w-full"
      >
        <h1 className="sr-only">
          PiercerKZN — студия пирсинга в Казани с 3D-примеркой украшений
        </h1>
      </section>

      <Preloader ready={sceneReady} onDismissStart={handleDismissStart} />
    </>
  );
}
