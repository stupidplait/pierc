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
import { InlineStatus } from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Label } from "@/components/shadcn/ui/label";
import { Switch } from "@/components/shadcn/ui/switch";
import { Button } from "@/components/shadcn/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { Combobox } from "@/components/shadcn/Combobox";
import { MultiCombobox } from "@/components/shadcn/MultiCombobox";
import { AnchorPicker } from "@/components/admin/AnchorPicker";
import { upsertJewelry, type ActionState } from "@/lib/admin/jewelry-actions";
import {
  parseJewelryFormData,
  fieldErrorsFromZod,
  firstErrorField,
  FIELD_TAB,
  VALIDATION_SUMMARY,
  type FieldErrors,
  type JewelryField,
} from "@/lib/admin/jewelry-schema";
import {
  ru,
  jewelryStatusLabels,
  jewelryTypeLabels,
  bodyPlaceLabels,
} from "@/lib/i18n/ru";
import { MATERIALS, COLORS, STONES } from "@/lib/catalog/options";
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
  status?: keyof typeof jewelryStatusLabels;
  featured?: boolean;
  anchorIds?: string[];
}

interface JewelryFormProps {
  initial?: JewelryLike;
  categories: CategoryOption[];
  anchors: AnchorOption[];
  /** Photo uploader + grid — rendered by the server page (own server actions). */
  photosSlot?: React.ReactNode;
  /** 3D model manager (upload + auto-gen) — rendered by the server page. */
  modelSlot?: React.ReactNode;
}

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

type Tab = "attributes" | "anchors" | "photos" | "model";

// Media panels (photos, 3D) render outside the editor <form> because their own
// server-action <form>s can't legally nest. Their tabs hide the metadata save
// bar, since each media action self-submits.
const FORM_TABS: Tab[] = ["attributes", "anchors"];

/** Inline validation message, shown under the control it belongs to. */
function FieldError({
  id,
  message,
  className = "",
}: {
  id: string;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className={`text-xs text-error ${className}`}>
      {message}
    </span>
  );
}

/** Label + control, stacked. Wraps a shadcn control, associating its `id`. */
function LabeledField({
  label,
  htmlFor,
  children,
  full,
  error,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  full?: boolean;
  error?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldError id={`${htmlFor}-error`} message={error} />
    </div>
  );
}

/**
 * Catalog editor — the create/edit form for a single jewelry piece. Built
 * entirely on shadcn controls re-themed to the Steel Atelier vocabulary:
 * Inputs/Textarea for free text, Selects for the fixed enums (category / type /
 * status), type-to-filter Comboboxes for material & colour, a MultiCombobox for
 * stones, a Switch for the featured flag, a grouped searchable anchor picker,
 * and a Button save action. The elevated-card layout + blur-focus entrance are
 * kept from the admin form family.
 */
