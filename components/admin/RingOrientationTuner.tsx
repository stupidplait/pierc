"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { setBindingRotationOffset } from "@/lib/admin/jewelry-actions";
import { GHOST } from "@/components/admin/form/styles";

// Layer 3 of the ring-orientation system: a per-(piece × anchor) nudge on top of
// the automatic ring frame (Layers 1–2). The auto-orientation already faces a
// hoop forward at every anchor; this is the escape hatch for an asymmetric piece
// (clicker face / gem / charm) that needs to sit differently at a specific
// piercing. Saves JewelryAnchorBinding.rotationOffset via setBindingRotationOffset;
// the showroom honours it on the next render.
//
// Strings are inlined (not in lib/i18n/ru.ts) on purpose — this is an admin-only
// tool and ru.ts is Cyrillic-sensitive to edit; keeping them here avoids that risk.

export interface RingAnchorTune {
  anchorId: string;
  name: string;
  /** Current override, in degrees (0 when none set). */
  yawDeg: number;
  rollDeg: number;
}

const STEP = 15;
/** Normalise to (−180, 180]. */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function RingOrientationTuner({
  jewelryId,
  anchors,
}: {
  jewelryId: string;
  anchors: RingAnchorTune[];
}) {
  if (anchors.length === 0) return null;
  return (
    <div className="border-t border-line pt-6">
      <h3 className="mb-1 text-sm font-medium text-ink">
        Поворот кольца по точкам
      </h3>
      <p className="mb-4 max-w-prose text-sm text-mute">
        Тонкая подстройка ориентации обруча на каждой точке, поверх
        авто-разворота. «Рыскание» поворачивает кольцо лицом к зрителю, «крен» —
        вокруг оси отверстия. Результат виден в шоуруме каталога.
      </p>
      <ul className="flex flex-col gap-3">
        {anchors.map((a) => (
          <RingRow key={a.anchorId} jewelryId={jewelryId} anchor={a} />
        ))}
      </ul>
    </div>
  );
}

function RingRow({
  jewelryId,
  anchor,
}: {
  jewelryId: string;
  anchor: RingAnchorTune;
}) {
  const baseYaw = Math.round(anchor.yawDeg);
  const baseRoll = Math.round(anchor.rollDeg);
  const [yaw, setYaw] = useState(baseYaw);
  const [roll, setRoll] = useState(baseRoll);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const dirty = yaw !== baseYaw || roll !== baseRoll;

  const save = (y: number, z: number) => {
    start(async () => {
      const fd = new FormData();
      fd.set("jewelryId", jewelryId);
      fd.set("anchorId", anchor.anchorId);
      fd.set("xDeg", "0");
      fd.set("yDeg", String(y));
      fd.set("zDeg", String(z));
      const res = await setBindingRotationOffset(fd);
      setStatus(res?.ok ? (res.message ?? "Сохранено") : (res?.error ?? "Ошибка"));
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2">
      <span className="min-w-28 flex-1 text-sm text-ink">{anchor.name}</span>
      <Stepper label="Рыскание" value={yaw} onChange={setYaw} disabled={pending} />
      <Stepper label="Крен" value={roll} onChange={setRoll} disabled={pending} />
      <button
        type="button"
        className={`${GHOST} px-2`}
        disabled={pending}
        title="Сбросить к авто-развороту"
        onClick={() => {
          setYaw(0);
          setRoll(0);
          save(0, 0);
        }}
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={`${GHOST} px-3`}
        disabled={pending || !dirty}
        onClick={() => save(yaw, roll)}
      >
        {pending ? "…" : "Сохранить"}
      </button>
      {status ? (
        <span className="w-full text-xs text-mute">{status}</span>
      ) : null}
    </li>
  );
}

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={`${GHOST} px-2`}
        disabled={disabled}
        aria-label={`${label} минус`}
        onClick={() => onChange(wrap(value - STEP))}
      >
        −
      </button>
      <span className="w-16 text-center text-xs leading-tight text-mute">
        {label}
        <br />
        <span className="tabular-nums text-ink">{value}°</span>
      </span>
      <button
        type="button"
        className={`${GHOST} px-2`}
        disabled={disabled}
        aria-label={`${label} плюс`}
        onClick={() => onChange(wrap(value + STEP))}
      >
        +
      </button>
    </span>
  );
}
