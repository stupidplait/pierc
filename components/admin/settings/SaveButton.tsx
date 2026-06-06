"use client";

import { AnimatePresence, m } from "framer-motion";
import { Loader2, Save } from "lucide-react";
import { buttonVariants } from "@/components/shadcn/ui/button";

const EASE = [0.16, 1, 0.3, 1] as const;

interface SaveButtonProps {
  pending: boolean;
  disabled?: boolean;
  label: string;
  pendingLabel: string;
}

/**
 * Submit button shared by the settings and About editors. Wears the shadcn
 * Button surface (`buttonVariants`) but stays a motion element so its width
 * morphs smoothly between the idle label (✓) and the pending spinner — the two
 * captions cross-fade in place via `AnimatePresence`, and `layout="size"`
 * tweens the box around them.
 */
export function SaveButton({
  pending,
  disabled,
  label,
  pendingLabel,
}: SaveButtonProps) {
  return (
    <m.button
      layout="size"
      type="submit"
      disabled={disabled}
      transition={{ layout: { duration: 0.3, ease: EASE } }}
      className={`${buttonVariants()} relative overflow-hidden px-6 active:scale-[0.98]`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={pending ? "saving" : "idle"}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.22, ease: EASE }}
          className="inline-flex items-center gap-2 whitespace-nowrap"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {pendingLabel}
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden />
              {label}
            </>
          )}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}
