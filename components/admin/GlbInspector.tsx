"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Loader2, Check, Undo2, Rotate3d, Crosshair } from "lucide-react";
import { Euler, Quaternion } from "three";
import { GlbPreview, type GlbStats } from "@/components/admin/GlbPreview";
import { ScaleField } from "@/components/admin/ScaleField";
import { nudgeJewelryGlb, setJewelryAttachPoint } from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";


// Wrap to (−180, 180] so the readout stays readable.
function wrapDeg(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

/**
 * GlbInspector — the model viewer paired with a facts readout + an actions
 * column, so the wide model panel reads as a proper asset inspector instead of
 * a lone square with dead space to its right.
 *
 *   ┌─────────────┬──────────────────────┐
 *   │             │  Полигоны   1 234     │
 *   │   preview   │  Вершины    2 468     │  ← geometry tally (from the GLB)
 *   │  (orbit/    │  Меши       3         │
 *   │   zoom)     │  Размер     1.2 МБ    │  ← file size (HEAD Content-Length)
 *   │             ├──────────────────────┤
 *   │             │  [actions: open /     │  ← caller-supplied
 *   └─────────────┴──   approve / delete] ─┘
 *
 * Stacks vertically on narrow panels, side-by-side from `sm`.
 */
export function GlbInspector({
  url,
  label,
  highlight,
  actions,
  jewelryId,
  scale,
  scaleJewelryId,
  candidateJobId,
}: {
  url: string;
  /** Optional caption above the preview (e.g. "Новая — на проверке"). */
  label?: string;
  /** Ring the preview in accent (the candidate under review). */
  highlight?: boolean;
  /** Buttons/links for this model — rendered under the facts. */
  actions?: React.ReactNode;
  /** When set, show the live rotate/flip orientation controls + attach marker.
   *  Parent should pass `key={url}` so a re-saved model resets the local rotation. */
  jewelryId?: string;
  /** Per-piece render scale (Jewelry.glbScale) — shown in the readout. */
  scale?: number;
  /** When set (with `scale`), the scale readout becomes an editable control
   *  (auto-suggest + manual input) that writes Jewelry.glbScale. */
  scaleJewelryId?: string;
  /** Forwarded to the scale control's auto-suggest so it measures THIS generation
   *  candidate instead of the published model. */
  candidateJobId?: string;
}) {
  const t = ru.admin.jewelry.model;
  const [stats, setStats] = useState<GlbStats | null>(null);

  // Two edit modes for the model (only when jewelryId is set):
  //   • rotate — per-axis orientation nudge (camera locked face-on), baked on Save.
  //   • pick   — click the model to set attach:primary exactly (orbit free), saved
  //              via setJewelryAttachPoint. The reliability backstop when auto-
  //              placement (geometry / AI) put the point wrong.
  const [mode, setMode] = useState<"rotate" | "pick">("rotate");

  // Live orientation nudge (client-side; baked on Save). Per-axis degrees, in the
  // fixed face-on view: X = tilt up/down, Y = turn left/right, Z = spin in-plane.
  const [rot, setRot] = useState({ x: 0, y: 0, z: 0 });
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Picked attach point (local frame; null until the admin clicks the model).
  const [picked, setPicked] = useState<[number, number, number] | null>(null);
  const [savingPick, startSavePick] = useTransition();
  const [pickError, setPickError] = useState<string | null>(null);

  const finalQ = useMemo(
    () =>
      new Quaternion().setFromEuler(
        new Euler(
          (rot.x * Math.PI) / 180,
          (rot.y * Math.PI) / 180,
          (rot.z * Math.PI) / 180,
          "XYZ",
        ),
      ),
    [rot],
  );
  const dirty = rot.x !== 0 || rot.y !== 0 || rot.z !== 0;

  const bump = (axis: "x" | "y" | "z", delta: number) =>
    setRot((r) => ({ ...r, [axis]: wrapDeg(r[axis] + delta) }));
  const reset = () => {
    setRot({ x: 0, y: 0, z: 0 });
    setError(null);
  };

  const save = () => {
    if (!jewelryId) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", jewelryId);
    fd.set("qx", String(finalQ.x));
    fd.set("qy", String(finalQ.y));
    fd.set("qz", String(finalQ.z));
    fd.set("qw", String(finalQ.w));
    startSave(async () => {
      const res = await nudgeJewelryGlb(fd);
      // On success the parent re-renders with a new url and (keyed by it)
      // remounts this component, resetting the local rotation to identity.
      if (res && res.ok === false) setError(res.error);
    });
  };

  const savePick = () => {
    if (!jewelryId || !picked) return;
    setPickError(null);
    const fd = new FormData();
    fd.set("id", jewelryId);
    fd.set("x", String(picked[0]));
    fd.set("y", String(picked[1]));
    fd.set("z", String(picked[2]));
    startSavePick(async () => {
      const res = await setJewelryAttachPoint(fd);
      // On success the parent remounts (new url) → picked resets to null.
      if (res && res.ok === false) setPickError(res.error);
    });
  };
  // (Дропнули HEAD-проба размера файла: лишний запрос к blob на каждый монтаж
  // превью — а это повышало шанс словить Vercel Security Checkpoint. Полигоны/
  // вершины и так читаются из загруженного GLB без отдельного запроса.)

  // Editable scale-control props (null when scale isn't editable in this inspector).
  const scaleProps =
    scale != null && scaleJewelryId
      ? { jewelryId: scaleJewelryId, currentScale: scale, candidateJobId }
      : null;

  const controlsEl = jewelryId ? (
    <div className="flex flex-col gap-3">
      <ModeToggle
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setPickError(null);
        }}
      />
      {mode === "rotate" ? (
        <OrientationControls
          rot={rot}
          bump={bump}
          reset={reset}
          save={save}
          dirty={dirty}
          saving={saving}
          error={error}
        />
      ) : (
        <PickControls
          picked={picked}
          clear={() => {
            setPicked(null);
            setPickError(null);
          }}
          save={savePick}
          saving={savingPick}
          error={pickError}
        />
      )}
    </div>
  ) : null;

  return (
    <figure className="flex flex-col gap-1.5">
      {label ? (
        <figcaption
          className={`text-xs font-medium ${highlight ? "text-accent" : "text-mute"}`}
        >
          {label}
        </figcaption>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="w-full sm:max-w-xs">
          <GlbPreview
            url={url}
            onStats={setStats}
            className={highlight ? "ring-1 ring-accent/40" : ""}
            quaternion={
              jewelryId && mode === "rotate"
                ? (finalQ.toArray() as [number, number, number, number])
                : undefined
            }
            showAttach={!!jewelryId}
            lockCamera={!!jewelryId && mode === "rotate"}
            pickMode={!!jewelryId && mode === "pick"}
            onPick={setPicked}
            pickedPoint={picked}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <Fact label={t.statTriangles} value={fmt(stats?.triangles)} />
            <Fact label={t.statVertices} value={fmt(stats?.vertices)} />
            <Fact label={t.statMeshes} value={fmt(stats?.meshes)} />
            <Fact label={t.statMaterials} value={fmt(stats?.materials)} />
            {/* Scale as an editable cell in the facts grid; plain value when this
                inspector can't write it (no scaleJewelryId). */}
            {scaleProps ? (
              <ScaleField {...scaleProps} compact />
            ) : scale != null ? (
              <Fact label="Масштаб" value={scale.toFixed(4)} />
            ) : null}
          </dl>

          {controlsEl}

          {actions ? (
            <div className="mt-auto flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </figure>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

// "—" while the GLB is still loading (stats undefined), grouped thousands once known.
function fmt(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}

const STEP_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/15 text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50";

// Selectable rotation increments: 1° for precise alignment, 15° for general
// nudging, 90° to flip a wrong-facing model in one or two clicks.
const STEP_SIZES = [1, 15, 90] as const;

/** Per-axis orientation controls: each axis has −/+ buttons that rotate the
 *  model by a fixed step (camera is locked face-on, so X=tilt, Y=turn, Z=spin).
 *  A single Save bakes the exact pose into the GLB. */
function OrientationControls({
  rot,
  bump,
  reset,
  save,
  dirty,
  saving,
  error,
}: {
  rot: { x: number; y: number; z: number };
  bump: (axis: "x" | "y" | "z", delta: number) => void;
  reset: () => void;
  save: () => void;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}) {
  const axes: { key: "x" | "y" | "z"; label: string }[] = [
    { key: "x", label: "Наклон (X)" },
    { key: "y", label: "Поворот (Y)" },
    { key: "z", label: "Крен (Z)" },
  ];
  const [step, setStep] = useState(15);
  return (
    <div className="flex flex-col gap-2">
      {/* Step size — 1° to align precisely, 90° to flip a wrong-facing model fast. */}
      <div className="flex items-center gap-1.5 text-xs text-mute">
        <span>Шаг:</span>
        {STEP_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs tabular-nums transition-colors ${
              step === s
                ? "border-ink bg-ink text-bg"
                : "border-ink/15 text-ink hover:border-ink/40"
            }`}
          >
            {s}°
          </button>
        ))}
      </div>
      {axes.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 text-xs text-mute">
          <span className="w-20 shrink-0">{label}</span>
          <button
            type="button"
            className={STEP_BTN}
            onClick={() => bump(key, -step)}
            disabled={saving}
            aria-label={`${label} −${step}°`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 shrink-0 text-center tabular-nums text-ink">
            {rot[key]}°
          </span>
          <button
            type="button"
            className={STEP_BTN}
            onClick={() => bump(key, step)}
            disabled={saving}
            aria-label={`${label} +${step}°`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ))}

      {dirty ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Сохранить
          </button>
          <button
            type="button"
            className={`${STEP_BTN} h-9 w-9 border-transparent text-mute hover:text-ink`}
            onClick={reset}
            disabled={saving}
            title="Сбросить"
            aria-label="Сбросить ориентацию"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <p className="text-[11px] leading-snug text-mute">
        Розовая точка — место крепления к пирсингу, зелёная ось — наружу от тела,
        серый диск — кожа. Украшение должно «смотреть» вдоль зелёной оси.
        Поворачивайте по осям до нужного вида и нажмите «Сохранить».
      </p>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}

/** Switch between the rotate (orientation nudge) and pick (set attach point) modes. */
function ModeToggle({
  mode,
  setMode,
}: {
  mode: "rotate" | "pick";
  setMode: (m: "rotate" | "pick") => void;
}) {
  const opts: { m: "rotate" | "pick"; icon: typeof Rotate3d; label: string }[] = [
    { m: "rotate", icon: Rotate3d, label: "Повернуть" },
    { m: "pick", icon: Crosshair, label: "Поставить точку" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {opts.map(({ m, icon: Icon, label }) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
            mode === m
              ? "border-ink bg-ink text-bg"
              : "border-ink/15 text-ink hover:border-ink/40"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Click-to-place attach-point controls: instructions, the picked coords, and a
 *  Save that bakes the point into the GLB (setJewelryAttachPoint). */
function PickControls({
  picked,
  clear,
  save,
  saving,
  error,
}: {
  picked: [number, number, number] | null;
  clear: () => void;
  save: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-snug text-mute">
        Покрутите модель и кликните по месту крепления к пирсингу — голубая точка.
        Затем нажмите «Сохранить».
      </p>
      {picked ? (
        <p className="text-[11px] tabular-nums text-mute">
          Точка: {picked.map((n) => n.toFixed(4)).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!picked || saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-bg transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Сохранить
        </button>
        {picked ? (
          <button
            type="button"
            className={`${STEP_BTN} h-9 w-9 border-transparent text-mute hover:text-ink`}
            onClick={clear}
            disabled={saving}
            title="Сбросить"
            aria-label="Сбросить точку"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}
