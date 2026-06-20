"use client";

import { useActionState, useState } from "react";
import { Loader2, Hammer } from "lucide-react";
import {
  generateParametricJewelryGlb,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import {
  PARAMETRIC_SHAPES,
  MATERIAL_COLOR_OPTIONS,
  GEM_COLOR_OPTIONS,
  TOP_SHAPE_OPTIONS,
  type ParametricShape,
} from "@/lib/admin/parametric-shapes";

const FIELD =
  "h-9 w-full rounded-lg border border-ink/15 bg-bg px-2.5 text-sm text-ink outline-none transition-colors focus:border-ink/40";
const LABEL = "flex flex-col gap-1 text-xs text-mute";

/**
 * Self-serve parametric finding generator — builds a GLB straight from a form
 * (shape + dimensions + material/gem), no Blender. Posts to
 * `generateParametricJewelryGlb`, which constructs the mesh with
 * lib/admin/parametric-glb.ts, compresses it, and attaches it to the piece at
 * real-metre scale (glbScale = 1). The high-fidelity Blender pipeline remains the
 * alternative for hero pieces.
 */
export function ParametricGenerator({
  jewelryId,
  blobConfigured,
}: {
  jewelryId: string;
  blobConfigured: boolean;
}) {
  const [shape, setShape] = useState<ParametricShape>(
    PARAMETRIC_SHAPES[0].shape,
  );
  const [topShape, setTopShape] = useState("ball");
  const [hybrid, setHybrid] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    generateParametricJewelryGlb,
    undefined,
  );

  const def = PARAMETRIC_SHAPES.find((d) => d.shape === shape)!;
  // Hybrid (parametric base + the piece's current AI model as the decorative top)
  // applies to post-type shapes only.
  const supportsHybrid = shape === "labret_stud" || shape === "nose_stud_l";

  // Reset selectors in the change handler (not an effect) so switching shapes never
  // leaves a stale value like "disc".
  const onShapeChange = (next: ParametricShape) => {
    setShape(next);
    setTopShape("ball");
    setHybrid(false);
  };

  if (!blobConfigured) {
    return (
      <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
        Параметрическая генерация недоступна: не настроено хранилище Vercel Blob
        (BLOB_READ_WRITE_TOKEN).
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={jewelryId} />
      <p className="max-w-prose text-sm text-mute">
        Соберите модель из параметров — без Blender. Размеры в миллиметрах;
        масштаб точный (1:1). Высокодетальный путь через Blender остаётся для
        особых изделий.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className={LABEL}>
          Форма
          <select
            name="shape"
            value={shape}
            onChange={(e) => onShapeChange(e.target.value as ParametricShape)}
            className={FIELD}
          >
            {PARAMETRIC_SHAPES.map((d) => (
              <option key={d.shape} value={d.shape}>
                {d.labelRu}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          Материал
          <select name="materialColor" defaultValue="titanium" className={FIELD}>
            {MATERIAL_COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelRu}
              </option>
            ))}
          </select>
        </label>

        {/* Remount the per-shape fields when the shape changes so number inputs
            pick up the new shape's defaults. */}
        <div key={shape} className="contents">
          {def.fields.map((f) => {
            // In hybrid mode the AI model is the top, so its shape/gem fields drop
            // out (the top size still applies — it scales the AI top).
            if (hybrid && (f.kind === "topShape" || f.kind === "gemColor")) {
              return null;
            }
            if (f.kind === "number") {
              return (
                <label key={f.key} className={LABEL}>
                  {f.labelRu}
                  <input
                    type="number"
                    name={f.key}
                    defaultValue={f.default ?? ""}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    className={`${FIELD} tabular-nums`}
                  />
                </label>
              );
            }
            if (f.kind === "topShape") {
              const opts = TOP_SHAPE_OPTIONS.filter((o) =>
                o.shapes.includes(shape),
              );
              return (
                <label key={f.key} className={LABEL}>
                  {f.labelRu}
                  <select
                    name="topShape"
                    value={topShape}
                    onChange={(e) => setTopShape(e.target.value)}
                    className={FIELD}
                  >
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.labelRu}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (f.kind === "gemColor") {
              if (topShape !== "gem") return null;
              return (
                <label key={f.key} className={LABEL}>
                  {f.labelRu}
                  <select name="topGemColor" defaultValue="clear" className={FIELD}>
                    {GEM_COLOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.labelRu}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return null;
          })}
        </div>
      </div>

      {supportsHybrid ? (
        <label className="flex items-start gap-2 text-sm text-mute">
          <input
            type="checkbox"
            checked={hybrid}
            onChange={(e) => setHybrid(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            ИИ-верх: надеть текущую ИИ-модель украшения как декоративный верх на
            точную параметрическую основу (размер — поле «Размер верха»).
          </span>
        </label>
      ) : null}
      {hybrid ? <input type="hidden" name="hybrid" value="1" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Hammer className="h-4 w-4" />
          )}
          Построить модель
        </button>
        {state?.ok === false ? (
          <p className="text-sm text-error">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-sm text-accent">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
