"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LabChrome } from "@/components/landing-labs/_shared/LabChrome";
import { useLenisGsap } from "@/components/landing-labs/_shared/useLenisGsap";
import { useTheme } from "@/lib/theme/theme-provider";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { ChromFallback } from "./ChromFallback";
import { ChromCursor } from "./ChromCursor";
import styles from "./chrom.module.css";

/* canvas is dynamic-imported with ssr:false (R3F can't render on the server) */
const ChromScene = dynamic(() => import("./ChromScene"), { ssr: false });

// Computed once at module load (not during render) to satisfy the strict
// react-hooks purity lint (no Date/Math.random during render).
const CURRENT_YEAR = new Date().getFullYear();

// Inline SVG fractal-noise grain → data URI (no extra asset request).
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E")`;

const MATERIALS = [
  {
    no: "01",
    name: "Титан ASTM F136",
    spec: "Имплант-grade · гипоаллергенный",
    body:
      "Сплав для первичных проколов. Не темнеет, не вызывает реакций, держит зеркальную полировку годами.",
    swatch: "linear-gradient(135deg, #d7dde2 0%, #9aa6b0 40%, #e8edf1 60%, #7e8a95 100%)",
  },
  {
    no: "02",
    name: "Золото 585",
    spec: "14K · тёплый блеск",
    body:
      "Для заживших каналов и витринных образов. Глубокий тёплый отблеск, который ловит свет иначе, чем сталь.",
    swatch: "linear-gradient(135deg, #ffe9b0 0%, #d9a441 45%, #fff2cf 60%, #b9842b 100%)",
  },
  {
    no: "03",
    name: "Хирургическая сталь",
    spec: "316L · строгая геометрия",
    body:
      "Холодный графитовый хром. Базовый материал для штанг, колец-сегментов и индастриала.",
    swatch: "linear-gradient(135deg, #c6ccd2 0%, #6f7780 45%, #dfe4e8 62%, #565d65 100%)",
  },
] as const;

const STEPS = [
  { no: "01", t: "Выбери зону", d: "Хеликс, септум, лабрет, индастриал — отметь точку на 3D-модели." },
  { no: "02", t: "Примерь украшение", d: "Кольцо-сегмент, штанга, банан — поверни и рассмотри в реальном масштабе." },
  { no: "03", t: "Запишись", d: "Бронируешь мастера и дату прямо после примерки. Без догадок." },
] as const;

