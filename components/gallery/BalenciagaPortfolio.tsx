"use client";

/**
 * BalenciagaPortfolio — drag-driven coverflow.
 *
 *   - Drag horizontally (pointer or touch) to move through the cards; release
 *     hands the strip to a velocity-preserving spring that settles on the
 *     nearest card (a fast flick travels several cards). See useCoverflow for
 *     the motion engine and coverflow-geometry for the ring maths.
 *   - The focused card's name reveals once the spring settles; it hides the
 *     moment a drag actually begins.
 *   - No page-scroll hijacking: vertical scroll/swipe passes through to the
 *     page (touch-action: pan-y), only horizontal drag is captured.
 *
 * Styling is entirely Tailwind utilities; the only CSS that can't be a utility
 * — the `balDeal` entrance keyframe — lives in globals.css alongside the site's
 * other keyframes. State is driven through data attributes the engine writes
 * (`data-dragging/animating/entered` on the section, `data-center` on each
 * card), read here via Tailwind `group`/`group/card` data-variants.
 */

import { useRef } from "react";
import { WordReveal } from "@/components/about/client/WordReveal";
import {
    cardGeom,
    geomTransform,
    ringDelta,
} from "./coverflow-geometry";
import { useCoverflow } from "./useCoverflow";

type Tone = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type Item = { tag: string; meta: string; tone: Tone };

const items: Item[] = [
    { tag: "ХЕЛИКС", meta: "УХО · 2026", tone: "a" },
    { tag: "СЕПТУМ", meta: "НОС · 2026", tone: "b" },
    { tag: "ДЭЙС", meta: "УХО · 2025", tone: "c" },
    { tag: "КОНК", meta: "УХО · 2026", tone: "d" },
    { tag: "ЛАБРЕТ", meta: "ЛИЦО · 2025", tone: "e" },
    { tag: "ИНДАСТРИАЛ", meta: "УХО · 2026", tone: "f" },
    { tag: "РУК", meta: "УХО · 2026", tone: "g" },
    { tag: "ТРАГУС", meta: "УХО · 2025", tone: "h" },
    { tag: "МЕДУЗА", meta: "ЛИЦО · 2026", tone: "a" },
    { tag: "НОЗДРЯ", meta: "НОС · 2025", tone: "c" },
    { tag: "ПУПОК", meta: "ТЕЛО · 2026", tone: "e" },
    { tag: "БРОВЬ", meta: "ЛИЦО · 2026", tone: "g" },
];

// Per-tone portrait fill: a tinted radial bloom over a dark diagonal gradient.
// Applied through the `--tone-bg` custom property the portrait's Tailwind
// `[background:var(--tone-bg)]` class reads — so the data-driven gradients stay
// co-located here in TS instead of needing their own stylesheet. Tones repeat
// across the 12 cards.
const TONE_BG: Record<Tone, string> = {
    a: "radial-gradient(ellipse at 30% 40%, rgba(109, 90, 255, 0.35), transparent 55%), linear-gradient(135deg, #2a2340 0%, #0d0a18 100%)",
    b: "radial-gradient(ellipse at 70% 40%, rgba(255, 126, 229, 0.3), transparent 55%), linear-gradient(140deg, #3a1432 0%, #0a0a0f 100%)",
    c: "radial-gradient(ellipse at 30% 60%, rgba(79, 209, 255, 0.3), transparent 55%), linear-gradient(135deg, #13304a 0%, #06121e 100%)",
    d: "radial-gradient(ellipse at 70% 30%, rgba(232, 198, 119, 0.28), transparent 55%), linear-gradient(140deg, #3a3019 0%, #100d07 100%)",
    e: "radial-gradient(ellipse at 50% 50%, rgba(109, 90, 255, 0.25), transparent 60%), linear-gradient(160deg, #1d1d2a 0%, #07070c 100%)",
    f: "radial-gradient(ellipse at 30% 40%, rgba(79, 209, 255, 0.3), transparent 55%), linear-gradient(145deg, #0f2838 0%, #060c12 100%)",
    g: "radial-gradient(ellipse at 70% 60%, rgba(255, 126, 229, 0.3), transparent 55%), linear-gradient(140deg, #2d1730 0%, #0a0510 100%)",
    h: "radial-gradient(ellipse at 50% 40%, rgba(232, 198, 119, 0.25), transparent 55%), linear-gradient(135deg, #28211a 0%, #0a0804 100%)",
};

const N = items.length;

