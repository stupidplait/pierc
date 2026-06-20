export const SCROLL_EVENT = "piercer:scroll-to";

type LenisLike = { scrollTo: (target: HTMLElement, opts?: { offset?: number }) => void };

// Move keyboard / screen-reader focus to the jumped-to section. In-page anchors
// that preventDefault() lose the browser's native focus move, so without this the
// user's focus stays on the TOC link and the next Tab continues from the rail,
// not the destination (WCAG 2.4.3). A roving tabindex={-1} makes the section
// programmatically focusable; preventScroll avoids a second scroll jump.
function focusSection(el: HTMLElement) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
}

export function scrollToSection(id: string) {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);

    const ev = new CustomEvent(SCROLL_EVENT, { detail: { id }, cancelable: true });
    const handled = !window.dispatchEvent(ev);
    if (handled) {
        if (el) focusSection(el);
        return;
    }

    if (!el) return;

    // If Lenis is driving the page (e.g. /about), route the jump through it so it
    // eases with the same momentum as wheel scrolling. The -96px offset matches
    // the sections' `scroll-mt-24` (6rem) so the landing point is identical on
    // the Lenis and the native (reduced-motion) paths.
    const lenis = (window as Window & { __lenis?: LenisLike }).__lenis;
    if (lenis) {
        lenis.scrollTo(el, { offset: -96 });
        focusSection(el);
        return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "start" });
    focusSection(el);
}