export function Experience() {
  const reduced = useReducedMotion() ?? false;
  const { theme } = useTheme();
  const webgl = useWebGL2Supported();
  useLenisGsap();

  const scopeRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const pointerActiveRef = useRef(false);
  const progressRef = useRef(0); // 0→1 scene progress, driven by ScrollTrigger

  // ── pointer tracking (refs only) ──
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointerActiveRef.current = true;
    };
    const onLeave = () => {
      pointerActiveRef.current = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, []);

  // ── ScrollTrigger drives progressRef across the whole page ──
  useEffect(() => {
    if (!scopeRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const el = scopeRef.current;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          progressRef.current = self.progress;
        },
      });

      // section reveals — chrome panels rise + un-blur on enter
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((node) => {
        gsap.fromTo(
          node,
          { y: reduced ? 0 : 48, autoAlpha: 0, filter: reduced ? "none" : "blur(12px)" },
          {
            y: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: node, start: "top 82%" },
          },
        );
      });
    }, el);

    // recompute pin/positions after fonts + canvas settle
    const refreshT = window.setTimeout(() => ScrollTrigger.refresh(), 400);

    return () => {
      window.clearTimeout(refreshT);
      ctx.revert();
    };
  }, [reduced]);

  const isLight = theme === "light";

  return (
    <div
      ref={scopeRef}
      className={styles.root}
      data-cursor="on"
      style={
        {
          "--chrom-grain-url": GRAIN_URL,
          "--chrom-warm": "#ffb27a",
          "--chrom-atmo-opacity": isLight ? 0.32 : 0.6,
          "--chrom-atmo-blend": isLight ? "multiply" : "screen",
          "--chrom-grain-opacity": isLight ? 0.05 : 0.08,
          "--chrom-grain-blend": isLight ? "multiply" : "overlay",
          "--chrom-scan-opacity": isLight ? 0.025 : 0.05,
        } as React.CSSProperties
      }
    >
      {/* ── fixed WebGL canvas (or branded fallback) ── */}
      <div className={styles.canvasLayer}>
        {webgl === false ? (
          <ChromFallback />
        ) : webgl ? (
          <ChromScene
            mouseRef={mouseRef}
            pointerActiveRef={pointerActiveRef}
            progressRef={progressRef}
            reduced={reduced}
          />
        ) : null}
      </div>

      {/* atmosphere veils over the canvas */}
      <div className={styles.atmosphere} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />
      {!reduced && <ChromCursor />}

      <LabChrome no="02" title="ХРОМ" />

      {/* ════════════ DOM CONTENT (scrolls over the canvas) ════════════ */}
      <div className={styles.content}>
        {/* ── HERO ── */}
        <section className="relative flex min-h-[100svh] flex-col justify-between px-[clamp(20px,5vw,72px)] pb-[clamp(40px,8vh,90px)] pt-[clamp(96px,16vh,180px)]">
          <div className={styles.heroScrim} aria-hidden="true" />
          <m.p
            className={`${styles.kicker} relative z-[1]`}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            PIERCERKZN · Казань · Скоро открытие
          </m.p>

          <div className="pointer-events-none relative z-[1]">
            <h1 className={`${styles.display} max-w-[14ch]`}>
              <m.span
                className={`${styles.chromeText} block`}
                style={{ fontSize: "clamp(64px,15vw,220px)" }}
                initial={reduced ? false : { opacity: 0, y: 40, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                ЖИДКИЙ
              </m.span>
              <m.span
                className={`${styles.chromeText} block`}
                style={{ fontSize: "clamp(64px,15vw,220px)" }}
                initial={reduced ? false : { opacity: 0, y: 40, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                МЕТАЛЛ
              </m.span>
            </h1>
            <m.p
              className="mt-[clamp(20px,3vh,34px)] max-w-[46ch] text-balance text-[clamp(15px,1.7vw,20px)] leading-relaxed text-mute"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              Студия пирсинга в Казани. Примерь украшение в 3D до прокола —
              поверни, рассмотри, выбери металл. Титан, золото 585, сталь.
            </m.p>
          </div>

          <m.div
            className="pointer-events-auto relative z-[1] flex flex-wrap items-center gap-[clamp(12px,2vw,18px)]"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.64 }}
          >
            <Link href="/book" className={`${styles.cta} ${styles.ctaPrimary}`}>
              Записаться
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/catalog" className={`${styles.cta} ${styles.ctaGhost}`}>
              Каталог
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <span className={`${styles.tag} ml-auto hidden sm:block`}>
              Прокрути ↓ камера летит сквозь хром
            </span>
          </m.div>
        </section>

        {/* ── MARQUEE divider ── */}
        <section className="relative overflow-hidden border-y border-ink-line py-[clamp(14px,3vh,28px)]">
          <div className={styles.marquee}>
            {[0, 1].map((dup) => (
              <div key={dup} className="flex" aria-hidden={dup === 1}>
                {["ТИТАН", "·", "ЗОЛОТО 585", "·", "СТАЛЬ 316L", "·", "ХРОМ", "·"].map(
                  (w, i) => (
                    <span
                      key={`${dup}-${i}`}
                      className={`${styles.marqueeItem} ${
                        w === "·" ? styles.marqueeItemFill : ""
                      }`}
                    >
                      {w}
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── MATERIAL STORY ── */}
        <section className="relative px-[clamp(20px,5vw,72px)] py-[clamp(60px,12vh,150px)]">
          <div data-reveal className="mb-[clamp(36px,7vh,80px)] max-w-[60ch]">
            <p className={styles.tag}>02 — Материалы</p>
            <h2
              className={`${styles.display} mt-4`}
              style={{ fontSize: "clamp(34px,6vw,88px)" }}
            >
              <span className={styles.chromeText}>Три сплава.</span>
              <br />
              Один свет.
            </h2>
            <p className="mt-5 max-w-[44ch] text-[clamp(14px,1.5vw,17px)] leading-relaxed text-mute">
              Каждый материал ловит свет по-своему. В примерке ты видишь не
              рендер «вообще», а именно тот сплав, что войдёт в твой канал.
            </p>
          </div>

          <div className="grid gap-[clamp(14px,2vw,22px)] md:grid-cols-3">
            {MATERIALS.map((mat) => (
              <article
                key={mat.no}
                data-reveal
                data-cursor-grow
                className={`${styles.card} group flex flex-col gap-5 p-[clamp(20px,2.4vw,32px)]`}
              >
                <div className="flex items-center justify-between">
                  <span className={styles.tag}>{mat.no}</span>
                  <span
                    className="size-14 rounded-full shadow-[inset_0_1px_3px_rgba(255,255,255,0.5),0_8px_24px_-10px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-110"
                    style={{ backgroundImage: mat.swatch }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3
                    className={`${styles.display} text-ink`}
                    style={{ fontSize: "clamp(22px,2.4vw,30px)", lineHeight: 1.05 }}
                  >
                    {mat.name}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                    {mat.spec}
                  </p>
                </div>
                <p className="text-[14px] leading-relaxed text-mute">{mat.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 3D TRY-ON PITCH ── */}
        <section className="relative px-[clamp(20px,5vw,72px)] py-[clamp(60px,12vh,150px)]">
          <div
            data-reveal
            className={`${styles.card} mx-auto flex max-w-[1100px] flex-col gap-[clamp(36px,6vh,64px)] p-[clamp(24px,5vw,72px)]`}
          >
            <div className="max-w-[56ch]">
              <p className={styles.tag}>03 — Примерка в 3D</p>
              <h2
                className={`${styles.display} mt-4`}
                style={{ fontSize: "clamp(30px,5.5vw,76px)" }}
              >
                Примерь до{" "}
                <span className={styles.chromeText}>прокола.</span>
              </h2>
              <p className="mt-5 text-[clamp(15px,1.6vw,19px)] leading-relaxed text-mute">
                Наша фишка: каждое украшение — настоящая 3D-модель. Крути,
                приближай, меняй металл и размер на реальной анатомии. Никаких
                «как-нибудь подойдёт».
              </p>
            </div>

            <ol className="grid gap-[clamp(16px,2vw,28px)] md:grid-cols-3">
              {STEPS.map((s) => (
                <li
                  key={s.no}
                  data-reveal
                  className="border-t border-ink-line-strong pt-5"
                >
                  <span
                    className={`${styles.display} text-accent`}
                    style={{ fontSize: "clamp(40px,6vw,72px)", lineHeight: 1 }}
                  >
                    {s.no}
                  </span>
                  <h3 className="mt-3 text-[clamp(16px,1.8vw,21px)] font-semibold text-ink">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-mute">{s.d}</p>
                </li>
              ))}
            </ol>

            <div className="pointer-events-auto">
              <Link href="/catalog" className={`${styles.cta} ${styles.ctaGhost}`}>
                Открыть примерочную
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── FLOATING GALLERY (the GLBs gliding by) ── */}
        <section className="relative flex min-h-[80svh] flex-col justify-center px-[clamp(20px,5vw,72px)] py-[clamp(60px,12vh,150px)]">
          <div data-reveal className="max-w-[60ch]">
            <p className={styles.tag}>04 — Витрина</p>
            <h2
              className={`${styles.display} mt-4`}
              style={{ fontSize: "clamp(34px,7vw,110px)" }}
            >
              <span className={styles.chromeText}>Они уже здесь.</span>
            </h2>
            <p className="mt-5 max-w-[42ch] text-[clamp(14px,1.5vw,18px)] leading-relaxed text-mute">
              Кольца-сегменты, бананы, лабреты и нострилы парят в хромовой
              пустоте вокруг тебя. Полный каталог — с весом, gauge и
              миллиметрами — в примерочной.
            </p>
            <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
              {["Хеликс", "Септум", "Лабрет", "Индастриал", "Нострил"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mute"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="relative flex min-h-[90svh] flex-col items-center justify-center gap-[clamp(28px,5vh,52px)] px-[clamp(20px,5vw,72px)] py-[clamp(60px,12vh,150px)] text-center">
          <div data-reveal className="flex flex-col items-center gap-[clamp(24px,5vh,44px)]">
            <p className={styles.tag}>Запись открыта</p>
            <h2
              className={`${styles.display} ${styles.chromeText} max-w-[16ch]`}
              style={{ fontSize: "clamp(48px,12vw,180px)" }}
            >
              ТВОЙ ХРОМ ЖДЁТ
            </h2>
            <p className="max-w-[40ch] text-[clamp(15px,1.7vw,20px)] leading-relaxed text-mute">
              Стерильность, имплант-титан и примерка в 3D. PIERCERKZN — пирсинг,
              который ты видишь заранее.
            </p>
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-[clamp(12px,2vw,18px)]">
              <Link href="/book" className={`${styles.cta} ${styles.ctaPrimary}`}>
                Записаться
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/catalog" className={`${styles.cta} ${styles.ctaGhost}`}>
                Каталог
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <footer className="mt-auto flex w-full flex-col items-center gap-2 pt-[clamp(40px,8vh,90px)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-mute">
              PIERCERKZN · Казань · {CURRENT_YEAR}
            </p>
            <Link
              href="/landing-labs"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute no-underline transition-colors hover:text-ink"
            >
              ← Лаборатория концептов
            </Link>
          </footer>
        </section>
      </div>
    </div>
  );
}
