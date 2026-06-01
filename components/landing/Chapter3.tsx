"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { JEWELRY_ITEMS } from "@/components/showcase/JewelryShowcase";
import { SITE } from "@/lib/site";
import { Reveal } from "./Reveal";

/**
 * Chapter 3 — "ЗАБРОНИРУЙ" / Reserve close.
 *
 * Asymmetric climax frame: bottom-left nameplate names the chapter,
 * bottom-right hairline dossier names the visitor's curation, totals
 * the price and ends in the single ceremonial Telegram CTA. The 3D
 * scene (Chapter 2's grid + the floating ЗАБРОНИРУЙ title from
 * Ch3Intro) holds at its final pose; the DOM occupies only the corners
 * so the whole story compresses into one final composition.
 *
 * One doorway, not a form. The website ends in the chat thread.
 *
 * Refinement pass over the initial draft:
 *   - Hairline ticks (·) replaced with numbered indices (01/02/03)
 *     so the dossier reads as instrument-spec inventory, matching the
 *     rolodex's numerical kicker register.
 *   - Items enter staggered (80 ms apart) on first dossier in-view.
 *   - Dossier border brightens to accent on hover (subtle, no lift).
 *   - "Удержание · 72 ч" chip clarifies the hold semantics next to
 *     the total — answers "what does Сумма брони actually mean".
 *   - CTA gets a small leading accent dot reinforcing the doorway
 *     metaphor; arrow still translates on hover.
 *   - Slightly more vertical breathing room (gap-4 between sections,
 *     was gap-[14px]).
 *
 * Layout invariants:
 *   - Section is 100svh; section snap aligns its top with viewport top.
 *   - Nameplate (left) and dossier (right) are absolutely positioned
 *     with bottom anchors so they read together as a two-corner exhibit
 *     HUD even at very tall viewports.
 *   - <=480px collapses to a single stacked column (nameplate above,
 *     dossier below, both centered).
 */

interface Chapter3Props {
    activeJewelry: number;
}

const REVEAL_EASE = [0.22, 0.9, 0.32, 1] as const;

function pickThree(activeIndex: number) {
    const len = JEWELRY_ITEMS.length;
    const i = ((activeIndex % len) + len) % len;
    return [
        JEWELRY_ITEMS[i],
        JEWELRY_ITEMS[(i + 1) % len],
        JEWELRY_ITEMS[(i + 2) % len],
    ];
}

function parsePrice(label: string): number {
    const digits = label.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
}

/**
 * CountUp — local, no CSS module dependency. Ticks 0 → `to` with
 * easeOutExpo when `active` is true. Re-animates when target changes
 * (user picked a different piece in Ch1 then scrolled back to Ch3) so
 * the readout stays truthful; otherwise holds its last value.
 */
function CountUp({
    to,
    active,
    duration = 1800,
}: {
    to: number;
    active: boolean;
    duration?: number;
}) {
    const [value, setValue] = useState(0);
    const playedFor = useRef<number | null>(null);
    const rafRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!active) return;
        if (playedFor.current === to) return;
        playedFor.current = to;

        const start = performance.now();
        const from = value;
        const tick = (now: number) => {
            const elapsed = now - start;
            const p = Math.min(elapsed / duration, 1);
            const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
            setValue(Math.round(from + (to - from) * eased));
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // value intentionally excluded — captured once at start
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, to, duration]);

    return (
        <span className="font-mono tabular-nums tracking-[0.06em]">
            {value.toLocaleString("ru-RU")}
        </span>
    );
}

/* Stagger variants for the item list — each li enters 80 ms after the
   previous, with delayChildren timed to land *after* the dossier's
   own slide-in (0.6 s + 0.2 s lead = 0.8 s into chapter visibility). */
const listVariants: Variants = {
    hidden: { opacity: 1 },
    show: {
        opacity: 1,
        transition: {
            delayChildren: 0.45,
            staggerChildren: 0.09,
        },
    },
};
const itemVariants: Variants = {
    hidden: { opacity: 0, x: -8 },
    show: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.4, ease: REVEAL_EASE },
    },
};

