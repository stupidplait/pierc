"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from "react";
import { FIELD } from "@/components/admin/form/styles";

// Shared contract — a controlled "HH:MM" value plus a hidden input so it posts
// inside a plain <form action>.
export interface TimeWheelProps {
  name: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}

// Geometry. 5 rows visible, the middle one selected.
const ITEM_H = 36;
const VISIBLE = 5;
const CENTER_OFFSET = (VISIBLE - 1) / 2; // 2 rows above centre
// Repeated copies of the value list make the wheel feel endless. We keep
// scrollTop wrapped within a band of whole blocks around the middle on *every*
// write (drag, glide, native scroll), shifting by whole blocks as it travels —
// invisible because every block renders identical values. So the wheel never
// reaches a scroll boundary, no matter how fast you fling it (the old fixed
// buffer let a fast drag on the 4-value minutes column hit the end and "jump").
const REPEAT = 11;
const BAND_BLOCKS = Math.floor(REPEAT / 2) - 1; // 4 → stays clear of both edges

// Motion tuning (mouse-drag / click — touch/trackpad/wheel scroll natively).
// A flick "coasts" by projecting its release velocity forward, then we ease to
// the nearest row in one continuous tween whose length scales with distance.
const COAST_MS = 360; // how far a flick is projected (× px/ms of velocity)
const MAX_V = 3.5; // cap a hard flick (px/ms)
const PAUSE_MS = 70; // hold-still longer than this before release → no coast
const DUR_BASE = 260; // ms — floor of the glide/snap easing
const DUR_PER_PX = 0.5; // ms added per px of travel
const DUR_MAX = 750; // ms — ceiling
const MOVE_EPS = 4; // px of pointer travel that turns a click into a drag

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function centeredIndex(scrollTop: number): number {
  return Math.round(scrollTop / ITEM_H + CENTER_OFFSET);
}
function scrollForIndex(i: number): number {
  return (i - CENTER_OFFSET) * ITEM_H;
}
function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

interface DragState {
  startY: number;
  startTop: number;
  lastY: number;
  lastT: number;
  v: number;
  moved: boolean;
}

function WheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<DragState | null>(null);
  const raf = useRef<number | null>(null);
  const animating = useRef(false);
  const positioned = useRef(false);
  const initialIdx = useRef(Math.max(0, values.indexOf(value)));
  const n = values.length;
  const blockH = n * ITEM_H;
  const mid = Math.floor(REPEAT / 2) * n;
  const center = scrollForIndex(mid);
  const band = blockH * BAND_BLOCKS;

  // Wrap a scroll position into the band around the middle by whole blocks.
  const wrap = (st: number): number => {
    let s = st;
    while (s < center - band) s += blockH;
    while (s > center + band) s -= blockH;
    return s;
  };

  // Position on the active value the moment the node mounts — before paint, so
  // the wheel never visibly scrolls to its default when the drawer opens.
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      elRef.current = node;
      if (node && !positioned.current) {
        positioned.current = true;
        node.scrollTop = scrollForIndex(mid + initialIdx.current);
      }
    },
    [mid],
  );

  const stopAnim = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    animating.current = false;
  };

  // Report the centred value and recenter to the middle block once a glide
  // lands (the small final wrap; same idea as `wrap`, kept exact on a detent).
  const reportAndRecenter = () => {
    const el = elRef.current;
    if (!el) return;
    const c = centeredIndex(el.scrollTop);
    const vIdx = ((c % n) + n) % n;
    if (values[vIdx] !== value) onChange(values[vIdx]);
    const deltaBlocks = Math.round((mid + vIdx - c) / n);
    if (deltaBlocks !== 0) el.scrollTop += deltaBlocks * blockH;
  };

  // One eased glide to `target`, easeOutCubic over a distance-scaled duration.
  // It steps by incremental deltas applied through `wrap`, so it can travel any
  // distance without hitting an edge. Flick, click and the post-native-scroll
  // snap all route through it, so motion always feels alike.
  const glideTo = (target: number) => {
    const el = elRef.current;
    if (!el) return;
    stopAnim();
    const from = el.scrollTop;
    const dist = target - from;
    if (Math.abs(dist) < 0.5) {
      reportAndRecenter();
      return;
    }
    const duration = Math.min(DUR_MAX, DUR_BASE + Math.abs(dist) * DUR_PER_PX);
    animating.current = true;
    let startT = -1;
    let prevVirtual = 0;
    const step = (t: number) => {
      const node = elRef.current;
      if (!node) {
        animating.current = false;
        return;
      }
      if (startT < 0) startT = t;
      const p = Math.min((t - startT) / duration, 1);
      const virtual = dist * easeOutCubic(p);
      node.scrollTop = wrap(node.scrollTop + (virtual - prevVirtual));
      prevVirtual = virtual;
      if (p < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        raf.current = null;
        animating.current = false;
        reportAndRecenter();
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  const glideToIndex = (i: number) => glideTo(scrollForIndex(i));

  // Native scroll (touch / trackpad / wheel): keep it wrapped as it goes, then
  // settle to the nearest row once idle. Our own glides set `animating`, which
  // suppresses both.
  const onScroll = () => {
    const el = elRef.current;
    if (!el || drag.current || animating.current) return;
    const w = wrap(el.scrollTop);
    if (w !== el.scrollTop) el.scrollTop = w;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const node = elRef.current;
      if (!node || drag.current || animating.current) return;
      glideToIndex(centeredIndex(node.scrollTop));
    }, 80);
  };

  // ── Mouse drag + click ──────────────────────────────────────────────────
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = elRef.current;
    if (!el) return;
    stopAnim();
    drag.current = {
      startY: e.clientY,
      startTop: el.scrollTop,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = elRef.current;
    const d = drag.current;
    if (!el || !d) return;
    if (Math.abs(e.clientY - d.startY) > MOVE_EPS) d.moved = true;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      // scrollTop rises as the pointer moves up, so velocity = -dClientY/dt.
      d.v = (d.lastY - e.clientY) / dt;
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
    }
    // 1:1 follow, wrapped — and carry the wrap shift into startTop so the next
    // move stays continuous. This is what keeps a fast fling from hitting the
    // scroll boundary on the short minutes column.
    const raw = d.startTop - (e.clientY - d.startY);
    const wrapped = wrap(raw);
    d.startTop += wrapped - raw;
    el.scrollTop = wrapped;
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = elRef.current;
    const d = drag.current;
    if (!d || !el) return;
    drag.current = null;
    el.releasePointerCapture?.(e.pointerId);

    if (!d.moved) {
      // A click selects the row under the pointer (scrolls it to centre).
      const rectTop = el.getBoundingClientRect().top;
      const clicked = Math.floor((el.scrollTop + (e.clientY - rectTop)) / ITEM_H);
      glideToIndex(clicked);
      return;
    }
    // A flick projects its velocity forward, then eases to the nearest row.
    const v0 = e.timeStamp - d.lastT > PAUSE_MS ? 0 : d.v;
    const clamped = Math.max(-MAX_V, Math.min(MAX_V, v0));
    glideToIndex(centeredIndex(el.scrollTop + clamped * COAST_MS));
  };

  return (
    <div
      ref={setRef}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="group"
      aria-label={ariaLabel}
      className="h-45 flex-1 cursor-pointer overflow-y-auto overscroll-contain select-none scrollbar-none"
    >
      {Array.from({ length: REPEAT * n }, (_, j) => (
        <div
          key={j}
          className="flex h-9 items-center justify-center text-base tabular-nums text-ink"
        >
          {values[j % n]}
        </div>
      ))}
    </div>
  );
}

/** iOS-style scroll wheel — spin hours and minutes, or click a value. The
 *  centred row (framed by the band) is selected. Endlessly scrolling, with a
 *  buttery distance-scaled glide on flick / click / settle. */
export function TimeWheel({ name, value, onChange, ariaLabel }: TimeWheelProps) {
  const [h, m] = value ? value.split(":") : ["11", "00"];
  return (
    <div className={`${FIELD} relative flex items-stretch overflow-hidden p-0`}>
      <input type="hidden" name={name} value={value} />
      <WheelColumn
        values={HOURS}
        value={h}
        onChange={(nh) => onChange(`${nh}:${m || "00"}`)}
        ariaLabel={ariaLabel ? `${ariaLabel}: часы` : undefined}
      />
      <span className="pointer-events-none flex items-center text-base text-mute">
        :
      </span>
      <WheelColumn
        values={MINUTES}
        value={m}
        onChange={(nm) => onChange(`${h || "00"}:${nm}`)}
        ariaLabel={ariaLabel ? `${ariaLabel}: минуты` : undefined}
      />
      {/* Centre selection band. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 border-y border-ink/15 bg-ink/5" />
    </div>
  );
}
