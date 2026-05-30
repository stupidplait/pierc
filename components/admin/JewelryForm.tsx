"use client";

import { useActionState, useState } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import {
  Field,
  InlineStatus,
  NumberField,
  Select,
  SubmitPill,
  TextArea,
  Toggle,
} from "@/components/admin/form/atelier";
import { CARD, FIELD_H, LABEL } from "@/components/admin/form/styles";
import {
  upsertJewelry,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import {
  ru,
  jewelryStatusLabels,
  jewelryTypeLabels,
  bodyPlaceLabels,
  bodyPlaceOrder,
} from "@/lib/i18n/ru";
import type { BodyPlace, JewelryType } from "@/lib/catalog/types";
import { isSingleAnchorType } from "@/lib/catalog/types";

interface CategoryOption {
  id: string;
  name: string;
}

interface AnchorOption {
  id: string;
  slug: string;
  name: string;
  place: BodyPlace;
}

interface JewelryLike {
  id?: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  type?: JewelryType;
  material?: string;
  gauge?: number | null;
  size?: number | null;
  color?: string | null;
  stones?: string | null;
  price?: number | string | null;
  inStock?: number;
  glbUrl?: string | null;
  glbThumbUrl?: string | null;
  status?: keyof typeof jewelryStatusLabels;
  featured?: boolean;
  anchorIds?: string[];
}

interface JewelryFormProps {
  initial?: JewelryLike;
  categories: CategoryOption[];
  anchors: AnchorOption[];
  isNew?: boolean;
}

// Same elevated panel + layered shadow the settings / content cards use, so
// each editor group reads as one of the same Steel Atelier set.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

/**
 * Catalog editor — the create/edit form for a single jewelry piece, rebuilt on
 * the Steel Atelier form kit so it reads as part of the same family as the
 * redesigned /admin settings and content editors: stacked elevated cards, each
 * with a display heading, hairline fields over a barely-there ink wash, the ink
 * save pill, and a blur-focus entrance. Replaces the old stock-form look that
 * leant on loud magenta primaries and `bg-page` inputs.
 */
export function JewelryForm({
  initial,
  categories,
  anchors,
  isNew = false,
}: JewelryFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertJewelry,
    undefined,
  );
  // Type drives the anchor hint live, so the admin sees what the anchors below
  // mean as they switch between single-point and multi-anchor pieces.
  const [type, setType] = useState<JewelryType>(initial?.type ?? "STUD");

  const t = ru.admin.jewelry;
  const f = t.fields;
  const ph = t.placeholders;
  const s = t.sections;
  const selectedAnchors = new Set(initial?.anchorIds ?? []);

  // Group anchors by place for clearer scanning.
  const grouped = {} as Record<BodyPlace, AnchorOption[]>;
  for (const place of bodyPlaceOrder) grouped[place] = [];
  for (const a of anchors) grouped[a.place].push(a);

  return (
    <MotionConfig reducedMotion="user">
      <form action={action}>
        {initial?.id ? (
          <input type="hidden" name="id" value={initial.id} />
        ) : null}

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-6"
        >
          {/* ── Attributes ─────────────────────────────────────────── */}
          <motion.section variants={item} className={`${CARD} p-6 sm:p-8`}>
            <div className="mb-7">
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                {s.attributes}
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="name"
                label={f.name}
                required
                defaultValue={initial?.name}
                placeholder={ph.name}
                full
              />
              <TextArea
                name="description"
                label={f.description}
                defaultValue={initial?.description}
                rows={3}
                placeholder={ph.description}
                full
              />

              <Select
                name="categoryId"
                label={f.category}
                required
                defaultValue={initial?.categoryId}
                placeholder="—"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />

              {/* Type carries a live hint, so it stays a hand-rolled control
                  rather than the plain kit Select. */}
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>{f.type}</span>
                <select
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as JewelryType)}
                  className={FIELD_H}
                >
                  {(
                    Object.entries(jewelryTypeLabels) as Array<
                      [JewelryType, string]
                    >
                  ).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className="text-xs leading-relaxed text-mute">
                  {isSingleAnchorType(type) ? f.typeHintCompat : f.typeHintFixed}
                </span>
              </label>

              <Field
                name="material"
                label={f.material}
                required
                defaultValue={initial?.material}
                placeholder={ph.material}
              />
              <Field
                name="color"
                label={f.color}
                defaultValue={initial?.color}
                placeholder={ph.color}
              />

              <NumberField
                name="gauge"
                label={f.gauge}
                defaultValue={initial?.gauge ?? ""}
                step="0.1"
                min={0}
              />
              <NumberField
                name="size"
                label={f.size}
                defaultValue={initial?.size ?? ""}
                step="0.1"
                min={0}
              />

              <Field
                name="stones"
                label={f.stones}
                defaultValue={initial?.stones}
                placeholder={ph.stones}
              />
              <NumberField
                name="price"
                label={f.price}
                defaultValue={initial?.price?.toString() ?? ""}
                step="0.01"
                min={0}
              />
              <NumberField
                name="inStock"
                label={f.inStock}
                defaultValue={initial?.inStock ?? 0}
                min={0}
              />
            </div>
          </motion.section>

          {/* ── Anchors ────────────────────────────────────────────── */}
          <motion.section variants={item} className={`${CARD} p-6 sm:p-8`}>
            <div className="mb-7">
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                {s.anchors}
              </h2>
            </div>

            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
              {bodyPlaceOrder.map((place) =>
                grouped[place].length > 0 ? (
                  <div key={place} className="flex flex-col gap-2">
                    <h3 className="text-xs uppercase tracking-[0.15em] text-mute">
                      {bodyPlaceLabels[place]}
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      {grouped[place].map((a) => (
                        <li key={a.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-ink/5">
                            <input
                              type="checkbox"
                              name="anchorIds"
                              value={a.id}
                              defaultChecked={selectedAnchors.has(a.id)}
                              className="size-4 shrink-0 rounded border-ink/25 bg-ink/5 accent-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                            />
                            <span>{a.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </motion.section>

          {/* ── 3D model + status ──────────────────────────────────── */}
          <motion.section variants={item} className={`${CARD} p-6 sm:p-8`}>
            <div className="mb-7">
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                {s.modelAndStatus}
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="glbUrl"
                label={f.glbUrl}
                defaultValue={initial?.glbUrl}
                placeholder="https://…/model.glb"
                full
              />
              <Field
                name="glbThumbUrl"
                label={f.glbThumbUrl}
                defaultValue={initial?.glbThumbUrl}
                placeholder={ph.glbThumbUrl}
                full
              />
              <Select
                name="status"
                label={f.status}
                defaultValue={initial?.status ?? "DRAFT"}
                options={Object.entries(jewelryStatusLabels).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
              />
              <Toggle
                name="featured"
                label={f.featured}
                defaultChecked={initial?.featured ?? false}
              />
            </div>
          </motion.section>

          {/* ── Save ───────────────────────────────────────────────── */}
          <motion.div
            variants={item}
            className="flex flex-wrap items-center gap-4"
          >
            <SubmitPill pending={pending}>
              {pending ? "…" : isNew ? t.create : t.save}
            </SubmitPill>
            <InlineStatus state={state} />
          </motion.div>
        </motion.div>
      </form>
    </MotionConfig>
  );
}
