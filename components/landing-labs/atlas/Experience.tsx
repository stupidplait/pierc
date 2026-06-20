"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import { LabChrome } from "@/components/landing-labs/_shared/LabChrome";
import { useLenisGsap } from "@/components/landing-labs/_shared/useLenisGsap";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { subscribeScroll } from "@/lib/hooks/useScrollBus";
import {
  ATLAS_STATS,
  ATLAS_ZONES,
  CARE_PROTOCOL,
  formatPrice,
  type AtlasZone,
} from "./atlas-data";
import { AtlasCursor } from "./AtlasCursor";
import styles from "./atlas.module.css";

// 3D scenes — own components, dynamic-imported ssr:false (no canvas on server).
const AtlasScene = dynamic(
  () => import("./AtlasScene").then((m) => m.AtlasScene),
  { ssr: false },
);
const JewelryViewer = dynamic(
  () => import("./JewelryViewer").then((m) => m.JewelryViewer),
  { ssr: false },
);

/**
 * АТЛАС ТЕЛА — clinical / precision-instrument landing for PIERCERKZN.
 *
 * Aesthetic: a medical atlas plate. The hero opens the plate; the centrepiece
 * is an interactive 3D head atlas with hotspots at the real piercing zones; the
 * deep-dive panel swaps in the matching real GLB spinning in a specimen viewer
 * with material/gauge/price spec; an aftercare protocol grid; and a final CTA.
 */
