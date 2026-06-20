"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenisGsap } from "@/components/landing-labs/_shared/useLenisGsap";
import { LabChrome } from "@/components/landing-labs/_shared/LabChrome";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import styles from "./ostrie.module.css";
import {
  MARQUEE_BOTTOM,
  MARQUEE_TOP,
  PROCESS_STEPS,
  RAIL_ITEMS,
  STATS,
} from "./data";
import { Cursor } from "./Cursor";

/**
 * «ОСТРИЁ» — brutalist editorial kinetic-typography landing for PIERCERKZN.
 *
 * Client shell: drives Lenis+GSAP via the shared hook, orchestrates the single
 * page-load letter reveal, pins the horizontal jewelry rail (vertical scroll →
 * horizontal track translate, also drag/touch scrollable), and lays out the
 * editorial sections. The only 3D is a small chrome stud in the hero corner,
 * dynamic-imported with { ssr:false } and guarded by useWebGL2Supported().
 */

const StudScene = dynamic(() => import("./StudScene"), { ssr: false });

export function Experience() {
  return <Inner />;
}

function Inner() {
  useLenisGsap();
  const webgl = useWebGL2Supported();

  const scopeRef = useRef<HTMLDivElement>(null);
  const railPinRef = useRef<HTMLDivElement>(null);
  const railTrackRef = useRef<HTMLDivElement>(null);
  const railViewportRef = useRef<HTMLDivElement>(null);
  const railProgressRef = useRef<HTMLDivElement>(null);

  // ── GSAP: page-load reveal + pinned horizontal rail ──────────────────────
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const scope = scopeRef.current;
    if (!scope) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      // 1) Page-load: oversized hero word reveals letter-by-letter from below.
      const heroLetters = gsap.utils.toArray<HTMLElement>(
        `.${styles.letter}`,
      );
      if (!reduce && heroLetters.length) {
        gsap.set(heroLetters, { yPercent: 115 });
        gsap.to(heroLetters, {
          yPercent: 0,
          duration: 1.05,
          ease: "expo.out",
          stagger: 0.045,
          delay: 0.15,
        });
      }

      // Soft entrance for the hero supporting copy + meta.
      if (!reduce) {
        gsap.from(`.${styles.heroReveal}`, {
          opacity: 0,
          y: 24,
          filter: "blur(8px)",
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.08,
          delay: 0.7,
        });
      }

      // 2) Pinned horizontal rail — only on pointer-fine / wide viewports.
      //    On touch / narrow the rail becomes a native horizontal scroller
      //    (see the inline overflow style below), so we skip the pin there.
      const track = railTrackRef.current;
      const pin = railPinRef.current;
      const viewport = railViewportRef.current;
      const progress = railProgressRef.current;
      const canPin =
        !reduce &&
        track &&
        pin &&
        viewport &&
        window.matchMedia("(min-width: 760px)").matches;

      if (canPin) {
        const getScrollDistance = () =>
          Math.max(0, track.scrollWidth - viewport.clientWidth);

        const tween = gsap.to(track, {
          x: () => -getScrollDistance(),
          ease: "none",
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: () => `+=${getScrollDistance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (progress) {
                progress.style.width = `${(self.progress * 100).toFixed(2)}%`;
              }
            },
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      }
    }, scope);

    // After fonts / canvas settle, recompute pin positions.
    const refresh = () => ScrollTrigger.refresh();
    const t = window.setTimeout(refresh, 400);
    if (document.fonts?.ready) {
      document.fonts.ready.then(refresh).catch(() => {});
    }

    return () => {
      window.clearTimeout(t);
      ctx.revert();
    };
  }, []);

  return (
    <main ref={scopeRef} className={`${styles.root} ${styles.displayFont}`}>
      <Cursor />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.baselineGrid} aria-hidden="true" />

      <LabChrome no="01" title="ОСТРИЁ" />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.studCorner} aria-hidden="true">
          {webgl ? <StudScene /> : <div className={styles.studFallback} />}
        </div>

        <div className={`${styles.heroTopRow} ${styles.monoFont}`}>
          <span className={styles.kicker}>PIERCERKZN · Казань</span>
          <span className={styles.kicker}>Студия пирсинга · Скоро открытие</span>
        </div>

        <div className={styles.heroType}>
          <h1 className="sr-only">ОСТРИЁ — студия пирсинга PIERCERKZN в Казани</h1>
          <span className={styles.heroWord} aria-hidden="true">
            <SplitWord word="ОСТРИ" />
            <span className={styles.heroAccentDot}>
              <SplitWord word="Ё" />
            </span>
          </span>
          <span
            className={`${styles.heroWord} ${styles.heroWordShift} ${styles.heroWordOutline}`}
            aria-hidden="true"
          >
            <SplitWord word="ПИРСИНГ" />
          </span>
        </div>

        <div className={styles.heroBottom}>
          <p className={`${styles.heroLede} ${styles.heroReveal}`}>
            Студия пирсинга нового поколения в Казани. Имплантационный титан,
            золото 585 и наша фишка — <em>примерка украшений в 3D</em> до прокола.
          </p>
          <div className={`${styles.heroMeta} ${styles.monoFont} ${styles.heroReveal}`}>
            <span className={styles.heroMetaItem}>
              <span className={styles.heroMetaLabel}>Материал</span>
              <span className={styles.heroMetaValue}>Титан ASTM F136</span>
            </span>
            <span className={styles.heroMetaItem}>
              <span className={styles.heroMetaLabel}>Город</span>
              <span className={styles.heroMetaValue}>Казань 55.79°N</span>
            </span>
            <span className={styles.heroMetaItem}>
              <span className={styles.heroMetaLabel}>Статус</span>
              <span className={styles.heroMetaValue}>Pre-launch ’26</span>
            </span>
          </div>
        </div>

        <span className={`${styles.scrollHint} ${styles.monoFont} ${styles.heroReveal}`}>
          <span className={styles.scrollHintBar} aria-hidden="true" />
          Листай вниз
        </span>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────── */}
      <Marquee words={MARQUEE_TOP} />

      {/* ── HORIZONTAL JEWELRY RAIL (pinned) ─────────────────────────────── */}
      <div ref={railPinRef} className={styles.railPin}>
        <div className={styles.railSticky}>
          <div className={`${styles.railHeader} ${styles.monoFont}`}>
            <span className={styles.sectionNo}>02 / Каталог</span>
            <span className={styles.sectionTag}>
              Тяни вбок · {RAIL_ITEMS.length} позиций
            </span>
          </div>

          <div
            ref={railViewportRef}
            className={styles.railViewport}
            style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
          >
            <div ref={railTrackRef} className={styles.railTrack}>
              {RAIL_ITEMS.map((item) => (
                <Link
                  key={item.no}
                  href="/catalog"
                  data-cursor="magnet"
                  className={styles.railCard}
                  aria-label={`${item.name}, ${item.material}, ${item.gauge}, ${item.size}, ${item.price}`}
                >
                  <div className={styles.railCardTop}>
                    <span className={`${styles.railIndex} ${styles.russoFont}`}>
                      {item.no}
                    </span>
                    <span className={`${styles.railTag} ${styles.monoFont}`}>
                      {item.tag}
                    </span>
                  </div>

                  <div>
                    <span className={styles.railName}>{item.name}</span>
                    <div className={`${styles.railSpecRow} ${styles.monoFont}`}>
                      <span className={styles.railSpec}>{item.material}</span>
                      <span className={styles.railSpec}>{item.gauge}</span>
                      <span className={styles.railSpec}>{item.size}</span>
                    </div>
                  </div>

                  <div className={styles.railCardBottom}>
                    <span className={`${styles.railPrice} ${styles.russoFont}`}>
                      {item.price}
                    </span>
                    <span className={styles.railArrow} aria-hidden="true">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.railProgress} aria-hidden="true">
            <div ref={railProgressRef} className={styles.railProgressBar} />
          </div>
        </div>
      </div>

      {/* ── PROCESS (3 шага) ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.monoFont}`}>
          <span className={styles.sectionNo}>03 / Процесс</span>
          <span className={styles.sectionTag}>Три шага до прокола</span>
        </div>
        <h2 className={styles.sectionTitle}>Как это работает</h2>

        <div className={styles.steps}>
          {PROCESS_STEPS.map((step) => (
            <div key={step.no} className={styles.step}>
              <span className={`${styles.stepNo} ${styles.russoFont}`}>
                {step.no}
              </span>
              <h3 className={styles.stepTitle}>
                {step.title}{" "}
                <span className={styles.stepAccent}>{step.accent}</span>
              </h3>
              <p className={styles.stepBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.monoFont}`}>
          <span className={styles.sectionNo}>04 / Студия</span>
          <span className={styles.sectionTag}>О PIERCERKZN</span>
        </div>

        <div className={styles.aboutGrid}>
          <p className={styles.aboutLead}>
            Мы делаем пирсинг как точную дисциплину — <em>стерильно</em>,
            анатомично и без боли о результате. Каждый прокол спланирован заранее,
            каждое украшение подобрано под твою анатомию в 3D.
          </p>

          <div className={styles.aboutCol}>
            <p className={styles.aboutP}>
              PIERCERKZN — студия пирсинга в Казани. Только имплантационные
              материалы: титан ASTM F136, золото 585, хирургическая сталь.
              Одноразовый инструмент, автоклав, сопровождение всего периода
              заживления.
            </p>
            <p className={styles.aboutP}>
              Прежде чем взять иглу, мы примеряем украшение на 3D-модели — ты
              видишь точную посадку штанги, кольца или лабрета до того, как они
              окажутся на тебе. Технологии на службе у эстетики.
            </p>

            <div className={`${styles.statRow} ${styles.monoFont}`}>
              {STATS.map((s) => (
                <div key={s.label} className={styles.stat}>
                  <span className={`${styles.statNum} ${styles.russoFont}`}>
                    {s.num}
                    {s.accent ? (
                      <span className={styles.statAccent}>{s.accent}</span>
                    ) : null}
                  </span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE (reverse) ────────────────────────────────────────────── */}
      <Marquee words={MARQUEE_BOTTOM} reverse />

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className={styles.cta}>
        <Link href="/book" data-cursor="magnet" className={styles.ctaLink}>
          <span className={styles.ctaWord} aria-hidden="true">
            <CtaWord word="ЗАПИСА" />
            <span className={styles.heroAccentDot}>
              <CtaWord word="ТЬСЯ" />
            </span>
          </span>
          <span className="sr-only">Записаться</span>
        </Link>

        <div className={styles.ctaRow}>
          <p className={styles.ctaSub}>
            Открытие уже скоро. Забронируй первый слот и примерь украшение в 3D
            ещё до прокола.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/book" data-cursor="magnet" className={`${styles.btnPrimary} ${styles.monoFont}`}>
              Записаться
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/catalog" data-cursor="magnet" className={`${styles.btnGhost} ${styles.monoFont}`}>
              Каталог
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className={`${styles.footer} ${styles.monoFont}`}>
          <span>PIERCERKZN © 2026 · Казань</span>
          <span>Острие — Editorial · 01 / 05</span>
        </div>
      </section>
    </main>
  );
}

/** Splits a word into per-letter spans (each wrapped in an overflow:hidden
 *  parent via .heroWord) for the GSAP page-load reveal. Spaces pass through. */
function SplitWord({ word }: { word: string }) {
  return (
    <>
      {Array.from(word).map((ch, i) => (
        <span key={`${ch}-${i}`} className={styles.letter}>
          {ch}
        </span>
      ))}
    </>
  );
}

/** Letters for the CTA word — separate class so the hover-accent transition
 *  applies, while still rendering as inline-blocks for clean stacking. */
function CtaWord({ word }: { word: string }) {
  return (
    <>
      {Array.from(word).map((ch, i) => (
        <span key={`${ch}-${i}`} className={styles.ctaLetter}>
          {ch}
        </span>
      ))}
    </>
  );
}

/** Running marquee strip — the row is duplicated so the -50% keyframe loops
 *  seamlessly. Pauses on hover; static under reduced-motion (CSS). */
function Marquee({ words, reverse = false }: { words: string[]; reverse?: boolean }) {
  const row = (
    <div className={`${styles.marqueeTrack} ${styles.monoFont}`} aria-hidden="true">
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className={styles.marqueeWord}>
          {w}
          <span className={styles.marqueeDot} style={{ marginLeft: "clamp(20px,4vw,56px)" }} />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`${styles.marquee} ${reverse ? styles.marqueeReverse : ""}`}>
      {row}
      {row}
    </div>
  );
}
