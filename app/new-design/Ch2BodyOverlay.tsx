"use client";

import styles from "./page.module.css";

/**
 * Ch2BodyOverlay — drafted SVG wireframe bust rendered above the 2D
 * grid as a clinical anatomy diagram. The 3D body model has been
 * retired from the canonical scene; this DOM/SVG overlay is the
 * visible figure on the examination plate.
 *
 * Vocabulary matches the grid + preloader blueprint: hairline strokes,
 * no fill, no shadow. Reads as the anatomical chart on a museum
 * examination plate, not a rendered character.
 *
 * Animation, scroll-driven from --ch2-body-reveal (set on the chapter
 * root by BodyModelPreview's rAF loop, ramps 0 → 1 across ph 0.78 →
 * 0.90 — strictly AFTER the grid has fully landed at ph 0.75):
 *
 *   • translateX  +40% → 0         (slides in from off-stage right)
 *   • per-line stroke-dashoffset 1 → 0 over the same window so the
 *     figure literally DRAWS itself in place once it's slid in.
 *     pathLength=1 on every outline element normalises the dasharray
 *     space so all strokes draw at the same proportional speed,
 *     regardless of their actual length.
 *
 * Combined: the body slides in from the right wing, then the wireframe
 * resolves itself stroke by stroke — the same vocabulary the preloader
 * uses to materialise the room. Faster + more cohesive than the
 * previous CSS-3D rotateY which looked pasted on a flat figure.
 *
 * Each anchor zone exposes a per-zone <g data-zone="..."> group
 * containing:
 *   • the anchor circle (always visible once body has materialised)
 *   • a drafted callout line extending outward to a margin point
 *   • a small numeric tag at the callout endpoint
 *
 * Inactive zones: callout + tag invisible. Active zone: callout draws
 * in via stroke-dashoffset tied to --ch2-zones-reveal (ramps 0 → 1
 * across ph 0.85 → 0.97), tag fades in once the line completes.
 */

/* SVG viewbox 200 × 400 — head-and-torso front-view silhouette.
   Coordinates are in viewbox units; the visual size is set in CSS
   via clamp() so the figure scales sensibly across viewports. */
const VW = 200;
const VH = 400;

/* Anchor positions in SVG coordinates. Mirrors the gltf-local
   ANCHORS_LOCAL convention (avatar's left = screen-right in front
   view) so left-ear / right-ear feel natural to the user looking at
   the avatar. Each entry also carries a callout endpoint — where the
   leader line terminates, with a numeric tag. Endpoints are chosen so
   lines extend outward from the body without crossing each other. */
interface AnchorSpec {
    pos: [number, number];
    callout: [number, number];
    label: string; // 2-digit zone index, mono caliper
}

const ANCHORS: Record<string, AnchorSpec> = {
    ear_left: { pos: [136, 78], callout: [188, 78], label: "01" },
    ear_right: { pos: [64, 78], callout: [12, 78], label: "02" },
    nose: { pos: [100, 70], callout: [180, 36], label: "03" },
    lip: { pos: [100, 92], callout: [180, 110], label: "04" },
    eyebrow: { pos: [115, 56], callout: [180, 18], label: "05" },
    navel: { pos: [100, 220], callout: [180, 220], label: "06" },
};

const ZONES = Object.keys(ANCHORS);

export default function Ch2BodyOverlay({ activeArea }: { activeArea: string }) {
    return (
        <div className={styles.ch2BodyOverlay} aria-hidden="true">
            <svg
                className={styles.ch2BodySvg}
                viewBox={`0 0 ${VW} ${VH}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Head — oval. Ellipse centred at (100, 70), semi-axes
                    32 × 42 — front-view face proportions. pathLength=1
                    normalises the dasharray space for the draw-on. */}
                <ellipse className={styles.ch2BodyOutline} cx="100" cy="70" rx="32" ry="42" pathLength={1} />

                {/* Inner head landmarks — drafted construction lines.
                    Vertical centerline, brow line, lip line. Drawn at
                    minor-color so they read as construction marks
                    (not features). */}
                <line className={styles.ch2BodyMinor} x1="100" y1="32" x2="100" y2="112" pathLength={1} />
                <line className={styles.ch2BodyMinor} x1="74" y1="56" x2="126" y2="56" pathLength={1} />
                <line className={styles.ch2BodyMinor} x1="80" y1="92" x2="120" y2="92" pathLength={1} />

                {/* Neck — two parallel verticals from head bottom (y=112)
                    to shoulder line (y=140). */}
                <line className={styles.ch2BodyOutline} x1="86" y1="112" x2="86" y2="140" pathLength={1} />
                <line className={styles.ch2BodyOutline} x1="114" y1="112" x2="114" y2="140" pathLength={1} />

                {/* Shoulder line — sloping curves from neck to outer
                    shoulder, then continuing into the torso taper.
                    Drafted as a single polyline rather than a smooth
                    curve so the geometry reads as constructed. */}
                <polyline
                    className={styles.ch2BodyOutline}
                    points="86,140 56,148 36,164 28,184"
                    pathLength={1}
                />
                <polyline
                    className={styles.ch2BodyOutline}
                    points="114,140 144,148 164,164 172,184"
                    pathLength={1}
                />

                {/* Torso side lines — taper from shoulder bottom to
                    waist. Stops at the navel area (y≈260) since
                    DESIGN.md doesn't have piercing anchors below
                    the navel. */}
                <line className={styles.ch2BodyOutline} x1="28" y1="184" x2="48" y2="280" pathLength={1} />
                <line className={styles.ch2BodyOutline} x1="172" y1="184" x2="152" y2="280" pathLength={1} />

                {/* Bottom hairline — closes the torso silhouette as a
                    drafted chest plate boundary. */}
                <line className={styles.ch2BodyOutline} x1="48" y1="280" x2="152" y2="280" pathLength={1} />

                {/* Shoulder horizontal reference — anatomical landmark
                    rendered in minor-color, like a measurement line on
                    a tailor's chart. Dashed by design (in CSS), so the
                    pathLength normalisation here just controls the
                    overall visibility ramp. */}
                <line
                    className={styles.ch2BodyMinor}
                    x1="36"
                    y1="164"
                    x2="164"
                    y2="164"
                    pathLength={1}
                />

                {/* Anchor zones — each in a per-zone <g data-zone>
                    group. Within each:
                      • anchor circle (always visible once body settled)
                      • drafted callout leader line (active only)
                      • numeric tag at callout endpoint (active only)

                    The callout line uses pathLength=1 so the
                    stroke-dashoffset animation works the same length
                    regardless of the actual line geometry. */}
                {ZONES.map((zone) => {
                    const spec = ANCHORS[zone];
                    const isActive = zone === activeArea;
                    const [ax, ay] = spec.pos;
                    const [cx, cy] = spec.callout;

                    return (
                        <g key={zone} data-zone={zone} data-active={isActive ? "1" : "0"}>
                            <line
                                className={styles.ch2BodyCallout}
                                x1={ax}
                                y1={ay}
                                x2={cx}
                                y2={cy}
                                pathLength={1}
                            />
                            <line
                                className={styles.ch2BodyCalloutTick}
                                x1={cx - 3}
                                y1={cy}
                                x2={cx + 3}
                                y2={cy}
                            />
                            <circle
                                className={styles.ch2BodyAnchor}
                                cx={ax}
                                cy={ay}
                                r={isActive ? 4 : 2.5}
                            />
                            <text
                                className={styles.ch2BodyCalloutLabel}
                                x={cx}
                                y={cy - 6}
                                textAnchor="middle"
                            >
                                {spec.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
