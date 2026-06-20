"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";

import { LabThemeToggle } from "@/components/landing-labs/_shared/LabThemeToggle";
import { useLenisGsap } from "@/components/landing-labs/_shared/useLenisGsap";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { useTheme } from "@/lib/theme/theme-provider";

import styles from "./director.module.css";
import { Cursor } from "./Cursor";
import { DirectorPreloader } from "./DirectorPreloader";
import { useSceneTokens } from "./use-scene-tokens";

const RingScene = dynamic(() => import("./RingScene"), { ssr: false });

/* A small data-URI noise tile for the grain overlay (no asset, no install). */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/* ── small lint-safe media-query hook ──────────────────────────────────── */
function useMatchMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function Experience() {
  const webgl2 = useWebGL2Supported();
  const reducedMotion = useReducedMotion();
  const finePointer = useMatchMedia("(hover: hover) and (pointer: fine)");
  const tokens = useSceneTokens();
  const { theme } = useTheme();

  // Smooth scroll + ScrollTrigger wiring (honours reduced motion internally).
  useLenisGsap();

  // ── transient refs (no state churn) ──────────────────────────────────
  const rootRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const pointerActiveRef = useRef(true);
  const scrollRef = useRef(0); // 0..1 global progress, read by the scene
  const scrubRef = useRef<HTMLDivElement>(null); // timeline progress bar fill
  const tcRef = useRef<HTMLSpanElement>(null); // running timecode in the HUD

  const [sceneReady, setSceneReady] = useState(false);
  const [cut, setCut] = useState(false); // preloader handed off → bars slide in
  const [muted, setMuted] = useState(true);

  const handleReady = useCallback(() => setSceneReady(true), []);
  const handleCut = useCallback(() => setCut(true), []);

  // Mark the variant mounted for any global hooks; track pointer in NDC.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerActiveRef.current = true;
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => (pointerActiveRef.current = false);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // ── global scroll → progress ref + HUD (rAF-batched, refs only) ───────
  useEffect(() => {
    let raf = 0;
    const fmt = (p: number) => {
      // map progress to a fake reel timecode 00:00:00 → 03:00:00 (3 acts)
      const total = 180; // seconds
      const s = Math.floor(p * total);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      const ff = String(Math.floor((p * total * 24) % 24)).padStart(2, "0");
      return `${mm}:${ss}:${ff}`;
    };
    const tick = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      scrollRef.current = p;
      if (scrubRef.current) scrubRef.current.style.transform = `scaleX(${p})`;
      if (tcRef.current) tcRef.current.textContent = fmt(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── GSAP-pinned acts + kinetic titles, scoped + reverted ──────────────
  useEffect(() => {
    if (webgl2 === false) return; // fallback layout has no pinned scaffolding
    gsap.registerPlugin(ScrollTrigger);
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Each act: pin its frame, drive its kinetic word across the viewport,
      // and fade/raise its copy in. Reduced-motion → no pin, no drift.
      const acts = gsap.utils.toArray<HTMLElement>("[data-act]");
      acts.forEach((act) => {
        const word = act.querySelector<HTMLElement>("[data-kinetic]");
        const copy = act.querySelectorAll<HTMLElement>("[data-fade]");

        if (!reduce) {
          ScrollTrigger.create({
            trigger: act,
            start: "top top",
            end: "+=120%",
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
          });

          if (word) {
            const dir = act.dataset.dir === "rtl" ? 1 : -1;
            gsap.fromTo(
              word,
              { xPercent: dir * 18 },
              {
                xPercent: dir * -18,
                ease: "none",
                scrollTrigger: {
                  trigger: act,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                },
              },
            );
          }
        }

        if (copy.length) {
          gsap.fromTo(
            copy,
            { autoAlpha: 0, y: 30 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.9,
              stagger: 0.08,
              ease: "power3.out",
              scrollTrigger: { trigger: act, start: "top 65%" },
            },
          );
        }
      });

      // Finale card reveal
      const finale = root.querySelector<HTMLElement>("[data-finale]");
      if (finale) {
        gsap.fromTo(
          finale.querySelectorAll<HTMLElement>("[data-fade]"),
          { autoAlpha: 0, y: 30 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.07,
            ease: "power3.out",
            scrollTrigger: { trigger: finale, start: "top 70%" },
          },
        );
      }
    }, root);

    // Recompute pin positions once fonts/canvas settle.
    const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => {
      window.clearTimeout(refreshId);
      ctx.revert();
    };
  }, [webgl2]);

  // sound toggle — no real audio asset shipped; the affordance stays muted by
  // default and only flips a local flag (kept honest, no autoplay).
  const toggleSound = useCallback(() => setMuted((v) => !v), []);

  /* ── WebGL2 unsupported → branded static fallback ──────────────────── */
  if (webgl2 === false) {
    return (
      <div
        ref={rootRef}
        className={styles.root}
        style={{ ["--grain-url" as string]: GRAIN_URL }}
      >
        <Chrome muted={muted} onToggleSound={toggleSound} scrubRef={scrubRef} tcRef={tcRef} cut />
        <div className={styles.fallback}>
          <p className={`${styles.reel} text-[11px] text-mute`}>PIERCERKZN · Казань · Скоро открытие</p>
          <h1 className={`${styles.disp} text-[clamp(44px,11vw,120px)] text-ink`}>
            РЕЖИССЁРСКАЯ
            <br />
            ВЕРСИЯ
          </h1>
          <p className="max-w-md text-balance text-sm text-mute">
            Студия пирсинга с 3D-примеркой украшений. Титан ASTM F136 · Золото 585.
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/book" className={styles.ctaSolid + " " + styles.cta}>Записаться</Link>
            <Link href="/catalog" className={styles.cta}>Каталог</Link>
          </div>
        </div>
        <div aria-hidden className={styles.grain} />
        <div aria-hidden className={styles.vignette} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-cursor={finePointer && !reducedMotion ? "1" : "0"}
      style={{ ["--grain-url" as string]: GRAIN_URL }}
    >
      {/* ── Fixed WebGL stage ─────────────────────────────────────────── */}
      <div className={`${styles.stage} ${cut ? styles.stageOn : ""}`} aria-hidden>
        {/* Key the scene on theme so Environment/materials regenerate on flip. */}
        <RingScene
          key={theme}
          mouseRef={mouseRef}
          pointerActiveRef={pointerActiveRef}
          scrollRef={scrollRef}
          tokens={tokens}
          reducedMotion={!!reducedMotion}
          onReady={handleReady}
        />
      </div>

      <Chrome
        muted={muted}
        onToggleSound={toggleSound}
        scrubRef={scrubRef}
        tcRef={tcRef}
        cut={cut}
      />

      {/* ════════════ HERO ════════════ */}
      <section className={styles.act} aria-label="PIERCERKZN — режиссёрская версия">
        <div className={styles.actInner}>
          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={cut ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className={`${styles.kicker} mb-6`}
          >
            <span className={styles.kickerLine} />
            Казань · Скоро открытие · Студия пирсинга
          </m.p>

          <h1 className={styles.actTitle}>
            <RevealLine show={cut} delay={0.15}>РЕЖИССЁРСКАЯ</RevealLine>
            <RevealLine show={cut} delay={0.28}>
              <span className={styles.outline}>ВЕРСИЯ</span>
            </RevealLine>
          </h1>

          <m.div
            initial={{ opacity: 0, y: 18 }}
            animate={cut ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="mt-8 grid max-w-5xl gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-end"
          >
            <p className={styles.lead}>
              Три акта одного решения — <strong className="text-ink">ВЫБЕРИ</strong>,{" "}
              <strong className="text-ink">ПРИМЕРЬ</strong>,{" "}
              <strong className="text-ink">ЗАБРОНИРУЙ</strong>. Хром, титан и свет,
              снятые как короткометражка о вашем будущем пирсинге.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/book" className={`${styles.cta} ${styles.ctaSolid}`}>
                Записаться
              </Link>
              <Link href="/catalog" className={styles.cta}>
                Каталог
              </Link>
            </div>
          </m.div>

          <div className="mt-12 flex items-center gap-3 opacity-70">
            <span className={`${styles.reel} text-[10px] text-mute`}>прокрутка</span>
            <span aria-hidden className="block h-9 w-px animate-pulse bg-current/40" />
          </div>
        </div>
      </section>

      {/* ════════════ ACT I — ВЫБЕРИ ════════════ */}
      <Act
        no="АКТ I"
        slate="00:00 — выбор"
        title="ВЫБЕРИ"
        dir="ltr"
        lead="Каталог украшений в чистом 3D. Хирургический титан ASTM F136, золото 585, биосовместимые формы — лабрет, септум, хеликс, индастриал. Вращай, приближай, сравнивай."
        specs={[
          { k: "22+", v: "модели украшений" },
          { k: "F136", v: "имплант-титан" },
          { k: "585", v: "золото" },
          { k: "14–18G", v: "толщины" },
        ]}
        chips={["лабрет", "септум", "хеликс", "индастриал", "штанга", "кольцо-сегмент", "хорсшу"]}
      />

      {/* ════════════ ACT II — ПРИМЕРЬ ════════════ */}
      <Act
        no="АКТ II"
        slate="01:00 — примерка"
        title="ПРИМЕРЬ"
        dir="rtl"
        lead="Наложи украшение на 3D-модель тела и проверь посадку до прокола. Сигнатурная фишка студии: примерка в реальном масштабе — gauge, миллиметры, материал — без догадок."
        specs={[
          { k: "1:1", v: "реальный масштаб" },
          { k: "3D", v: "модель тела" },
          { k: "29", v: "точек пирсинга" },
          { k: "0", v: "догадок" },
        ]}
        frames={[
          { t: "Анатомия", d: "Точки пирсинга на 3D-модели — от мочки до септума." },
          { t: "Масштаб", d: "Украшение в реальных мм и gauge, не на глаз." },
          { t: "Материал", d: "Титан, золото 585 или сталь — выбери металл и оттенок." },
          { t: "Посадка", d: "Проверь, как сидит, до того как взять иглу." },
        ]}
      />

      {/* ════════════ ACT III — ЗАБРОНИРУЙ ════════════ */}
      <Act
        no="АКТ III"
        slate="02:00 — запись"
        title="ЗАБРОНИРУЙ"
        dir="ltr"
        lead="Выбери мастера, дату и время. Стерильная одноразовая игла, сертифицированные материалы, сопровождение заживления. Финальный кадр — твоя запись."
        specs={[
          { k: "100%", v: "стерильно" },
          { k: "1×", v: "одноразовая игла" },
          { k: "∞", v: "сопровождение" },
          { k: "KZN", v: "Казань" },
        ]}
        chips={["консультация", "стерильно", "сертификаты", "заживление", "уход"]}
      />

      {/* ════════════ FINALE — КОНЕЦ / CTA ════════════ */}
      <section
        className={styles.act}
        data-finale
        aria-label="Записаться в PIERCERKZN"
      >
        <div className={styles.actInner}>
          <div className={`${styles.finaleCard}`}>
            <div
              aria-hidden
              className={`${styles.perf} pointer-events-none absolute inset-y-0 left-0 w-4 opacity-60`}
            />
            <div
              aria-hidden
              className={`${styles.perf} pointer-events-none absolute inset-y-0 right-0 w-4 opacity-60`}
            />
            <p data-fade className={`${styles.kicker} ${styles.fadeUp}`}>
              <span className={styles.kickerLine} />
              ФИНАЛ · СЦЕНА 05
            </p>
            <h2
              data-fade
              className={`${styles.fadeUp} ${styles.disp} mt-6 text-[clamp(46px,11vw,150px)]`}
            >
              ТВОЙ ДУБЛЬ
              <br />
              <span className="text-accent">НАЧИНАЕТСЯ</span>
            </h2>
            <p data-fade className={`${styles.fadeUp} ${styles.lead} mt-6`}>
              PIERCERKZN — студия пирсинга в Казани с 3D-примеркой. Скоро открытие.
              Выбери, примерь и забронируй своё украшение прямо сейчас.
            </p>
            <div data-fade className={`${styles.fadeUp} mt-9 flex flex-wrap gap-4`}>
              <Link href="/book" className={`${styles.cta} ${styles.ctaSolid}`}>
                Записаться
              </Link>
              <Link href="/catalog" className={styles.cta}>
                Смотреть каталог
              </Link>
            </div>

            <div
              data-fade
              className={`${styles.fadeUp} mt-12 flex flex-wrap items-end justify-between gap-4 border-t border-ink-line pt-6`}
            >
              <span className={`${styles.reel} text-[10px] text-mute`}>
                PIERCERKZN © {NOW_YEAR} · Казань
              </span>
              <Link
                href="/landing-labs"
                className={`${styles.reel} ${styles.focusable} text-[10px] text-mute no-underline transition-colors hover:text-ink`}
              >
                ← все концепции
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── overlays ──────────────────────────────────────────────────── */}
      <div aria-hidden className={styles.grain} />
      <div aria-hidden className={styles.vignette} />
      {finePointer && !reducedMotion && <Cursor />}

      <DirectorPreloader ready={sceneReady} onDismissStart={handleCut} />
    </div>
  );
}

// Year is computed once at module load (not during render → no purity lint).
const NOW_YEAR = new Date().getFullYear();

/* ── Top/bottom chrome: back link, theme toggle, sound, letterbox, HUD ──── */
function Chrome({
  muted,
  onToggleSound,
  scrubRef,
  tcRef,
  cut,
}: {
  muted: boolean;
  onToggleSound: () => void;
  scrubRef: React.RefObject<HTMLDivElement | null>;
  tcRef: React.RefObject<HTMLSpanElement | null>;
  cut: boolean;
}) {
  return (
    <>
      {/* Top letterbox bar — back link + label + controls */}
      <div
        className={`${styles.letterbox} ${styles.letterboxTop} ${
          cut ? styles.barIn : styles.barOutTop
        }`}
        style={{ pointerEvents: "none" }}
      >
        <Link
          href="/landing-labs"
          className={`${styles.focusable} inline-flex items-center gap-2 no-underline`}
          style={{ pointerEvents: "auto", color: "inherit" }}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          ЛАБОРАТОРИЯ
        </Link>

        <span className="hidden sm:inline">05 — РЕЖИССЁРСКАЯ ВЕРСИЯ</span>

        <span className="flex items-center gap-3" style={{ pointerEvents: "auto" }}>
          <span className="flex items-center gap-2">
            <span className={styles.recDot} aria-hidden />
            <span ref={tcRef} className="tabular-nums">00:00:00</span>
          </span>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={muted ? "Включить звук" : "Выключить звук"}
            aria-pressed={!muted}
            className={`${styles.focusable} inline-flex size-7 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white/50`}
          >
            {muted ? (
              <VolumeX className="size-3.5" aria-hidden />
            ) : (
              <Volume2 className="size-3.5" aria-hidden />
            )}
          </button>
          {/* theme toggle lives in the dark bar; force light-on-dark styling */}
          <span className="text-white">
            <LabThemeToggle className="size-7 border-white/20 text-white hover:border-white/50" />
          </span>
        </span>
      </div>

      {/* Bottom letterbox bar — timeline scrubber + reel meta */}
      <div
        className={`${styles.letterbox} ${styles.letterboxBottom} ${
          cut ? styles.barIn : styles.barOutBottom
        }`}
      >
        <span className="hidden shrink-0 sm:inline">ВЫБЕРИ · ПРИМЕРЬ · ЗАБРОНИРУЙ</span>
        <span className={`${styles.scrub} mx-3 hidden flex-1 sm:block`}>
          <span ref={scrubRef} className={styles.scrubFill} style={{ transform: "scaleX(0)" }} />
        </span>
        <span className="flex-1 sm:hidden">
          <span className={styles.scrub}>
            <span className={styles.scrubFill} style={{ transform: "scaleX(0)" }} />
          </span>
        </span>
        <span className="shrink-0">F136 · 585 · 24FPS</span>
      </div>
    </>
  );
}

/* ── A reveal-by-line helper for the hero headline (framer m) ──────────── */
function RevealLine({
  children,
  show,
  delay,
}: {
  children: React.ReactNode;
  show: boolean;
  delay: number;
}) {
  return (
    <span className="block overflow-hidden">
      <m.span
        className="block"
        initial={{ y: "110%" }}
        animate={show ? { y: "0%" } : {}}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {children}
      </m.span>
    </span>
  );
}

/* ── One narrative act (pinned chapter) ────────────────────────────────── */
function Act({
  no,
  slate,
  title,
  dir,
  lead,
  specs,
  chips,
  frames,
}: {
  no: string;
  slate: string;
  title: string;
  dir: "ltr" | "rtl";
  lead: string;
  specs: { k: string; v: string }[];
  chips?: string[];
  frames?: { t: string; d: string }[];
}) {
  return (
    <section
      className={styles.pin}
      data-act
      data-dir={dir === "rtl" ? "rtl" : "ltr"}
      aria-label={`${no} — ${title}`}
    >
      {/* kinetic background word that drifts on scroll */}
      <span
        data-kinetic
        aria-hidden
        className={`${styles.kinetic} ${styles.outline} pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center opacity-[0.5]`}
        style={dir === "rtl" ? { textAlign: "right" } : { textAlign: "left" }}
      >
        {title}
      </span>

      <div className={`${styles.actInner} relative`}>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p data-fade className={`${styles.kicker} ${styles.fadeUp}`}>
              <span className={styles.kickerLine} />
              {no} · {slate}
            </p>
            <h2 data-fade className={`${styles.fadeUp} ${styles.actTitle} mt-4`}>
              {title}
            </h2>
            <p data-fade className={`${styles.fadeUp} ${styles.lead} mt-7`}>
              {lead}
            </p>

            {chips && (
              <div data-fade className={`${styles.fadeUp} ${styles.reelStrip} mt-8`}>
                {chips.map((c) => (
                  <span key={c} className={styles.chip}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8">
            {frames && (
              <div data-fade className={`${styles.fadeUp} ${styles.hscroll}`}>
                {frames.map((f, i) => (
                  <article key={f.t} className={styles.frameCard}>
                    <span className={`${styles.reel} text-[9px] text-mute`}>
                      КАДР {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className={`${styles.disp} mt-3 text-2xl text-ink`}>{f.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-mute">{f.d}</p>
                  </article>
                ))}
              </div>
            )}

            <dl data-fade className={`${styles.fadeUp} ${styles.specRow}`}>
              {specs.map((s) => (
                <div key={s.v}>
                  <dt className={styles.specK}>{s.k}</dt>
                  <dd className={styles.specV}>{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
