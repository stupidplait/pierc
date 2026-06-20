"use client";

/**
 * GalleryCoverflow — drag-driven coverflow.
 *
 *   - Drag horizontally (pointer or touch) to move through the cards; release
 *     hands the strip to a velocity-preserving spring that settles on the
 *     nearest card (a fast flick travels several cards). See useCoverflow for
 *     the motion engine and coverflow-geometry for the ring maths.
 *   - Each card carries its own name, attached inside its spacer (so it rides the
 *     card). Only the active card's name shows: it streams in via WordReveal on
 *     settle and fades + lifts out when the card stops being active. The focused
 *     card's portrait also grows once the spring settles (data-center).
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
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { WordReveal } from "@/components/motion/WordReveal";
import { ru } from "@/lib/i18n/ru";
import type { PublicGalleryPhoto } from "@/lib/public/queries";
import {
    cardGeom,
    geomTransform,
    ringDelta,
} from "./coverflow-geometry";
import { useCoverflow } from "./useCoverflow";

// Shared easing for the per-card name (and its blend plate) show/hide.
const NAME_EASE: [number, number, number, number] = [0.22, 0.9, 0.32, 1];

// --- entrance ("deal") ---------------------------------------------------
// Cards fade + scale into a stack behind the centre, then (no stagger) all
// slide to their resting places in unison. The animation is CSS-driven
// (`balDeal` in globals.css); ENTER_TOTAL_MS only needs to match that duration
// so the name reveal fires once the entrance finishes (KEEP IN SYNC).
const ENTER_TOTAL_MS = 1350;
// Per-ring peek offset (vw) of the initial stack — small, so cards read as
// stacked behind the centre with just their edges showing on both sides.
const STACK_STEP_VW = 2.6;

// Shared display-type for the per-card name: everything that fixes the glyph
// metrics (size, family, weight, tracking, case, single line) EXCEPT line-height.
// Used by both the visible blended caption and the invisible blend plate painted
// behind it (see the card body), so the plate's box always tracks the caption's.
const CAPTION_TYPE =
    "select-none whitespace-nowrap text-center font-normal uppercase tracking-[-0.01em] [font-family:'Helvetica_Neue',Arial,sans-serif] text-[length:clamp(72px,13vw,220px)] max-[480px]:text-[length:clamp(44px,15vw,96px)]";

// SSR / initial inline style for a card at pos=0. Includes the card's final
// transform/opacity (so the first painted frame already equals the resting
// state — no transform-transition slide) PLUS the custom properties the
// `balDeal` entrance keyframe reads to fan each card out from behind the centre.
//
// INVARIANT: this MUST stay constant per (i, n). The engine (useCoverflow) owns
// transform/opacity/zIndex at runtime via imperative writes; React only diffs
// this object against its OWN previous render, so as long as the value never
// changes React never patches it and never fights the engine. If you ever make
// it depend on settled/active/pos, React will reconcile transform back to pos=0
// on the next re-render and clobber the live coverflow — drive runtime layout
// through the engine instead.
function initialCardStyle(i: number, n: number): React.CSSProperties {
    const d = ringDelta(i, 0, n);
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

export function GalleryCoverflow({ photos }: { photos: PublicGalleryPhoto[] }) {
    const sectionRef = useRef<HTMLElement>(null);
    const pinRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

    const N = photos.length;

    // Hooks must run unconditionally; with no photos the engine's effect early-
    // returns (the coverflow section — and its refs — aren't mounted below).
    const { settled, active, revealNonce, revealInstant } = useCoverflow({
        sectionRef,
        pinRef,
        cardsRef,
        count: N,
        enterMs: ENTER_TOTAL_MS,
    });
    const reduce = useReducedMotion();

    // Active-name show duration: 0 on a FRESH landing (let the WordReveal glyph
    // stream be the entrance), a brief ease-in when the name RETURNS to a card it
    // already revealed — e.g. dragging the active card away and back. The engine
    // owns the fresh-vs-return distinction and exposes it as `revealInstant`.
    const revealDur = revealInstant ? 0 : 0.3;

    // Show/hide motion shared by the name AND its blend plate, so the plate (the
    // name's blend backdrop) tracks it in perfect lockstep and — crucially — is
    // invisible whenever the name is. That keeps the opaque plate from covering
    // neighbouring cards while they're stacked together during the entrance deal
    // (settled is null then, so every plate is at opacity 0).
    const captionMotion = (active: boolean) => ({
        initial: false as const,
        animate: active
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: -12, scale: 0.96 },
        transition: {
            duration: reduce ? 0 : active ? revealDur : 0.4,
            ease: NAME_EASE,
        },
    });

    // Nothing published yet — show a quiet placeholder instead of an empty
    // ring. The admin gallery board is the source of these photos.
    if (N === 0) {
        return (
            <section
                className="grid h-svh place-items-center overflow-hidden bg-bg px-6 text-center"
                aria-label={ru.pages.gallery.sectionLabel}
            >
                <div className="max-w-md">
                    <h1 className="text-[clamp(48px,8vw,96px)] font-semibold uppercase leading-[0.95] tracking-[-0.02em] text-scene-ink [font-family:'Helvetica_Neue',Arial,sans-serif]">
                        {ru.pages.gallery.title}
                    </h1>
                    <p className="mt-4 text-sm uppercase tracking-[0.18em] text-ink-muted">
                        {ru.pages.gallery.stub}
                    </p>
                </div>
            </section>
        );
    }

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
            aria-roledescription={ru.pages.gallery.carousel}
            aria-label={ru.pages.gallery.sectionLabel}
        >
            {/* Visually-hidden page heading — the populated coverflow's only
             * display type is the per-card name (decorative, aria-hidden), so
             * this gives the page a real <h1> for the heading outline + SEO. */}
            <h1 className="sr-only">{ru.pages.gallery.title}</h1>
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
                    className="pointer-events-none absolute inset-0 z-0 [background-image:linear-gradient(to_right,var(--backdrop-grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--backdrop-grid)_1px,transparent_1px)] [background-size:64px_64px] [background-position:center] [-webkit-mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)] [mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)]"
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
                    aria-label={ru.pages.gallery.listLabel}
                    aria-orientation="horizontal"
                    aria-activedescendant={activeDescendant}
                    tabIndex={0}
                >
                    {photos.map((photo, i) => (
                        // Invisible 100vw spacing container. The engine writes
                        // transform/opacity/z-index here every frame; the CSS
                        // transition eases idle moves and is dropped (via
                        // `group-data-[animating=1]`) while the rAF loop drives
                        // motion. `group/card` exposes this card's `data-center`
                        // to the portrait's variants below.
                        <div
                            key={photo.id}
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
                            // Spoken name for the option: the photo's caption, or
                            // a positional fallback when it has none.
                            aria-label={
                                photo.caption?.trim() ||
                                ru.pages.gallery.workFallback
                                    .replace("{n}", String(i + 1))
                                    .replace("{m}", String(N))
                            }
                            className="group/card pointer-events-none absolute left-1/2 top-1/2 m-0 h-[min(82svh,55vw)] w-screen origin-center animate-[balDeal_1350ms_cubic-bezier(0.22,0.9,0.32,1)_backwards] [transition:transform_0.65s_cubic-bezier(0.22,0.9,0.5,1),opacity_0.45s_cubic-bezier(0.22,0.9,0.5,1)] [will-change:transform,opacity] group-data-[animating=1]:[transition:none] group-data-[entered=1]:animate-none data-[center=1]:pointer-events-auto"
                            // `data-center` (focus portrait scale-up) is seeded
                            // from `settled`, which starts null — so no card is
                            // focused during the entrance deal; card 0's portrait
                            // grows once the cards unstack. `style` seeds the pos=0
                            // layout (SSR/renderer agree) + the custom props the
                            // balDeal entrance keyframe fans out from.
                            data-center={settled === i ? "1" : "0"}
                            style={initialCardStyle(i, N)}
                        >
                            {/* Blend plate — a page-bg copy of the caption box,
                             * painted BELOW the photo and the name. The engine's
                             * per-card transform isolates mix-blend-difference into
                             * this card's stacking context, so the name can only
                             * invert against what's painted below it HERE: the photo
                             * covers the centre, but the giant name overhangs past
                             * the photo, and beyond it there was no backdrop — so the
                             * overhang rendered flat white (invisible on a light
                             * page). This invisible page-coloured plate is that
                             * missing backdrop: the overhang inverts to ink against
                             * it, while the opaque photo still wins over the centre.
                             * Theme-aware via --bg (dark page = unchanged). It rides
                             * the SAME captionMotion as the name, so it's opaque only
                             * while the name is — present right when the overhang needs
                             * a backdrop (incl. through the fade in/out), yet at
                             * opacity 0 during the entrance deal so it never covers the
                             * other cards while they're stacked together. */}
                            {photo.caption?.trim() && (
                                <m.div
                                    aria-hidden
                                    {...captionMotion(settled === i)}
                                    className="pointer-events-none absolute inset-0 grid place-items-center"
                                >
                                    <span
                                        className={`${CAPTION_TYPE} inline-block bg-bg px-[0.12em] leading-[1.15] text-transparent`}
                                    >
                                        {photo.caption.trim()}
                                    </span>
                                </m.div>
                            )}
                            {/* Narrow tall portrait (2:3). The photo fills it
                             * (object-cover) over a theme-aware `bg-bg-elev` backing
                             * — a light card surface on the light studio (was a dark
                             * gradient, whose near-black edge bled a stray dark
                             * outline around every white-backed photo on white). The
                             * neutral backing shows only while the image loads or
                             * behind any letterboxing. All cards render at full
                             * brightness (no dimming) — the focused card is
                             * distinguished by size alone (it grows on center).
                             * Capped to one size on phones/tablets so neighbours
                             * don't run off-screen. */}
                            <div
                                className="absolute left-1/2 top-1/2 aspect-[2/3] w-[clamp(240px,28vw,380px)] overflow-hidden rounded-2xl bg-bg-elev [transform:translate(-50%,-50%)] shadow-[0_30px_80px_-24px_var(--shadow-3),0_8px_24px_-12px_var(--shadow-2)] [transition:width_0.55s_cubic-bezier(0.22,0.9,0.5,1),transform_0.36s_cubic-bezier(0.22,0.9,0.5,1),box-shadow_0.36s_ease] group-data-[center=1]/card:w-[clamp(320px,40vw,520px)] max-[820px]:w-[min(70vw,400px)]"
                            >
                                {/* decorative: the option's aria-label already
                                 * names the work, so the img stays alt="". The
                                 * first few cards load eagerly (they're the
                                 * focal pool on open); the rest lazy-load.
                                 * draggable=false so the native image-drag ghost
                                 * never fights the coverflow's pointer drag. */}
                                <Image
                                    src={photo.url}
                                    alt=""
                                    fill
                                    draggable={false}
                                    preload={i === 0}
                                    sizes="(max-width: 820px) 64vw, 30vw"
                                    className="object-cover"
                                />
                            </div>
                            {/* The card's name, attached inside this engine-driven
                             * spacer so it rides/scales with the card. Always mounted
                             * (when the photo has a caption) but only VISIBLE while
                             * this card is the active (settled) one — driven by
                             * `animate` (NOT AnimatePresence, whose exit lagged ~600ms
                             * behind settled → null here): `animate` reads `settled`
                             * live. On a FRESH landing it snaps in (duration 0) while
                             * WordReveal streams the glyphs; when the name merely
                             * RETURNS to a card it already revealed (drag away + back,
                             * no re-stream) it eases back in over `revealDur`. Losing
                             * active fades + lifts it out over 0.4s. Because it lives in
                             * the spacer, that hide plays while the name rides the
                             * leaving card. WordReveal is keyed on the engine's
                             * `revealNonce` (bumped only when the active card CHANGES)
                             * so the reveal REPLAYS on a new card, never remounts on
                             * settled → null or a same-card return — so the glyphs stay
                             * put while it fades or eases back. mix-blend-difference
                             * inverts it over its own photo AND, beyond the photo,
                             * over the page-bg plate behind it (the spacer's transform
                             * isolates the blend per card, so that plate is the only
                             * backdrop the overhang can invert against); grid-centering frees the
                             * transform for framer's y/scale; blur={false} keeps the
                             * glyphs filter-free so the blend survives. Decorative —
                             * the option's aria-label names the work. */}
                            {photo.caption?.trim() && (
                                <m.div
                                    aria-hidden="true"
                                    {...captionMotion(settled === i)}
                                    className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-white mix-blend-difference"
                                >
                                    <WordReveal
                                        key={revealNonce}
                                        text={photo.caption.trim()}
                                        as="span"
                                        splitBy="char"
                                        stagger={0.03}
                                        blur={false}
                                        className={`${CAPTION_TYPE} leading-[0.92]`}
                                    />
                                </m.div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
