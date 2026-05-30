"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { subscribeScroll } from "@/lib/hooks/useScrollBus";
import { signOutPublicAction } from "@/lib/user/auth-actions";
import { signOutAdminAction } from "@/lib/admin/auth-actions";

interface HeaderProps {
    // When signed in, the header shows the account dropdown + sign-out instead
    // of the "Войти" button. Optional so the landing can render it signed-out.
    user?: { name: string; email: string } | null;
    // An active admin session browsing the public site. Takes precedence over
    // `user`: the chip links to /admin and uses the admin sign-out.
    admin?: { name: string; email: string } | null;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const NAV_ITEMS = [
    { href: "/", label: "Главная" },
    { href: "/catalog", label: "Каталог" },
    { href: "/services", label: "Услуги" },
    { href: "/about", label: "О студии" },
    { href: "/gallery", label: "Галерея" },
    { href: "/faq", label: "FAQ" },
];

// A nav item is active on an exact match, or when the current route is nested
// under it (e.g. /catalog/[id]). "/" matches only the landing page exactly so
// it isn't lit on every route.
function isActive(href: string, pathname: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}

const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm";

const NAV_LINK_CLASSES = `text-[12px] tracking-[0.04em] no-underline transition-colors duration-200 hover:text-accent active:scale-[0.97] [text-shadow:0_1px_12px_rgba(8,8,8,0.45)] ${FOCUS_RING}`;

const MOBILE_LINK_CLASSES = `font-display text-[clamp(28px,6vw,40px)] font-bold tracking-[-0.01em] no-underline transition-colors duration-200 hover:text-accent active:scale-[0.97] ${FOCUS_RING}`;

// Unified radius across the right-side controls (rounded-xl), matching the
// sign-in / sign-up button + card vocabulary.
// Secondary pill ("Войти") — same shape as the "Записаться" CTA so the right
// side reads as a consistent set of buttons.
const BTN_PILL_SECONDARY = `inline-flex items-center justify-center rounded-xl border border-ink-line-strong bg-transparent px-[14px] py-[8px] text-[12px] font-medium tracking-[0.04em] text-ink no-underline transition-colors duration-200 hover:border-ink active:scale-[0.97] [text-shadow:0_1px_12px_rgba(8,8,8,0.45)] ${FOCUS_RING}`;
// Account dropdown trigger (avatar + name + chevron) — borderless so the
// account reads as a quiet control, distinct from the bordered CTA buttons.
const CHIP = `inline-flex items-center gap-2 rounded-xl bg-transparent py-1 pl-1 pr-2 text-[12px] font-medium tracking-[0.04em] text-ink no-underline transition-colors duration-200 hover:bg-ink/5 active:scale-[0.97] ${FOCUS_RING}`;
// Avatar: rounded-lg so it sits concentrically inside the chip's rounded-xl.
const AVATAR = "flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-bg";
const MENU_PANEL = "absolute right-0 top-[calc(100%+10px)] z-40 min-w-[180px] overflow-hidden rounded-xl border border-ink-line-strong bg-[rgba(8,8,8,0.94)] p-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl animate-[landingChromeFadeIn_150ms_ease-out_both]";
const MENU_ITEM = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink no-underline transition-colors hover:bg-ink/10 ${FOCUS_RING}`;

export function Header({ user = null, admin = null }: HeaderProps) {
    const pathname = usePathname();
    const [hidden, setHidden] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const burgerRef = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Close the account dropdown on outside-click / Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);

    useEffect(() => {
        let lastY = typeof window === "undefined" ? 0 : window.scrollY;
        let nearTop = false;

        const evaluate = (y: number) => {
            const dy = y - lastY;
            setHidden((current) => {
                let next = current;
                if (y < 80 || nearTop) next = false;
                else if (dy > 4 && y > 120) next = true;
                else if (dy < -4) next = false;
                return next;
            });
            lastY = y;
        };

        const onMove = (e: PointerEvent) => {
            const was = nearTop;
            nearTop = e.clientY <= 64;
            if (was !== nearTop) evaluate(window.scrollY);
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        const unsubscribe = subscribeScroll((s) => evaluate(s.scrollY));
        return () => {
            window.removeEventListener("pointermove", onMove);
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const dialog = dialogRef.current;
        const burger = burgerRef.current;
        if (!dialog) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const focusables = dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])',
        );
        focusables[0]?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                setMobileMenuOpen(false);
                return;
            }
            if (e.key !== "Tab") return;
            const all = dialog.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled])',
            );
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
            document.body.style.overflow = previousOverflow;
            burger?.focus();
        };
    }, [mobileMenuOpen]);

    return (
        <>
            <header
                aria-label="Шапка сайта"
                data-hidden={hidden ? "1" : "0"}
                className={[
                    "fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-6",
                    "px-[clamp(20px,3vw,36px)] py-[clamp(20px,2.4vh,28px)]",
                    "max-[820px]:px-[18px] max-[820px]:py-[16px]",
                    "bg-transparent text-[13px]",
                    "transition-[translate,opacity] duration-[360ms] ease-[cubic-bezier(0.22,0.9,0.32,1)]",
                    "data-[hidden=1]:opacity-0 data-[hidden=1]:-translate-y-full data-[hidden=1]:pointer-events-none",
                ].join(" ")}
            >
                <Link
                    href="/"
                    aria-label="PiercerKZN"
                    className={`inline-flex items-center gap-2 font-display font-bold tracking-[0.18em] text-[12px] text-ink no-underline transition-colors duration-200 hover:text-accent active:scale-[0.97] [text-shadow:0_1px_12px_rgba(8,8,8,0.45)] ${FOCUS_RING}`}
                >
                    <span>PIERCER</span>
                    <span aria-hidden="true" className="size-[5px] rounded-full bg-accent" />
                    <span>KZN</span>
                </Link>

                <nav
                    aria-label="Основная навигация"
                    className="flex gap-[clamp(20px,2.4vw,32px)] max-[820px]:hidden"
                >
                    {NAV_ITEMS.map(({ href, label }) => {
                        const active = isActive(href, pathname);
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? "page" : undefined}
                                className={`${NAV_LINK_CLASSES} ${active ? "text-accent" : "text-ink"}`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-[10px]">
                    {admin ? (
                        <div
                            ref={menuRef}
                            className="relative max-[820px]:hidden"
                        >
                            <button
                                type="button"
                                onClick={() => setMenuOpen((v) => !v)}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen ? "true" : "false"}
                                className={CHIP}
                            >
                                <span className={AVATAR} aria-hidden="true">
                                    {initials(admin.name)}
                                </span>
                                <span className="max-[980px]:hidden">
                                    {admin.name || "Админ"}
                                </span>
                                <ChevronIcon open={menuOpen} />
                            </button>
                            {menuOpen ? (
                                <div role="menu" className={MENU_PANEL}>
                                    <Link
                                        role="menuitem"
                                        href="/admin"
                                        onClick={() => setMenuOpen(false)}
                                        className={MENU_ITEM}
                                    >
                                        <UserIcon />
                                        Панель управления
                                    </Link>
                                    <form action={signOutAdminAction}>
                                        <button
                                            role="menuitem"
                                            type="submit"
                                            className={MENU_ITEM}
                                        >
                                            <LogoutIcon />
                                            Выйти
                                        </button>
                                    </form>
                                </div>
                            ) : null}
                        </div>
                    ) : user ? (
                        <div
                            ref={menuRef}
                            className="relative max-[820px]:hidden"
                        >
                            <button
                                type="button"
                                onClick={() => setMenuOpen((v) => !v)}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen ? "true" : "false"}
                                className={CHIP}
                            >
                                <span className={AVATAR} aria-hidden="true">
                                    {initials(user.name)}
                                </span>
                                <span className="max-[980px]:hidden">
                                    {user.name || "Профиль"}
                                </span>
                                <ChevronIcon open={menuOpen} />
                            </button>
                            {menuOpen ? (
                                <div role="menu" className={MENU_PANEL}>
                                    <Link
                                        role="menuitem"
                                        href="/account"
                                        onClick={() => setMenuOpen(false)}
                                        className={MENU_ITEM}
                                    >
                                        <UserIcon />
                                        Профиль
                                    </Link>
                                    <form action={signOutPublicAction}>
                                        <button
                                            role="menuitem"
                                            type="submit"
                                            className={MENU_ITEM}
                                        >
                                            <LogoutIcon />
                                            Выйти
                                        </button>
                                    </form>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <Link
                            href="/auth/sign-in"
                            className={`${BTN_PILL_SECONDARY} max-[820px]:hidden`}
                        >
                            Войти
                        </Link>
                    )}

                    <Link
                        href="/book"
                        className={`inline-flex items-center gap-2 rounded-xl border border-ink-line-strong bg-transparent px-[14px] py-[9px] text-[12px] font-medium tracking-[0.04em] text-ink no-underline transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-bg active:scale-[0.97] ${FOCUS_RING}`}
                    >
                        <span aria-hidden="true" className="size-[5px] rounded-full bg-accent" />
                        Записаться
                    </Link>

                    <button
                        ref={burgerRef}
                        type="button"
                        aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
                        aria-expanded={mobileMenuOpen ? "true" : "false"}
                        onClick={() => setMobileMenuOpen((v) => !v)}
                        className={`hidden size-11 cursor-pointer flex-col items-center justify-center gap-[6px] border-0 bg-transparent p-0 touch-manipulation active:scale-[0.94] max-[820px]:flex ${FOCUS_RING}`}
                    >
                        <span
                            data-open={mobileMenuOpen ? "1" : "0"}
                            className="block h-[1.5px] w-5 rounded-[1px] bg-ink transition-transform duration-[250ms] ease data-[open=1]:translate-y-[3.75px] data-[open=1]:rotate-45"
                        />
                        <span
                            data-open={mobileMenuOpen ? "1" : "0"}
                            className="block h-[1.5px] w-5 rounded-[1px] bg-ink transition-transform duration-[250ms] ease data-[open=1]:-translate-y-[3.75px] data-[open=1]:-rotate-45"
                        />
                    </button>
                </div>
            </header>

            {mobileMenuOpen && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-label="Навигация"
                    aria-modal="true"
                    className="fixed inset-0 z-[29] flex flex-col items-center justify-center gap-7 bg-[rgba(8,8,8,0.94)] backdrop-blur-2xl animate-[landingChromeFadeIn_250ms_ease-out_both] overscroll-contain"
                >
                    <nav
                        aria-label="Мобильная навигация"
                        className="flex flex-col items-center gap-7"
                    >
                        {NAV_ITEMS.map(({ href, label }) => {
                            const active = isActive(href, pathname);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={active ? "page" : undefined}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`${MOBILE_LINK_CLASSES} ${active ? "text-accent" : "text-ink"}`}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                        {admin ? (
                            <>
                                <Link
                                    href="/admin"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`${MOBILE_LINK_CLASSES} text-ink`}
                                >
                                    Панель управления
                                </Link>
                                <form action={signOutAdminAction}>
                                    <button type="submit" className={`${MOBILE_LINK_CLASSES} text-ink`}>
                                        Выйти
                                    </button>
                                </form>
                            </>
                        ) : user ? (
                            <>
                                <Link
                                    href="/account"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`${MOBILE_LINK_CLASSES} text-ink`}
                                >
                                    {user.name || "Профиль"}
                                </Link>
                                <form action={signOutPublicAction}>
                                    <button type="submit" className={`${MOBILE_LINK_CLASSES} text-ink`}>
                                        Выйти
                                    </button>
                                </form>
                            </>
                        ) : (
                            <Link
                                href="/auth/sign-in"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`${MOBILE_LINK_CLASSES} text-ink`}
                            >
                                Войти
                            </Link>
                        )}
                    </nav>
                </div>
            )}
        </>
    );
}

function LogoutIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
            <path
                d="M10 11l3-3-3-3M13 8H6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function UserIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
            <path
                d="M3.5 13.5a4.5 4.5 0 0 1 9 0"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
            <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
