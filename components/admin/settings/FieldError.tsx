"use client";

import { AnimatePresence, m } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FieldError({ id, error }: { id: string; error?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error ? (
        <m.p
          key="error"
          id={id}
          role="alert"
          // Spacing is an animated marginTop (0↔6), NOT padding: with
          // box-sizing:border-box a `height:0` element still floors at its
          // padding height, leaving a sliver that snaps shut. margin has no
          // floor, so the error collapses to truly nothing.
          initial={{ opacity: 0, height: 0, marginTop: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, height: "auto", marginTop: 6, filter: "blur(0px)" }}
          exit={{ opacity: 0, height: 0, marginTop: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.24, ease: EASE }}
          className="overflow-hidden text-xs text-error"
        >
          {error}
        </m.p>
      ) : null}
    </AnimatePresence>
  );
}
