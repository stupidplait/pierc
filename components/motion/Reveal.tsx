"use client";

import { m, useReducedMotion, type Variants, type HTMLMotionProps } from "framer-motion";
import { REVEAL_EASE } from "./entrance";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, ease: REVEAL_EASE },
    },
};

const stagger: Variants = {
    hidden: { opacity: 1 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
};

interface RevealProps extends HTMLMotionProps<"div"> {
    delay?: number;
    amount?: number;
    once?: boolean;
}

export function Reveal({
    children,
    delay = 0,
    amount = 0.25,
    once = true,
    ...rest
}: RevealProps) {
    // Honor prefers-reduced-motion: render statically, like the rest of the
    // public motion primitives (WordReveal, BlurReveal, ValuesRail, …). The
    // global CSS reduced-motion guard only zeroes CSS transitions, not Framer's
    // JS-driven inline styles, so the guard has to live here too.
    const reduce = useReducedMotion();
    if (reduce) {
        return <m.div {...rest}>{children}</m.div>;
    }
    return (
        <m.div
            initial="hidden"
            whileInView="show"
            viewport={{ once, amount }}
            variants={{
                hidden: { opacity: 0, y: 24 },
                show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.65, delay, ease: REVEAL_EASE },
                },
            }}
            {...rest}
        >
            {children}
        </m.div>
    );
}

interface RevealStaggerProps extends HTMLMotionProps<"div"> {
    delay?: number;
    stagger?: number;
    amount?: number;
    once?: boolean;
}

export function RevealStagger({
    children,
    delay = 0.05,
    stagger: staggerChildren = 0.08,
    amount = 0.25,
    once = true,
    ...rest
}: RevealStaggerProps) {
    const reduce = useReducedMotion();
    if (reduce) {
        return <m.div {...rest}>{children}</m.div>;
    }
    return (
        <m.div
            initial="hidden"
            whileInView="show"
            viewport={{ once, amount }}
            variants={{
                hidden: { opacity: 1 },
                show: {
                    opacity: 1,
                    transition: { staggerChildren, delayChildren: delay },
                },
            }}
            {...rest}
        >
            {children}
        </m.div>
    );
}

export const RevealItem = m.div;
export const revealItemVariants = fadeUp;
export { fadeUp, stagger };
