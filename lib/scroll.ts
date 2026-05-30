export const SCROLL_EVENT = "piercer:scroll-to";

type LenisLike = { scrollTo: (target: HTMLElement, opts?: { offset?: number }) => void };

export function scrollToSection(id: string) {
    if (typeof window === "undefined") return;
    const ev = new CustomEvent(SCROLL_EVENT, { detail: { id }, cancelable: true });
    const handled = !window.dispatchEvent(ev);
    if (handled) return;

    const el = document.getElementById(id);
    if (!el) return;

    // If Lenis is driving the page (e.g. /about), route the jump through it so
    // it eases with the same momentum as wheel scrolling. Offset clears the
    // fixed header (~4.5rem + a little breathing room).
    const lenis = (window as Window & { __lenis?: LenisLike }).__lenis;
    if (lenis) {
        lenis.scrollTo(el, { offset: -80 });
        return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "start" });
}