export function JewelryForm({
  initial,
  categories,
  anchors,
  photosSlot,
  modelSlot,
}: JewelryFormProps) {
  // Type stays controlled so the anchor picker knows whether anchors are an
  // ordered endpoint sequence (fixed types) or an interchangeable compat list.
  const [type, setType] = useState<JewelryType>(initial?.type ?? "STUD");
  const [tab, setTab] = useState<Tab>("attributes");
  // Fields the user has touched since the last submit — their error is hidden
  // until they submit again (live-clear), so a fixed field stops nagging.
  const [cleared, setCleared] = useState<Set<JewelryField>>(() => new Set());

  // Panels stay mounted (CSS-hidden) so field values survive tab switches; a
  // field that errors on a hidden panel would otherwise show no feedback, so we
  // switch to the panel owning the first error.
  const flipToFirstError = (errors: FieldErrors) => {
    const first = firstErrorField(errors);
    if (first) setTab(FIELD_TAB[first]);
  };

  // Native browser validation is off (`noValidate`); we run the *same* Zod
  // schema the server action runs, so the two never disagree. On a client-side
  // failure we never hit the network. The server still re-validates as the
  // authority and can return its own `fieldErrors`.
  const validatedAction = async (
    _prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> => {
    setCleared(new Set()); // every field's error is eligible to re-show
    const parsed = parseJewelryFormData(formData);
    if (!parsed.success) {
      const fieldErrors = fieldErrorsFromZod(parsed.error);
      flipToFirstError(fieldErrors);
      return { ok: false, error: VALIDATION_SUMMARY, fieldErrors };
    }
    const result = await upsertJewelry(_prev, formData);
    if (result && !result.ok && result.fieldErrors) {
      flipToFirstError(result.fieldErrors);
    }
    return result;
  };

  const [state, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  const fieldErrors: FieldErrors =
    state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const errorFor = (field: JewelryField): string | undefined =>
    cleared.has(field) ? undefined : fieldErrors[field];
  const clearError = (field: JewelryField) =>
    setCleared((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });

  const t = ru.admin.jewelry;
  const f = t.fields;
  const ph = t.placeholders;
  const s = t.sections;
  const pk = t.pickers;
  const ap = t.anchorPicker;

  const ordered = !isSingleAnchorType(type);
  const anchorChoices = anchors.map((a) => ({
    id: a.id,
    name: a.name,
    place: bodyPlaceLabels[a.place],
  }));

  const tabs: { key: Tab; label: string }[] = [
    { key: "attributes", label: t.tabs.attributes },
    { key: "anchors", label: t.tabs.anchors },
    { key: "photos", label: t.tabs.photos },
    { key: "model", label: t.tabs.model },
  ];

  const onFormTab = FORM_TABS.includes(tab);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── Tab bar ────────────────────────────────────────────── */}
        <motion.div
          variants={item}
          aria-label={t.title}
          className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-card p-1"
        >
          {tabs.map((it) => {
            const active = it.key === tab;
            return (
              <button
                key={it.key}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setTab(it.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                }`}
              >
                {it.label}
              </button>
            );
          })}
        </motion.div>

        {/* ── Editor form (metadata tabs: attributes + anchors) ────── */}
        {/* Stays mounted on media tabs (display:none) so field values and
            native validation survive; just dropped from the flex flow to
            avoid a doubled gap above the photo/model panels. */}
        <motion.form
          variants={item}
          action={action}
          noValidate
          hidden={!onFormTab}
          className="flex flex-col gap-6"
        >
          {initial?.id ? (
            <input type="hidden" name="id" value={initial.id} />
          ) : null}

          {/* ── Main info ──────────────────────────────────────────── */}
          <motion.section
            variants={item}
            data-tab="attributes"
            hidden={tab !== "attributes"}
            className={`${CARD} p-6 sm:p-8`}
          >
            <div className="mb-7">
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                {s.attributes}
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <LabeledField
                label={f.name}
                htmlFor="name"
                full
                error={errorFor("name")}
              >
                <Input
                  id="name"
                  name="name"
                  defaultValue={initial?.name ?? ""}
                  placeholder={ph.name}
                  aria-invalid={!!errorFor("name")}
                  aria-describedby={errorFor("name") ? "name-error" : undefined}
                  onInput={() => clearError("name")}
                />
              </LabeledField>

              <LabeledField label={f.description} htmlFor="description" full>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={initial?.description ?? ""}
                  placeholder={ph.description}
                />
              </LabeledField>

              <LabeledField
                label={f.category}
                htmlFor="categoryId"
                error={errorFor("categoryId")}
              >
                <Select
                  name="categoryId"
                  defaultValue={initial?.categoryId}
                  onValueChange={() => clearError("categoryId")}
                >
                  <SelectTrigger
                    id="categoryId"
                    aria-invalid={!!errorFor("categoryId")}
                  >
                    <SelectValue placeholder={pk.category} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>

              <LabeledField label={f.type} htmlFor="type">
                <Select
                  name="type"
                  value={type}
                  onValueChange={(v) => {
                    setType(v as JewelryType);
                    clearError("anchorIds");
                  }}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(jewelryTypeLabels) as Array<[JewelryType, string]>
                    ).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>

              <LabeledField
                label={f.material}
                htmlFor="material"
                error={errorFor("material")}
              >
                <Combobox
                  id="material"
                  name="material"
                  options={MATERIALS}
                  defaultValue={initial?.material}
                  placeholder={ph.material}
                  searchPlaceholder={pk.search}
                  emptyText={pk.empty}
                  addLabel={pk.add}
                  allowCustom
                  invalid={!!errorFor("material")}
                  onChange={() => clearError("material")}
                />
              </LabeledField>

              <LabeledField label={f.color} htmlFor="color">
                <Combobox
                  id="color"
                  name="color"
                  options={COLORS}
                  defaultValue={initial?.color}
                  placeholder={ph.color}
                  searchPlaceholder={pk.search}
                  emptyText={pk.empty}
                  addLabel={pk.add}
                  allowCustom
                />
              </LabeledField>

              <LabeledField
                label={f.gauge}
                htmlFor="gauge"
                error={errorFor("gauge")}
              >
                <Input
                  id="gauge"
                  name="gauge"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  defaultValue={initial?.gauge ?? ""}
                  aria-invalid={!!errorFor("gauge")}
                  aria-describedby={errorFor("gauge") ? "gauge-error" : undefined}
                  onInput={() => clearError("gauge")}
                />
              </LabeledField>

              <LabeledField
                label={f.size}
                htmlFor="size"
                error={errorFor("size")}
              >
                <Input
                  id="size"
                  name="size"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  defaultValue={initial?.size ?? ""}
                  aria-invalid={!!errorFor("size")}
                  aria-describedby={errorFor("size") ? "size-error" : undefined}
                  onInput={() => clearError("size")}
                />
              </LabeledField>

              <LabeledField label={f.stones} htmlFor="stones" full>
                <MultiCombobox
                  id="stones"
                  name="stones"
                  options={STONES}
                  defaultValue={initial?.stones}
                  placeholder={ph.stones}
                  searchPlaceholder={pk.search}
                  emptyText={pk.empty}
                  addLabel={pk.add}
                  allowCustom
                />
              </LabeledField>

              <LabeledField
                label={f.price}
                htmlFor="price"
                error={errorFor("price")}
              >
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={initial?.price?.toString() ?? ""}
                  aria-invalid={!!errorFor("price")}
                  aria-describedby={errorFor("price") ? "price-error" : undefined}
                  onInput={() => clearError("price")}
                />
              </LabeledField>

              <LabeledField
                label={f.inStock}
                htmlFor="inStock"
                error={errorFor("inStock")}
              >
                <Input
                  id="inStock"
                  name="inStock"
                  type="number"
                  inputMode="numeric"
                  defaultValue={initial?.inStock ?? 0}
                  aria-invalid={!!errorFor("inStock")}
                  aria-describedby={
                    errorFor("inStock") ? "inStock-error" : undefined
                  }
                  onInput={() => clearError("inStock")}
                />
              </LabeledField>
            </div>

            {/* ── Publication (status + featured) ──────────────────── */}
            <div className="mt-8 border-t border-line pt-6">
              <div className="mb-5">
                <h3 className="text-sm font-medium text-ink">
                  {t.publication.heading}
                </h3>
                <p className="mt-1 max-w-prose text-sm text-mute">
                  {t.publication.lead}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <LabeledField label={f.status} htmlFor="status">
                  <Select name="status" defaultValue={initial?.status ?? "DRAFT"}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(jewelryStatusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledField>

                <div className="flex items-center gap-3 self-end pb-1.5">
                  <Switch
                    id="featured"
                    name="featured"
                    defaultChecked={initial?.featured ?? false}
                  />
                  <Label htmlFor="featured" className="text-sm text-ink">
                    {f.featured}
                  </Label>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── Anchors (try-on places) ────────────────────────────── */}
          <motion.section
            variants={item}
            data-tab="anchors"
            hidden={tab !== "anchors"}
            className={`${CARD} p-6 sm:p-8`}
          >
            <div className="mb-5">
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                {s.anchors}
              </h2>
              <p className="mt-1.5 max-w-prose text-sm text-mute">
                {ordered ? ap.hintFixed : ap.hintCompat}
              </p>
            </div>

            <AnchorPicker
              anchors={anchorChoices}
              defaultSelected={initial?.anchorIds ?? []}
              ordered={ordered}
              placeholder={ap.placeholder}
              addMoreLabel={ap.addMore}
              searchPlaceholder={ap.search}
              emptyText={ap.empty}
              onChange={() => clearError("anchorIds")}
            />
            <FieldError
              id="anchorIds-error"
              message={errorFor("anchorIds")}
              className="mt-3 block"
            />
          </motion.section>

          {/* ── Save (metadata tabs only) ──────────────────────────── */}
          {onFormTab ? (
            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="submit"
                disabled={pending}
                size="default"
                className="px-6"
              >
                {pending ? "…" : t.save}
              </Button>
              <InlineStatus state={state} />
            </div>
          ) : null}
        </motion.form>

        {/* ── Photos — sibling of the form; model depends on these ─── */}
        <motion.section
          variants={item}
          data-tab="photos"
          hidden={tab !== "photos"}
          className="flex flex-col gap-5"
        >
          {photosSlot}
        </motion.section>

        {/* ── 3D model — upload + auto-gen (own server-action forms) ─ */}
        <motion.section
          variants={item}
          data-tab="model"
          hidden={tab !== "model"}
        >
          {modelSlot}
        </motion.section>
      </motion.div>
    </MotionConfig>
  );
}
