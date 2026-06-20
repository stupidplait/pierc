// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";

export function parseCssColor(
    input: string,
    fallback: { hex: string; alpha: number }
): { color: THREE.Color; alpha: number } {
    if (!input) {
        return {
            color: new THREE.Color(fallback.hex),
            alpha: fallback.alpha,
        };
    }

    const trimmed = input.trim();

    // 8-digit hex: #RRGGBBAA (some browsers return CSS rgba() vars in this form)
    const hex8 = trimmed.match(/^#([0-9a-f]{8})$/i);
    if (hex8) {
        const r = parseInt(hex8[1].slice(0, 2), 16) / 255;
        const g = parseInt(hex8[1].slice(2, 4), 16) / 255;
        const b = parseInt(hex8[1].slice(4, 6), 16) / 255;
        const a = parseInt(hex8[1].slice(6, 8), 16) / 255;
        return { color: new THREE.Color(r, g, b), alpha: a };
    }

    const rgbaMatch = trimmed.match(
        /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i
    );
    if (rgbaMatch) {
        const r = Number(rgbaMatch[1]) / 255;
        const g = Number(rgbaMatch[2]) / 255;
        const b = Number(rgbaMatch[3]) / 255;
        const a = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
        return { color: new THREE.Color(r, g, b), alpha: a };
    }

    try {
        return { color: new THREE.Color(trimmed), alpha: 1 };
    } catch {
        return {
            color: new THREE.Color(fallback.hex),
            alpha: fallback.alpha,
        };
    }
}

export type ParsedColors = {
    bg: THREE.Color;
    minor: THREE.Color;
    minorAlpha: number;
    major: THREE.Color;
    majorAlpha: number;
    crossColor: THREE.Color;
    crossAlpha: number;
    luminous: THREE.Color;
    accent: THREE.Color;
    reflect: THREE.Color;
};

export function useThemeColors(scopeRef: React.RefObject<HTMLElement | null>): ParsedColors {
    // Defaults mirror the dark scene tokens in globals.css so the very first
    // frame (before getComputedStyle resolves) is already correct in dark.
    const [raw, setRaw] = useState({
        bg: "#080808",
        minor: "#171717",
        major: "#3e3e3e",
        cross: "#686868",
        ink: "#ffffff",
        accent: "#f06ba0",
        reflect: "#000000",
    });

    useEffect(() => {
        const el = scopeRef.current ?? document.documentElement;

        const read = () => {
            const styles = getComputedStyle(el);
            const get = (name: string, fb: string) =>
                styles.getPropertyValue(name).trim() || fb;
            setRaw({
                bg: get("--scene-bg", "#080808"),
                minor: get("--scene-grid-minor", "#171717"),
                major: get("--scene-grid-major", "#3e3e3e"),
                cross: get("--scene-cross", "#686868"),
                ink: get("--scene-ink", "#ffffff"),
                accent: get("--scene-accent", "#f06ba0"),
                reflect: get("--scene-reflect", "#000000"),
            });
        };

        read();
        // The theme toggle swaps the `.theme-*` / `.lighthero-*` CLASS and the
        // `data-theme` attribute on <html>; watch both so the scene re-reads
        // its tokens on every theme AND light-hero change.
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "data-theme"],
        });
        return () => observer.disconnect();
    }, [scopeRef]);

    return useMemo(() => {
        // Scene tokens are solid hex (pre-baked alpha over --scene-bg) so we
        // use opacity 1.0 across the board. Materials render opaque and skip
        // the transparent render queue, fixing the alpha-bleed where minor
        // lines used to show through the major mesh.
        const bg = parseCssColor(raw.bg, { hex: "#080808", alpha: 1 }).color;
        const m = parseCssColor(raw.minor, { hex: "#171717", alpha: 1 });
        const M = parseCssColor(raw.major, { hex: "#3e3e3e", alpha: 1 });
        const cross = parseCssColor(raw.cross, { hex: "#686868", alpha: 1 });
        // "luminous" drives the HDR-pushed headline + chapter titles
        // (PIERCERKZN, ВЫБЕРИ, ПРИМЕРЬ). White on the dark room (bloom glow);
        // dark ink on the paper hero; accent on the white studio hero — all
        // sourced from --scene-ink so a theme/variant swap retints the text.
        const luminous = parseCssColor(raw.ink, { hex: "#ffffff", alpha: 1 }).color;
        const accent = parseCssColor(raw.accent, { hex: "#f06ba0", alpha: 1 }).color;
        const reflect = parseCssColor(raw.reflect, { hex: "#000000", alpha: 1 }).color;
        return {
            bg,
            minor: m.color,
            minorAlpha: 1,
            major: M.color,
            majorAlpha: 1,
            crossColor: cross.color,
            crossAlpha: 1,
            luminous,
            accent,
            reflect,
        };
    }, [raw]);
}