// --- entrance ("deal") ---------------------------------------------------
// Cards fade + scale into a stack behind the centre, then (no stagger) all
// slide to their resting places in unison. The animation is CSS-driven
// (`balDeal` in globals.css); ENTER_TOTAL_MS only needs to match that duration
// so the name reveal fires once the entrance finishes (KEEP IN SYNC).
const ENTER_TOTAL_MS = 1350;
// Per-ring peek offset (vw) of the initial stack — small, so cards read as
// stacked behind the centre with just their edges showing on both sides.
const STACK_STEP_VW = 2.6;

// SSR / initial inline style for a card at pos=0. Includes the card's final
// transform/opacity (so the first painted frame already equals the resting
// state — no transform-transition slide) PLUS the custom properties the
// `balDeal` entrance keyframe reads to fan each card out from behind the centre.
function initialCardStyle(i: number): React.CSSProperties {
    const d = ringDelta(i, 0, N);
    const abs = Math.abs(d);
    const g = cardGeom(d);
    return {
        transform: geomTransform(g),
        opacity: g.opacity,
        zIndex: g.zIndex,
        // resting (fanned-out) target — read by the balDeal keyframe `to`.
        "--bal-final-x": `${g.x}vw`,
        "--bal-final-scale": g.scale,
        "--bal-final-opacity": g.opacity,
        // initial stacked state — read by the keyframe `0%`/`46%`. Cards bunch
        // behind the centre (small offset, slight shrink) with edges peeking.
        "--bal-stack-x": `${d * STACK_STEP_VW}vw`,
        "--bal-stack-scale": Math.max(0.8, 1 - 0.04 * abs),
        "--bal-stack-opacity": abs > 5.5 ? 0 : 1,
    } as React.CSSProperties;
}

