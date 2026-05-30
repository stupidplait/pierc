"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Centered confirmation modal. Shares the overlay vocabulary of the booking
// Drawer (portal to body, backdrop blur, focus trap, Escape, scroll lock,
// reduced-motion) but as a small centered card for a single yes/no decision —
// the in-app replacement for window.confirm.

// Repo signature easing (matches components/booking/Drawer.tsx + landing Reveal).
const EASE = [0.16, 1, 0.3, 1] as const;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Tone = "default" | "danger";

const CONFIRM_TONE: Record<Tone, string> = {
  default: "bg-ink text-bg hover:bg-ink/90",
  danger: "bg-error text-bg hover:bg-error/90",
};

interface ConfirmDialogProps {
  open: boolean;
  /** Dismiss without confirming (backdrop, Escape, cancel button). */
  onClose: () => void;
  /** The user committed to the action. */
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Shown on the confirm button while the action runs (defaults to confirmLabel). */
  pendingLabel?: string;
  /** Disables both buttons and blocks dismissal while the action is in flight. */
  pending?: boolean;
  /** "danger" paints the confirm button in the error colour. */
  tone?: Tone;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  pending = false,
  tone = "default",
}: ConfirmDialogProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Body scroll lock + focus trap + Escape, only while open. Mirrors Drawer.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    // Safe default for a destructive prompt: land on the dismiss action.
    dismissRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!pending) onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const all = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose, pending]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-[rgba(8,8,8,0.62)] backdrop-blur-sm"
            onClick={() => {
              if (!pending) onClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            aria-busy={pending}
            className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-[0_24px_70px_-20px_rgba(8,8,8,0.8)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ ease: EASE, duration: reduce ? 0 : 0.22 }}
          >
            <h2 id={titleId} className="font-display text-xl font-medium text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-2 text-sm leading-relaxed text-mute">
                {description}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                ref={dismissRef}
                type="button"
                onClick={onClose}
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-ink-line-strong px-5 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink active:scale-[0.98] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={`inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 ${CONFIRM_TONE[tone]}`}
              >
                {pending ? pendingLabel ?? confirmLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
