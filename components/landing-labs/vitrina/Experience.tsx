"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { m, useReducedMotion } from "framer-motion";
import { ArrowUpRight, MapPin, Sparkles } from "lucide-react";

import { LabChrome } from "@/components/landing-labs/_shared/LabChrome";
import { useLenisGsap } from "@/components/landing-labs/_shared/useLenisGsap";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { useTheme } from "@/lib/theme/theme-provider";

import styles from "./vitrina.module.css";
import { MagneticButton } from "./MagneticButton";
import { FaqAccordion } from "./FaqAccordion";
import { ChapterRail } from "./ChapterRail";
import {
  CATALOG,
  FEATURED_REVIEW,
  MARQUEE,
  REVIEWS,
  SERVICES,
  STATS,
} from "./content";

// The single live-3D tile — ssr:false (WebGL must not run on the server), lazy
// so the heavy three bundle isn't in the initial payload.
const JewelryTile = dynamic(() => import("./JewelryTile"), {
  ssr: false,
  loading: () => null,
});

/**
 * Experience — the «ВИТРИНА» client shell. A kinetic bento showcase that ships
 * like a real studio site: bento hero → services → catalog rail → reviews →
 * FAQ → final CTA. Drives the custom cursor + tile-sheen via refs (no per-frame
 * React state), wires GSAP scroll reveals through the shared Lenis hook, and
 * keys the WebGL tile on the theme so it re-skins on toggle.
 */