export function BalenciagaPortfolio() {
    const sectionRef = useRef<HTMLElement>(null);
    const pinRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

    const { settled, active } = useCoverflow({
        sectionRef,
        pinRef,
        cardsRef,
        count: N,
        enterMs: ENTER_TOTAL_MS,
    });

    const settledItem = settled !== null ? items[settled] : null;
    // id of the listbox's active option (the card AT should announce), or
    // undefined during the entrance deal when nothing is active yet.
    const activeDescendant = active === null ? undefined : `bal-opt-${active}`;

    return (
        // `group` exposes the engine's data attributes to the children's
        // `group-data-*` variants; `h-svh` keeps the stage inside the small
        // viewport so mobile browser chrome never clips the cards.
        <section
            ref={sectionRef}
            className="group relative isolate h-svh overflow-hidden bg-bg"
            // <section> with an accessible name already exposes role="region"
            // implicitly, so an explicit role here is redundant. The
            // roledescription still applies and relabels it as a carousel.
            aria-roledescription="карусель"
            aria-label="Галерея работ студии"
        >
            {/* Gesture surface + keyboard host. The engine binds the drag
             * pointer handlers and Arrow/Home/End here; key events bubble up
             * from the focused listbox below, so this stays a plain div (not a
             * second tab stop). */}
            <div
                ref={pinRef}
                className="relative h-full cursor-grab touch-pan-y select-none overflow-hidden group-data-[dragging=1]:cursor-grabbing"
            >
                {/* Framing grid behind the cards — the same 64px cream grid as
                 * the auth backdrop, but vignette-masked OUT of the central
                 * focal pool and visible toward the edges so it frames the
                 * coverflow. Decorative + non-interactive, below every card. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 [background-image:linear-gradient(to_right,rgba(239,231,216,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(239,231,216,0.08)_1px,transparent_1px)] [background-size:64px_64px] [background-position:center] [-webkit-mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)] [mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)]"
                />
                {/* The cards container IS the listbox: a horizontal, single-
                 * select set of options the user arrows / drags through. A
                 * plain <div> (not <ul>) carries the role so there's no implicit
                 * `list` semantics to override — the same approach Radix/Headless
                 * UI take. tabIndex makes it the single keyboard stop;
                 * aria-activedescendant names the active option. */}
                <div
                    className="absolute inset-0 m-0 list-none p-0 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
                    // No native HTML element represents a listbox/coverflow
                    // widget, so the role is required (project ESLint accepts
                    // it). react-doctor's prefer-tag-over-role can't apply here.
                    // react-doctor-disable-next-line react-doctor/prefer-tag-over-role
                    role="listbox"
                    aria-label="Работы студии"
                    aria-orientation="horizontal"
                    aria-activedescendant={activeDescendant}
                    tabIndex={0}
                >
                    {items.map((it, i) => (
                        // Invisible 100vw spacing container. The engine writes
                        // transform/opacity/z-index here every frame; the CSS
                        // transition eases idle moves and is dropped (via
                        // `group-data-[animating=1]`) while the rAF loop drives
                        // motion. `group/card` exposes this card's `data-center`
                        // to the portrait's variants below.
                        <div
                            key={it.tag}
                            ref={(el) => {
                                cardsRef.current[i] = el;
                            }}
                            id={`bal-opt-${i}`}
                            // No native element represents a listbox option, so
                            // the role is required.
                            // react-doctor-disable-next-line react-doctor/prefer-tag-over-role
                            role="option"
                            // Dynamic per-selection (renders explicit
                            // true/false). Some editor jsx-a11y builds flag any
                            // non-literal aria-selected as "invalid value" — a
                            // false positive; the project's own ESLint
                            // (next/core-web-vitals) + tsc accept it.
                            aria-selected={active === i}
                            // Cards are gradient placeholders with no text, so
                            // give each option a spoken name: "<tag>, <meta>".
                            aria-label={`${it.tag}, ${it.meta.replace(" · ", ", ")}`}
                            className="group/card pointer-events-none absolute left-1/2 top-1/2 m-0 h-[min(82svh,55vw)] w-screen origin-center animate-[balDeal_1350ms_cubic-bezier(0.22,0.9,0.32,1)_backwards] [transition:transform_0.65s_cubic-bezier(0.22,0.9,0.5,1),opacity_0.45s_cubic-bezier(0.22,0.9,0.5,1)] [will-change:transform,opacity] group-data-[animating=1]:[transition:none] group-data-[entered=1]:animate-none data-[center=1]:pointer-events-auto"
                            // `data-center` (focus scale-up) is seeded from
                            // `settled`, which starts null — so no card is active
                            // during the entrance deal; card 0 lights up with its
                            // name once the cards unstack. `style` seeds the
                            // pos=0 layout (SSR/renderer agree) + the custom props
                            // the balDeal entrance keyframe fans out from.
                            data-center={settled === i ? "1" : "0"}
                            style={initialCardStyle(i)}
                        >
                            {/* Narrow tall portrait (2:3). Tinted via --tone-bg;
                             * the focused card (group-data-[center]/card) brightens
                             * and grows. Capped to one size on phones/tablets so
                             * neighbours don't run off-screen. */}
                            <div
                                className="absolute left-1/2 top-1/2 aspect-[2/3] w-[clamp(220px,23vw,340px)] overflow-hidden rounded-2xl [background:var(--tone-bg)] [filter:brightness(0.62)_saturate(0.88)] [transform:translate(-50%,-50%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.6),0_10px_30px_-12px_rgba(0,0,0,0.55)] [transition:width_0.55s_cubic-bezier(0.22,0.9,0.5,1),filter_0.45s_ease,transform_0.36s_cubic-bezier(0.22,0.9,0.5,1),box-shadow_0.36s_ease] after:pointer-events-none after:absolute after:inset-0 after:[background:radial-gradient(circle_at_50%_45%,transparent_45%,rgba(0,0,0,0.55)_100%)] after:content-[''] group-data-[center=1]/card:w-[clamp(280px,30vw,440px)] group-data-[center=1]/card:[filter:brightness(1)_saturate(1)] max-[820px]:w-[min(64vw,360px)]"
                                style={
                                    { "--tone-bg": TONE_BG[it.tone] } as React.CSSProperties
                                }
                            />
                        </div>
                    ))}
                </div>
                {/* Centered display name for the settled card. Keyed on the
                 * settled index so it remounts — and so WordReveal replays its
                 * letter-by-letter reveal — each time a new card settles. Absent
                 * while dragging/settling (settled === null). aria-hidden: the
                 * active option's aria-label is the canonical announcement. The
                 * name floor scales down under 480px so the longest tags stay
                 * inside the screen (white-space: nowrap). */}
                {settledItem && (
                    <div
                        className="pointer-events-none absolute inset-0 z-[200] grid place-items-center"
                        aria-hidden="true"
                    >
                        <WordReveal
                            key={settled}
                            text={settledItem.tag}
                            as="span"
                            splitBy="char"
                            stagger={0.05}
                            className="select-none whitespace-nowrap text-center text-[length:clamp(64px,9.5vw,170px)] font-semibold uppercase leading-[0.95] tracking-[-0.02em] text-white mix-blend-difference [font-family:'Helvetica_Neue',Arial,sans-serif] max-[480px]:text-[length:clamp(40px,12vw,88px)]"
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