const Chapter3 = forwardRef<HTMLElement, Chapter3Props>(function Chapter3(
    { activeJewelry },
    externalRef,
) {
    const localRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(externalRef, () => localRef.current as HTMLElement);

    const dossierRef = useRef<HTMLDivElement | null>(null);
    const dossierInView = useInView(dossierRef, { amount: 0.4, once: false });

    const items = pickThree(activeJewelry);
    const total = items.reduce((s, it) => s + parsePrice(it.price), 0);

    return (
        <section
            ref={localRef}
            data-surface="light"
            aria-label="Глава 3 — Забронируй"
            className="relative h-[100svh] w-full pointer-events-none"
        >
            {/* Bottom-left nameplate — dark ink on the Ch2 paper plane
                (#e8e5dd) carried over from Chapter 2. text-ink (white)
                from Ch1/Ch2's dark-room sections would render invisible
                here, so this chapter swaps to a #0a0a0a + opacity-tier
                palette. Reads as etched program copy. */}
            <Reveal
                amount={0.3}
                once={false}
                className="pointer-events-auto absolute z-[4]
                           bottom-[clamp(28px,5vh,56px)] left-[clamp(24px,4vw,64px)]
                           flex flex-col items-start gap-2
                           max-w-[clamp(180px,24vw,280px)]
                           max-[480px]:left-1/2 max-[480px]:right-auto max-[480px]:top-[clamp(80px,12vh,140px)] max-[480px]:bottom-auto
                           max-[480px]:-translate-x-1/2 max-[480px]:items-center max-[480px]:text-center max-[480px]:max-w-[min(80vw,320px)]"
            >
                <span className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] leading-tight text-[#0a0a0a]/65">
                    Глава 03
                </span>
                <span aria-hidden className="block w-[22px] h-px bg-[#0a0a0a]/35" />
                <span className="font-display text-[clamp(28px,4vw,44px)] font-extrabold uppercase tracking-[-0.01em] leading-none text-[#0a0a0a]">
                    ЗАБРОНИРУЙ
                </span>
                <span className="font-display text-[clamp(13px,1.3vw,16px)] font-medium leading-snug text-[#0a0a0a]/70">
                    Удержим 72 часа.
                    <br />
                    Оплата в студии.
                </span>
            </Reveal>

            {/* Bottom-right dossier — dark ink on paper. Hairline frame
                brightens to accent on hover. Faint paper-tinted backdrop
                (bg-[#e8e5dd]/40) gives a sheet-on-sheet read so the
                perimeter stays legible even when the body model drifts
                behind it on smaller viewports. */}
            <motion.aside
                ref={dossierRef}
                aria-label="Бронирование"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ amount: 0.3, once: false }}
                transition={{ duration: 0.6, delay: 0.2, ease: REVEAL_EASE }}
                className="group/dossier
                           pointer-events-auto absolute z-[4]
                           bottom-[clamp(28px,5vh,56px)] right-[clamp(24px,4vw,64px)]
                           flex flex-col items-stretch gap-4
                           w-[clamp(280px,30vw,360px)]
                           border border-[#0a0a0a]/[0.18] hover:border-accent/55
                           bg-[#e8e5dd]/40
                           px-[clamp(20px,2vw,28px)] py-[clamp(20px,2vw,26px)]
                           backdrop-blur-[2px]
                           transition-colors duration-500
                           max-[880px]:w-[clamp(240px,40vw,320px)] max-[880px]:px-5 max-[880px]:py-5
                           max-[480px]:left-1/2 max-[480px]:right-auto max-[480px]:bottom-7
                           max-[480px]:-translate-x-1/2 max-[480px]:w-[min(86vw,340px)]"
            >
                {/* Total — animated count-up + 72h hold chip */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-1 font-display text-[clamp(36px,4vw,52px)] font-bold tracking-[-0.01em] leading-none text-[#0a0a0a] tabular-nums max-[880px]:text-[clamp(30px,5vw,40px)]">
                        <CountUp to={total} active={dossierInView} duration={1800} />
                        <span className="text-[0.55em] font-medium text-[#0a0a0a]/65 ml-1">
                            ₽
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-[#0a0a0a]/55">
                            Сумма брони
                        </span>
                        <span aria-hidden className="block h-px w-3 bg-[#0a0a0a]/25" />
                        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-accent">
                            72 ч
                        </span>
                    </div>
                </div>

                <span aria-hidden className="block w-full h-px bg-[#0a0a0a]/[0.15]" />

                {/* Curated set — numbered, staggered entrance */}
                <motion.ul
                    className="list-none m-0 p-0 flex flex-col gap-2.5"
                    variants={listVariants}
                    initial="hidden"
                    animate={dossierInView ? "show" : "hidden"}
                >
                    {items.map((it, idx) => (
                        <motion.li
                            key={it.id}
                            variants={itemVariants}
                            className="grid grid-cols-[20px_1fr_auto] items-baseline gap-x-3"
                        >
                            <span className="font-mono text-[10px] tracking-[0.08em] text-accent tabular-nums leading-none">
                                {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="font-sans text-[12px] font-normal uppercase tracking-[0.04em] leading-tight text-[#0a0a0a] whitespace-nowrap overflow-hidden text-ellipsis">
                                {it.name}
                            </span>
                            <span className="font-mono text-[11px] tracking-[0.1em] text-[#0a0a0a]/65 tabular-nums">
                                {it.price}
                            </span>
                        </motion.li>
                    ))}
                </motion.ul>

                <span aria-hidden className="block w-full h-px bg-[#0a0a0a]/[0.15]" />

                {/* Studio address */}
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 items-baseline">
                    <dt className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-[#0a0a0a]/50 m-0">
                        Студия
                    </dt>
                    <dd className="font-mono text-[11px] tracking-[0.08em] text-[#0a0a0a] m-0">
                        {SITE.address}
                    </dd>
                </dl>

                {/* Single ceremonial CTA — leading accent dot reinforces
                    the doorway metaphor; on hover, text shifts from the
                    bright accent to dark ink. */}
                <a
                    href={SITE.telegram}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group/cta flex items-center justify-between gap-4 mt-1
                               py-3.5 pr-1
                               border-t border-t-accent/55
                               text-accent no-underline
                               transition-colors duration-200
                               hover:text-[#0a0a0a] hover:border-t-accent
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8e5dd]"
                >
                    <span className="flex items-center gap-3">
                        <span
                            aria-hidden
                            className="inline-block w-1.5 h-1.5 rounded-full bg-accent transition-transform duration-200 group-hover/cta:scale-110"
                        />
                        <span className="font-sans text-[clamp(13px,1.2vw,15px)] font-medium uppercase tracking-[0.18em]">
                            Передать в Telegram
                        </span>
                    </span>
                    <span
                        aria-hidden
                        className="font-sans text-[18px] leading-none transition-transform duration-200 ease-[cubic-bezier(0.22,0.9,0.32,1)] group-hover/cta:translate-x-1"
                    >
                        →
                    </span>
                </a>
            </motion.aside>
        </section>
    );
});

export default Chapter3;