export function Experience() {
  useLenisGsap();
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const webgl = useWebGL2Supported();
  const reduce = useReducedMotion();
  const { theme } = useTheme();

  // ── Custom cursor + tile sheen — pure ref/rAF, no React state ────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let visible = false;

    const tiles = Array.from(
      scopeRef.current?.querySelectorAll<HTMLElement>("[data-tilt]") ?? [],
    );

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        cursor.style.opacity = "1";
        cx = tx;
        cy = ty;
      }
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest(
        "a,button,[data-cursor='link'],[data-tilt]",
      );
      cursor.classList.toggle(styles.cursorActive, !!interactive);

      // Tile sheen: write pointer position into the hovered tile's vars.
      for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        const inside =
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom;
        if (inside) {
          tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
          tile.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
      }
    };

    const onLeave = () => {
      visible = false;
      cursor.style.opacity = "0";
    };

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Load reveal (bento stagger) + scroll-triggered section reveals ───────
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    gsap.registerPlugin(ScrollTrigger);

    if (reduce) {
      // Reduced motion: everything visible, no entrance.
      scope.classList.remove(styles.preload);
      gsap.set("[data-tile], [data-reveal], [data-herosub]", {
        clearProps: "all",
        opacity: 1,
      });
      return;
    }

    const ctx = gsap.context(() => {
      // One orchestrated page-load reveal of the bento tiles.
      gsap.set("[data-tile]", { opacity: 0, y: 26, scale: 0.985 });
      gsap.set("[data-herosub]", { opacity: 0, y: 14 });
      scope.classList.remove(styles.preload);

      const tl = gsap.timeline({ delay: 0.12 });
      tl.to("[data-tile]", {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: "expo.out",
        stagger: { each: 0.07, from: "start" },
      }).to(
        "[data-herosub]",
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.5",
      );

      // Scroll-triggered reveals for the lower sections.
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      reveals.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 82%" },
          },
        );
      });

      // Subtle parallax drift on the brand wordmark as the hero scrolls away.
      gsap.to("[data-parallax]", {
        yPercent: -16,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-parallax]",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // After fonts settle, recompute pin/trigger positions.
      ScrollTrigger.refresh();
    }, scope);

    // Refresh once webfonts have loaded so reveal triggers sit at final layout.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    }

    return () => ctx.revert();
  }, [reduce]);

  return (
    <div
      ref={scopeRef}
      className={`${styles.root} ${styles.preload}`}
      data-vitrina
    >
      {/* atmosphere */}
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.mesh} />
        <div className={styles.gridwash} />
        <div className={styles.grain} />
      </div>

      <div ref={cursorRef} className={styles.cursor} aria-hidden="true" />

      <LabChrome no="04" title="ВИТРИНА" />
      <ChapterRail />

      {/* ════════════ BENTO HERO ════════════ */}
      <section id="vt-hero" className={styles.section + " " + styles.hero}>
        <div className={styles.shell}>
          <div className={styles.bento} data-parallax>
            {/* Brand */}
            <article className={`${styles.tile} ${styles.brandTile}`} data-tile data-tilt>
              <div className={styles.tilePad}>
                <span className={styles.eyebrow}>
                  <span className={styles.eyebrowDot} />
                  Студия пирсинга · Казань · Скоро открытие
                </span>
                <h1 className={`${styles.display} ${styles.wordmark}`}>
                  PIERCER
                  <span className={styles.wordmarkAccent}>KZN</span>
                </h1>
                <p className={styles.heroSub} data-herosub>
                  Прокол иглой, импант-титан и золото 585. Примерьте украшение на
                  себе в 3D ещё до записи — мы открываем витрину, которой можно
                  доверять.
                </p>
              </div>
            </article>

            {/* Live 3D */}
            <article
              className={`${styles.tile} ${styles.threeTile}`}
              data-tile
              data-tilt
            >
              <div className={styles.threeLabel}>
                <span>Живая 3D-витрина</span>
                <span className={styles.mono}>F136</span>
              </div>
              <div className={styles.canvasHost}>
                {webgl === false ? (
                  <ThreeFallback />
                ) : webgl === true ? (
                  // Keying on theme remounts the canvas so drei's <Environment>
                  // re-bakes cleanly with the new --scene-* palette.
                  <JewelryTile key={theme} glbIndex={0} />
                ) : (
                  <div className={styles.threeFallback} />
                )}
              </div>
              <span className={styles.threeBadge}>Кольцо-сегмент · золото 585 · 16G</span>
            </article>

            {/* Stats */}
            <article className={`${styles.tile} ${styles.statsTile}`} data-tile data-tilt>
              <div className={styles.tilePad}>
                <div className={styles.statGrid}>
                  {STATS.map((s) => (
                    <div key={s.label}>
                      <div className={`${styles.display} ${styles.statNum}`}>
                        {s.num}
                      </div>
                      <div className={styles.statLabel}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {/* Marquee */}
            <article
              className={`${styles.tile} ${styles.marqueeTile}`}
              data-tile
              data-tilt
              aria-hidden="true"
            >
              <div className={`${styles.tilePad} ${styles.marqueeTileInner}`}
                style={{ padding: 0 }}>
                <div className={styles.marqueeViewport}>
                  <div className={styles.marqueeTrack}>
                    <Marquee />
                    <Marquee />
                  </div>
                </div>
              </div>
            </article>

            {/* Featured review */}
            <article className={`${styles.tile} ${styles.reviewTile}`} data-tile data-tilt>
              <div className={styles.tilePad}>
                <div className={styles.stars} aria-label="Оценка 5 из 5">
                  ★★★★★
                </div>
                <p className={styles.reviewQuote} style={{ marginTop: 14 }}>
                  «{FEATURED_REVIEW.quote}»
                </p>
                <div className={styles.reviewMeta}>
                  <span className={styles.reviewAvatar} aria-hidden="true">
                    {FEATURED_REVIEW.initials}
                  </span>
                  <span>
                    <strong>{FEATURED_REVIEW.name}</strong>
                    <br />
                    <span className={styles.statLabel} style={{ letterSpacing: "0.06em" }}>
                      {FEATURED_REVIEW.meta}
                    </span>
                  </span>
                </div>
              </div>
            </article>

            {/* Location */}
            <article className={`${styles.tile} ${styles.locationTile}`} data-tile data-tilt>
              <div className={styles.locMap} aria-hidden="true" />
              <span className={styles.locPin} aria-hidden="true" />
              <div className={styles.tilePad} style={{ justifyContent: "flex-end" }}>
                <MapPin size={20} aria-hidden="true" style={{ color: "var(--accent)" }} />
                <div className={styles.serviceName} style={{ marginTop: 10, fontSize: "clamp(16px,1.8vw,22px)" }}>
                  Казань, центр
                </div>
                <div className={styles.railSpec} style={{ marginTop: 4 }}>
                  ул. Профсоюзная · точный адрес на запись
                </div>
              </div>
            </article>

            {/* CTA */}
            <article className={`${styles.tile} ${styles.ctaTile}`} data-tile data-tilt>
              <div className={`${styles.tilePad} ${styles.ctaTileInner}`}>
                <div className={styles.serviceName} style={{ marginTop: 0 }}>
                  Готовы примерить?
                </div>
                <div className={styles.ctaRow}>
                  <MagneticButton href="/book" variant="primary">
                    Записаться <ArrowUpRight size={16} aria-hidden="true" />
                  </MagneticButton>
                  <MagneticButton href="/catalog" variant="ghost">
                    Каталог <Sparkles size={15} aria-hidden="true" />
                  </MagneticButton>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ════════════ SERVICES ════════════ */}
      <section id="vt-services" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} data-reveal>
            <div>
              <div className={styles.sectionKicker}>Виды пирсинга</div>
              <h2 className={`${styles.display} ${styles.sectionTitle}`}>
                Что мы делаем
              </h2>
            </div>
            <p className={styles.heroSub} style={{ marginTop: 0 }}>
              Каждый прокол — иглой, по разметке, в стерильной зоне. Цены
              указаны с украшением из титана.
            </p>
          </div>
          <div className={styles.serviceGrid}>
            {SERVICES.map((s) => (
              <article
                key={s.num}
                className={styles.serviceCard}
                data-reveal
                data-tilt
              >
                <div className={`${styles.mono} ${styles.serviceNum}`}>{s.num}</div>
                <div className={`${styles.display} ${styles.serviceName}`}>
                  {s.name}
                </div>
                <p className={styles.serviceDesc}>{s.desc}</p>
                <div className={styles.serviceMeta}>
                  <span className={styles.mono}>{s.gauge}</span>
                  <span className={styles.servicePrice}>{s.price}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ CATALOG RAIL ════════════ */}
      <section id="vt-catalog" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} data-reveal>
            <div>
              <div className={styles.sectionKicker}>Витрина украшений</div>
              <h2 className={`${styles.display} ${styles.sectionTitle}`}>
                Каталог
              </h2>
            </div>
            <span className={styles.railHint}>← листайте →</span>
          </div>
        </div>
        <div className={styles.shell}>
          <div className={styles.rail} data-reveal role="list" aria-label="Украшения">
            {CATALOG.map((p) => (
              <Link
                key={p.name}
                href="/catalog"
                role="listitem"
                className={styles.railCard}
                data-cursor="link"
              >
                <div className={styles.railThumb}>
                  <span className={styles.railTag}>{p.tag}</span>
                  <span className={styles.railRing} aria-hidden="true" />
                </div>
                <div className={styles.railBody}>
                  <div className={styles.railName}>{p.name}</div>
                  <div className={styles.railSpec}>{p.spec}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ REVIEWS ════════════ */}
      <section id="vt-reviews" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} data-reveal>
            <div>
              <div className={styles.sectionKicker}>Социальное доказательство</div>
              <h2 className={`${styles.display} ${styles.sectionTitle}`}>
                Нам доверяют
              </h2>
            </div>
          </div>
          <div className={styles.serviceGrid}>
            {REVIEWS.map((r) => (
              <article key={r.name} className={styles.serviceCard} data-reveal data-tilt>
                <div className={styles.stars} aria-label="Оценка 5 из 5">
                  ★★★★★
                </div>
                <p className={styles.reviewQuote} style={{ marginTop: 14, fontSize: "clamp(15px,1.4vw,19px)" }}>
                  «{r.quote}»
                </p>
                <div className={styles.reviewMeta}>
                  <span className={styles.reviewAvatar} aria-hidden="true">
                    {r.initials}
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <br />
                    <span className={styles.statLabel} style={{ letterSpacing: "0.06em" }}>
                      {r.meta}
                    </span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ FAQ ════════════ */}
      <section id="vt-faq" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} data-reveal>
            <div>
              <div className={styles.sectionKicker}>Частые вопросы</div>
              <h2 className={`${styles.display} ${styles.sectionTitle}`}>
                Коротко о главном
              </h2>
            </div>
          </div>
          <div data-reveal>
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section id="vt-cta" className={styles.finalCta}>
        <div className={styles.finalGlow} aria-hidden="true" />
        <div className={styles.shell}>
          <m.h2
            className={`${styles.display} ${styles.finalTitle}`}
            initial={reduce ? false : { opacity: 0, filter: "blur(14px)", y: 30 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            ВАШ ВЫХОД
          </m.h2>
          <p className={styles.finalSub}>
            Запишитесь на консультацию — подберём анатомию, металл и размер.
            Или соберите образ в каталоге с 3D-примеркой прямо сейчас.
          </p>
          <div className={styles.finalRow}>
            <MagneticButton href="/book" variant="primary" strength={0.35}>
              Записаться <ArrowUpRight size={16} aria-hidden="true" />
            </MagneticButton>
            <MagneticButton href="/catalog" variant="ghost" strength={0.35}>
              Открыть каталог
            </MagneticButton>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell} style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", width: "100%", padding: 0 }}>
          <span className={styles.mono}>PIERCERKZN © Казань</span>
          <Link
            href="/landing-labs"
            data-cursor="link"
            style={{ color: "inherit", textDecoration: "none", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 11 }}
          >
            ← Лаборатория концептов
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Marquee() {
  return (
    <span className={styles.marqueeItem}>
      {MARQUEE.map((word) => (
        <span key={word} className={styles.marqueeItem}>
          {word}
          <span className={styles.marqueeStar}>✦</span>
        </span>
      ))}
    </span>
  );
}

function ThreeFallback() {
  return (
    <div className={styles.threeFallback}>
      <span className={styles.railRing} style={{ width: "44%" }} aria-hidden="true" />
      <span className="sr-only">3D-витрина недоступна в этом браузере</span>
    </div>
  );
}
