"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { BrandMark } from "@/components/ui/BrandMark";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { AdminIdentity } from "./AdminIdentity";
import { RAIL_EASE as EASE } from "./sidebar-motion";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Mobile counterpart to {@link AdminSidebar}. The desktop rail is `hidden md:flex`,
 * so below `md` the nav would otherwise be unreachable — this is the hamburger in
 * the layout's top header plus a left slide-in sheet that mirrors the rail (same
 * brand header, the same {@link AdminSidebarNav} fully expanded, and identity
 * pinned to the bottom). Itself `md:hidden`; the trigger and panel never show once
 * the real rail takes over.
 *
 * Mechanics mirror `components/booking/Drawer.tsx`: a body portal with scroll
 * lock, a focus trap, Escape-to-close, and reduced-motion fallbacks. Links close
 * the sheet via `onNavigate` so a tap both routes and dismisses.
 */
export function AdminMobileNav({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Scroll lock + focus trap + Escape, only while open. `scrollbar-gutter: stable`
  // in globals.css keeps the page from shifting when body overflow is hidden.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
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
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть меню"
        aria-haspopup="dialog"
        aria-expanded={open ? "true" : "false"}
        className="-ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-mute transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
      >
        <MenuIcon />
      </button>

      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {open ? (
                <div className="fixed inset-0 z-50">
                  <motion.div
                    className="absolute inset-0 bg-[rgba(8,8,8,0.62)] backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                  />
                  <motion.aside
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={ru.admin.panel}
                    className="absolute left-0 top-0 flex h-full w-70 max-w-[85%] flex-col border-r border-line/70 bg-card/95 p-5 shadow-[0_24px_70px_-20px_rgba(8,8,8,0.8)] backdrop-blur-xl"
                    initial={reduce ? { opacity: 0 } : { x: "-100%" }}
                    animate={reduce ? { opacity: 1 } : { x: 0 }}
                    exit={reduce ? { opacity: 0 } : { x: "-100%" }}
                    transition={{ ease: EASE, duration: reduce ? 0 : 0.34 }}
                  >
                    <div className="flex items-center justify-between gap-2 pl-3">
                      <Link
                        href="/"
                        aria-label={ru.studio.name}
                        onClick={() => setOpen(false)}
                        className="flex min-w-0 items-center gap-2.5 font-display text-lg font-medium tracking-tight text-ink"
                      >
                        <BrandMark className="size-6 shrink-0" />
                        <span className="min-w-0 truncate">{ru.studio.name}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Закрыть"
                        className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-mute transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
                      >
                        <CloseIcon />
                      </button>
                    </div>

                    <div className="mt-8 flex-1 overflow-y-auto overscroll-contain">
                      <AdminSidebarNav onNavigate={() => setOpen(false)} />
                    </div>

                    <div className="mt-6 border-t border-line/70 pt-4">
                      <AdminIdentity name={name} email={email} />
                    </div>
                  </motion.aside>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.75 5h12.5M2.75 9h12.5M2.75 13h12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
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
