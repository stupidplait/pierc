"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildTryOnFilename,
  composite,
  drawDebugDots,
  saveToImage,
} from "@/lib/lite/canvas-render";
import { LITE_ANCHORS_BY_SLUG } from "@/lib/lite/anchor-config";
import {
  detectFacePlacements,
  type DetectionOutcome,
} from "@/lib/lite/face-landmarker";
import type {
  AnchorPlacement,
  DragOffsetMap,
  PixelPoint,
} from "@/lib/lite/types";
import { catalogStrings } from "@/lib/i18n/ru";
import type { JewelryWire } from "@/lib/catalog/types";

interface SelfieCanvasProps {
  /** Object URL of the user's selfie. */
  photoUrl: string;
  /** Equipped pieces keyed by anchor SLUG (not anchor id). */
  equippedBySlug: Record<string, string>;
  /** All published jewelry, used to resolve sprite URLs by id. */
  jewelry: JewelryWire[];
  /** Drag offsets (image px) keyed by `${anchorSlug}:${jewelryId}`. */
  dragOffsets: DragOffsetMap;
  /** Update a single sprite's drag offset. */
  onUpdateOffset: (key: string, offset: PixelPoint) => void;
  /** When true, render colored debug dots at each placement instead of sprites. */
  debugDots?: boolean;
}

