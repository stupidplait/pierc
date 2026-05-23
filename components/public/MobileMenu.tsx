"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ru } from "@/lib/i18n/ru";
import { NavLinks } from "./NavLinks";
import { signOutPublicAction } from "@/lib/user/auth-actions";

interface MobileMenuProps {
  user: { id: string; email: string; name: string } | null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileMenu({ user }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // While open: lock body scroll, mark sibling content `inert`, autofocus
  // the close button, trap Tab inside the drawer, close on Escape, and
  // restore focus to the opener on close.
  useEffect(() => {
    if (!open) return;

    // Mark every direct child of <body> except the drawer itself as inert,
    // so AT and keyboard nav can't reach hidden content.
    const drawer = drawerRef.current;
    const inertNodes: HTMLElement[] = [];
    if (drawer && document.body) {
      for (const child of Array.from(document.body.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.contains(drawer)) continue;
        if (!child.hasAttribute("inert")) {
          child.setAttribute("inert", "");
          child.setAttribute("aria-hidden", "true");
          inertNodes.push(child);
        }
      }
    }

    // Lock body scroll + autofocus the close button (after the next paint
    // so the drawer's transition isn't interrupted by an immediate focus
    // jump).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      for (const el of inertNodes) {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
      // Restore focus to the opener button on close.
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-label={ru.nav.menuOpen}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-page/70 backdrop-blur transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={ru.nav.menuOpen}
        // Touch & overscroll polish: keep drag/scroll inside the drawer
        // from leaking into the page beneath.
        style={{
          overscrollBehavior: "contain",
          touchAction: "pan-y",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        className={`fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-sm flex-col border-l border-line bg-page shadow-xl transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        // When closed, prevent its descendants from accepting focus so a
        // shift-tab from the page doesn't reach the hidden drawer.
        {...(!open ? { inert: "" as unknown as boolean } : {})}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <span className="font-display text-lg font-medium text-ink">
            {ru.studio.name}
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label={ru.nav.menuClose}
            onClick={() => setOpen(false)}
            className="inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <NavLinks
          className="flex flex-1 flex-col gap-1 px-6 py-6 text-lg font-medium"
          itemClassName="rounded-xl px-3 py-3"
          onNavigate={() => setOpen(false)}
        />

        <div className="flex flex-col gap-3 border-t border-line px-6 py-5">
          {user ? (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
              >
                {user.name || ru.nav.account}
              </Link>
              <form action={signOutPublicAction}>
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
                >
                  {ru.nav.signOut}
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/auth/sign-in"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
              >
                {ru.nav.signIn}
              </Link>
              <Link
                href="/auth/sign-up"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
              >
                {ru.nav.signUp}
              </Link>
            </div>
          )}
          <Link
            href="/book"
            onClick={() => setOpen(false)}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
          >
            {ru.nav.cta}
          </Link>
        </div>
      </div>
    </>
  );
}
