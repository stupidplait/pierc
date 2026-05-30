"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

// Repo signature easing (matches components/landing/Reveal.tsx).
const EASE = [0.16, 1, 0.3, 1] as const;
const DESKTOP_QUERY = "(min-width: 640px)";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// matchMedia as an external store — avoids set-state-in-effect (the project's
// ESLint treats that as an error; see useSyncExternalStore usage in Header).
function subscribeDesktop(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function getDesktopSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}
function getDesktopServerSnapshot(): boolean {
  return true; // assume desktop pre-hydration; corrected on first client read
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional small text under the title. */
  subtitle?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, children }: DrawerProps) {
  const reduce = useReducedMotion();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Body scroll lock + focus trap + Escape, only while open.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const offscreen = isDesktop ? { x: "100%" } : { y: "100%" };
  const panelCls = isDesktop
    ? "absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-page shadow-[0_24px_70px_-20px_rgba(8,8,8,0.8)]"
    : "absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl border-t border-line bg-page shadow-[0_-24px_70px_-20px_rgba(8,8,8,0.8)]";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-[rgba(8,8,8,0.62)] backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={panelCls}
            initial={reduce ? { opacity: 0 } : offscreen}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : offscreen}
            transition={{ ease: EASE, duration: reduce ? 0 : 0.34 }}
          >
            {!isDesktop ? (
              <div className="flex justify-center pt-3" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-ink-line-strong" />
              </div>
            ) : null}

            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-xl font-medium text-ink"
                >
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-1 text-sm text-mute">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-mute transition-colors hover:bg-card hover:text-ink active:scale-95"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