export function Experience() {
  useLenisGsap();
  const webgl = useWebGL2Supported();

  const rootRef = useRef<HTMLDivElement>(null);

  // Selected + hovered atlas zone. Set only from event handlers (allowed by the
  // strict set-state-in-effect lint — never written during render or in effect).
  const [selectedId, setSelectedId] = useState<string>(ATLAS_ZONES[0].id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const zone: AtlasZone =
    ATLAS_ZONES.find((z) => z.id === selectedId) ?? ATLAS_ZONES[0];

  // Scroll progress through the atlas section → ref (no state) so the 3D rig can
  // read it each frame without re-rendering React.
  const atlasScrollRef = useRef(0);
  const atlasSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeScroll(() => {
      const el = atlasSectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the section top hits the viewport bottom, 1 when its bottom
      // leaves the top — a stable normalised progress across the section.
      const total = r.height + vh;
      const p = (vh - r.top) / total;
      atlasScrollRef.current = Math.min(1, Math.max(0, p));
    });
    return unsub;
  }, []);

  // GSAP scroll-triggered reveals on the section plates + care cells. Scoped to
  // the root and fully reverted on cleanup. Honours reduced motion.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 28,
          filter: "blur(8px)",
          duration: 0.7,
          ease: "expo.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal-stagger] > *").forEach(
        (el, i) => {
          gsap.from(el, {
            opacity: 0,
            y: 24,
            duration: 0.6,
            ease: "expo.out",
            delay: (i % 4) * 0.06,
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        },
      );
    }, rootRef);

    // Recompute pin/trigger positions once images/fonts/canvas have settled.
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => {
      window.clearTimeout(t);
      ctx.revert();
    };
  }, []);

  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const onHover = useCallback((id: string | null) => setHoveredId(id), []);

  const liveId = hoveredId ?? selectedId;
  const liveZone = ATLAS_ZONES.find((z) => z.id === liveId) ?? zone;

  return (
    <div ref={rootRef} className={`${styles.root} ${styles.display}`}>
      <AtlasCursor />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.gridField} aria-hidden="true" />

      <LabChrome no="03" title="АТЛАС ТЕЛА" />

      <div className={styles.content}>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <header className={`${styles.section} ${styles.hero}`}>
          <div className={`${styles.heroTop} ${styles.mono}`}>
            <span>PIERCERKZN · Казань</span>
            <span>Атлас · Plate 03</span>
            <span className="hidden sm:inline">Скоро открытие</span>
          </div>

          <div className={styles.heroMid}>
            <span className={`${styles.kicker} ${styles.mono}`}>
              Анатомия пирсинга
            </span>
            <h1 className={styles.heroTitle} data-reveal>
              <span>Атлас</span>
              <span className={styles.heroTitleOutline}>тела</span>
            </h1>
            <p className={styles.heroLead} data-reveal>
              Девять точек. Каждая — со своей анатомией, калибром и сроком
              заживления. Наведи на зону, изучи реальное украшение в 3D и примерь
              его до прокола. Имплант-титан ASTM F136 и золото 585.
            </p>
          </div>

          <div className={styles.heroBottom}>
            <div className={`${styles.statRow} ${styles.mono}`}>
              {ATLAS_STATS.map((s) => (
                <div key={s.label} className={styles.stat}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
            <span className={`${styles.scrollHint} ${styles.mono}`}>
              <b aria-hidden="true" />
              Листай к атласу
            </span>
          </div>
        </header>

        {/* ── ATLAS (centerpiece) ───────────────────────────────────── */}
        <section className={styles.section} ref={atlasSectionRef}>
          <div className={`${styles.plate} ${styles.mono}`} data-reveal>
            <span className={styles.plateNo}>Ø1 / Интерактивный атлас</span>
            <span className={styles.plateTitle}>Наведи · выбери · примерь</span>
          </div>

          <div className={styles.atlasWrap} data-reveal>
            <div className={styles.atlasStage}>
              <div className={styles.canvasCol}>
                <span className={styles.cropMark + " " + styles.cropTL} aria-hidden="true" />
                <span className={styles.cropMark + " " + styles.cropTR} aria-hidden="true" />
                <span className={styles.cropMark + " " + styles.cropBL} aria-hidden="true" />
                <span className={styles.cropMark + " " + styles.cropBR} aria-hidden="true" />
                <p className={`${styles.stageReadout} ${styles.mono}`}>
                  Fig. <b>{liveZone.no}</b> · {liveZone.latin}
                </p>

                <div className={styles.canvasMount}>
                  {webgl === false ? (
                    <AtlasFallback />
                  ) : webgl ? (
                    <AtlasScene
                      selectedId={selectedId}
                      hoveredId={hoveredId}
                      onSelect={onSelect}
                      onHover={onHover}
                      scrollRef={atlasScrollRef}
                    />
                  ) : null}
                </div>
              </div>

              {/* Deep-dive readout panel */}
              <aside className={styles.panel} aria-live="polite">
                <div className={styles.panelHead}>
                  <span className={`${styles.panelNo} ${styles.mono}`}>
                    {zone.no}
                  </span>
                  <span className={styles.panelName}>
                    <span className={styles.panelTitle}>{zone.name}</span>
                    <span className={`${styles.panelLatin} ${styles.mono}`}>
                      {zone.latin}
                    </span>
                  </span>
                </div>

                <div className={styles.panelViewer}>
                  <div className={styles.viewerMount}>
                    {webgl ? (
                      <JewelryViewer key={zone.glb} url={zone.glb} />
                    ) : null}
                  </div>
                  <span className={`${styles.viewerTag} ${styles.mono}`}>
                    Образец · 3D
                  </span>
                </div>

                <p className={styles.panelBody}>{zone.body}</p>

                <div className={`${styles.specGrid} ${styles.mono}`}>
                  <div className={styles.specCell}>
                    <div className={styles.specKey}>Материал</div>
                    <div className={styles.specVal}>{zone.material}</div>
                  </div>
                  <div className={styles.specCell}>
                    <div className={styles.specKey}>Калибр</div>
                    <div className={styles.specVal}>{zone.gauge}</div>
                  </div>
                  <div className={styles.specCell}>
                    <div className={styles.specKey}>Размер</div>
                    <div className={styles.specVal}>{zone.size}</div>
                  </div>
                  <div className={styles.specCell}>
                    <div className={styles.specKey}>Заживление</div>
                    <div className={styles.specVal}>{zone.healing}</div>
                  </div>
                </div>

                <div className={styles.panelFoot}>
                  <span>
                    <span className={`${styles.priceLabel} ${styles.mono}`}>
                      от
                    </span>
                    <br />
                    <span className={`${styles.price} ${styles.mono}`}>
                      {formatPrice(zone.price)}
                    </span>
                  </span>
                  <Link href="/catalog" className={styles.btnGhost}>
                    Каталог
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </aside>
            </div>

            {/* Zone index rail — keyboard-accessible alternative to the 3D
                hotspots, and the touch control on mobile. */}
            <div className={`${styles.zoneRail} ${styles.mono}`} role="tablist" aria-label="Зоны атласа">
              {ATLAS_ZONES.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedId === z.id}
                  className={`${styles.zoneBtn} ${
                    selectedId === z.id ? styles.zoneBtnActive : ""
                  }`}
                  onClick={() => onSelect(z.id)}
                  onPointerEnter={() => onHover(z.id)}
                  onPointerLeave={() => onHover(null)}
                >
                  <span className={styles.zoneBtnNo}>{z.no}</span>
                  <span className={styles.zoneBtnName}>{z.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── CARE / PROCESS ────────────────────────────────────────── */}
        <section className={styles.section} style={{ marginTop: "clamp(56px,10vh,140px)" }}>
          <div className={`${styles.plate} ${styles.mono}`} data-reveal>
            <span className={styles.plateNo}>Ø2 / Протокол ухода</span>
            <span className={styles.plateTitle}>Стерильно · спокойно · под контролем</span>
          </div>

          <div className={styles.careGrid} data-reveal-stagger>
            {CARE_PROTOCOL.map((c) => (
              <article key={c.no} className={styles.careCell}>
                <span className={`${styles.careNo} ${styles.mono}`}>{c.no}</span>
                <h3 className={styles.careTitle}>{c.title}</h3>
                <p className={styles.careDetail}>{c.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.cta}>
            <p className={`${styles.kicker} ${styles.mono}`} style={{ justifyContent: "center" }} data-reveal>
              Запись открыта
            </p>
            <h2 className={styles.ctaTitle} data-reveal>
              Записаться
            </h2>
            <p className={styles.ctaSub} data-reveal>
              Подберём точку, калибр и украшение под твою анатомию. Прокол
              стерильной иглой, имплант-титан в подарок к заживлению.
            </p>
            <div className={styles.ctaRow} data-reveal>
              <Link href="/book" className={styles.btnPrimary}>
                Записаться
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/catalog" className={styles.btnGhost}>
                Смотреть каталог
              </Link>
            </div>
          </div>

          <footer className={`${styles.footer} ${styles.mono}`}>
            <span>PIERCERKZN · Казань · 2026</span>
            <Link
              href="/landing-labs"
              className={styles.footer}
              style={{ padding: 0 }}
            >
              ← Лаборатория лендингов
            </Link>
          </footer>
        </section>
      </div>
    </div>
  );
}

/** Branded static fallback when WebGL2 is unavailable. */
function AtlasFallback() {
  return (
    <div className={styles.fallback}>
      <div className={styles.fallbackMark} aria-hidden="true" />
      <p className={`${styles.fallbackText} ${styles.mono}`}>
        Интерактивный 3D-атлас недоступен в этом браузере. Выбери зону в списке
        ниже — описание, материал и цена доступны полностью.
      </p>
    </div>
  );
}
