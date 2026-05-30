"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

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
    return (
        <motion.div
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
        </motion.div>
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
    return (
        <motion.div
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
        </motion.div>
    );
}

export const RevealItem = motion.div;
export const revealItemVariants = fadeUp;
export { fadeUp, stagger };