type Stage =
  | { kind: "loading-image" }
  | { kind: "loading-model" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

/** Key for the `dragOffsets` map. */
function dragKey(anchorSlug: string, jewelryId: string): string {
  return `${anchorSlug}:${jewelryId}`;
}

/**
 * Selfie canvas — loads the photo, runs FaceLandmarker, paints
 * the photo, and composites every equipped sprite at its anchor
 * placement. Re-renders whenever equipped pieces change or new sprite
 * images finish loading.
 *
 * Drag-to-nudge (Task 6): pointerdown over a sprite captures it as
 * the active drag target; pointermove calls `onUpdateOffset` with the
 * absolute offset for that sprite. The parent (`<LiteMode>`) owns
 * `dragOffsets` so it can clear them on photo swap and expose a
 * "reset all" affordance in the sidebar.
 */
export function SelfieCanvas({
  photoUrl,
  equippedBySlug,
  jewelry,
  dragOffsets,
  onUpdateOffset,
  debugDots = false,
}: SelfieCanvasProps) {
  const t = catalogStrings.liteMode;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);

  const [stage, setStage] = useState<Stage>({ kind: "loading-image" });
  const [placements, setPlacements] = useState<AnchorPlacement[]>([]);
  /**
   * Sprite cache as React state — using state (not a ref) so reads from
   * useMemo / event handlers don't violate the project's
   * `react-hooks/refs` rule. The map identity changes whenever a new
   * sprite finishes loading; `composite()` and the redraw effect read
   * from the state value directly.
   */
  const [sprites, setSprites] = useState<Map<string, HTMLImageElement>>(
    () => new Map(),
  );

  const activeDragRef = useRef<{
    key: string;
    pointerId: number;
    initialOffset: PixelPoint;
    initialPointer: PixelPoint;
  } | null>(null);

  const jewelryById = useMemo(() => {
    const m = new Map<string, JewelryWire>();
    for (const j of jewelry) m.set(j.id, j);
    return m;
  }, [jewelry]);

  // ── Photo + landmarks pipeline ──────────────────────────────────
  const runDetection = useCallback(async () => {
    setStage({ kind: "loading-image" });
    setPlacements([]);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    try {
      await img.decode();
    } catch {
      setStage({ kind: "error", message: t.errors.load });
      return;
    }

    photoImgRef.current = img;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0);

    setStage({ kind: "loading-model" });

    let outcome: DetectionOutcome | null;
    try {
      outcome = await detectFacePlacements(
        img,
        img.naturalWidth,
        img.naturalHeight,
      );
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : t.errors.load,
      });
      return;
    }

    if (!outcome) {
      setStage({ kind: "error", message: t.errors.noFace });
      return;
    }

    setPlacements(outcome.placements);
    setStage({ kind: "ready" });
  }, [photoUrl, t.errors.load, t.errors.noFace]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await runDetection();
      } catch (err) {
        if (cancelled) return;
        setStage({
          kind: "error",
          message: err instanceof Error ? err.message : t.errors.load,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runDetection, t.errors.load]);

  // ── Sprite preload ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    for (const jewelryId of Object.values(equippedBySlug)) {
      if (sprites.has(jewelryId)) continue;
      const j = jewelryById.get(jewelryId);
      if (!j?.spriteUrl) continue;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = j.spriteUrl;
      img.onload = () => {
        if (cancelled) return;
        setSprites((prev) => {
          if (prev.has(jewelryId)) return prev;
          const next = new Map(prev);
          next.set(jewelryId, img);
          return next;
        });
      };
      img.onerror = () => {
        if (cancelled) return;
        setSprites((prev) => {
          if (prev.has(jewelryId)) return prev;
          const next = new Map(prev);
          next.set(jewelryId, img);
          return next;
        });
      };
    }
    return () => {
      cancelled = true;
    };
  }, [equippedBySlug, jewelryById, sprites]);

  // ── Redraw ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stage.kind !== "ready") return;
    const canvas = canvasRef.current;
    const photo = photoImgRef.current;
    if (!canvas || !photo) return;

    if (debugDots) {
      drawDebugDots(canvas, photo, placements);
      return;
    }

    composite(
      canvas,
      photo,
      placements,
      equippedBySlug,
      sprites,
      dragOffsets,
    );
  }, [
    stage,
    placements,
    equippedBySlug,
    dragOffsets,
    sprites,
    debugDots,
  ]);

  // ── Drag-to-nudge ────────────────────────────────────────────────
  const pointerToImage = useCallback((e: React.PointerEvent): PixelPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const iw = canvas.width;
    const ih = canvas.height;
    const scale = Math.min(cw / iw, ch / ih);
    const dispW = iw * scale;
    const dispH = ih * scale;
    const offsetX = (cw - dispW) / 2;
    const offsetY = (ch - dispH) / 2;
    const localX = e.clientX - rect.left - offsetX;
    const localY = e.clientY - rect.top - offsetY;
    return { x: localX / scale, y: localY / scale };
  }, []);

  const hitTest = useCallback(
    (point: PixelPoint): { anchorSlug: string; jewelryId: string } | null => {
      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i];
        const jewelryId = equippedBySlug[p.anchorSlug];
        if (!jewelryId) continue;
        const sprite = sprites.get(jewelryId);
        if (!sprite || !sprite.complete) continue;

        const cfg = LITE_ANCHORS_BY_SLUG.get(p.anchorSlug);
        const widthFrac = cfg?.spriteWidthFrac ?? 0.04;
        const drawW = Math.max(8, widthFrac * p.faceBboxWidth);
        const aspect =
          sprite.naturalHeight > 0 && sprite.naturalWidth > 0
            ? sprite.naturalHeight / sprite.naturalWidth
            : 1;
        const drawH = drawW * aspect;

        const offset = dragOffsets[dragKey(p.anchorSlug, jewelryId)];
        const cx = p.pixel.x + (offset?.x ?? 0);
        const cy = p.pixel.y + (offset?.y ?? 0);

        if (
          point.x >= cx - drawW / 2 &&
          point.x <= cx + drawW / 2 &&
          point.y >= cy - drawH / 2 &&
          point.y <= cy + drawH / 2
        ) {
          return { anchorSlug: p.anchorSlug, jewelryId };
        }
      }
      return null;
    },
    [placements, equippedBySlug, dragOffsets, sprites],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (stage.kind !== "ready") return;
      const point = pointerToImage(e);
      const hit = hitTest(point);
      if (!hit) return;

      const key = dragKey(hit.anchorSlug, hit.jewelryId);
      const initialOffset = dragOffsets[key] ?? { x: 0, y: 0 };
      activeDragRef.current = {
        key,
        pointerId: e.pointerId,
        initialOffset,
        initialPointer: point,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [stage, pointerToImage, hitTest, dragOffsets],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = activeDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const point = pointerToImage(e);
      const dx = point.x - drag.initialPointer.x;
      const dy = point.y - drag.initialPointer.y;
      onUpdateOffset(drag.key, {
        x: drag.initialOffset.x + dx,
        y: drag.initialOffset.y + dy,
      });
    },
    [pointerToImage, onUpdateOffset],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    activeDragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  const handleSaveImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveToImage(canvas, buildTryOnFilename());
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-2xl bg-card object-contain"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {stage.kind === "ready" && (
        <button
          type="button"
          onClick={handleSaveImage}
          className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-line bg-page/85 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur transition-colors hover:border-primary hover:text-primary"
          title={catalogStrings.liteMode.save.hint}
        >
          ↓ <span>{catalogStrings.liteMode.save.button}</span>
        </button>
      )}

      {(stage.kind === "loading-image" || stage.kind === "loading-model") && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-page/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full border border-line bg-page px-4 py-2 text-sm text-ink">
            <span
              className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary"
              aria-hidden
            />
            <span>{t.processing}</span>
          </div>
        </div>
      )}

      {stage.kind === "error" && (
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {stage.message}
        </div>
      )}
    </div>
  );
}
