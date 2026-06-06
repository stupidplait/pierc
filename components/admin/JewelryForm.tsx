"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Variants,
} from "framer-motion";
import { Check, ChevronDown, Loader2, Save } from "lucide-react";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { CARD, GHOST } from "@/components/admin/form/styles";
import { NumberInput } from "@/components/admin/form/NumberInput";
import { BackButton } from "@/components/admin/BackButton";
import { WordReveal } from "@/components/about/client/WordReveal";
import {
  ReadinessChecklist,
  ReadinessRing,
  readinessTone,
  type ReadinessItem,
} from "@/components/admin/jewelry/PublishReadiness";
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
  ATTACH_RULES,
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
  /** Whether the piece already has at least one photo (for the readiness checklist). */
  hasPhotos?: boolean;
  /** Whether the piece already has a 3D model (for the readiness checklist). */
  hasGlb?: boolean;
  /** Photo uploader + grid — rendered by the server page (own server actions). */
  photosSlot?: React.ReactNode;
  /** 3D model manager (upload + auto-gen) — rendered by the server page. */
  modelSlot?: React.ReactNode;
  /** Delete control (a server-action `<form>`) — shown in the command bar on
   *  edit; omitted on the create page (nothing to delete yet). */
  deleteSlot?: React.ReactNode;
  /** Where the command bar's "Back" lands on a fresh load. */
  backHref?: string;
  /** Piece title — rendered inside the editor's top section (beside the
   *  progress strip) so the page header can stay empty. */
  title: string;
}

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

type Tab = "attributes" | "anchors" | "photos" | "model";

// Stable id so the sticky action bar (rendered OUTSIDE the form, visible on
// every tab) can submit the editor form via the `form=` attribute — a hidden
// form is still submittable, so the Save button works from the photo/3D tabs
// too. Exported so the add-page photo dropzone can read the in-progress field
// values (it submits them alongside the files to create a populated piece).
export const JEWELRY_FORM_ID = "jewelry-editor-form";
const FORM_ID = JEWELRY_FORM_ID;

// Media panels (photos, 3D) render outside the editor <form> because their own
// server-action <form>s can't legally nest. We track which tab is active to
// label the sticky bar's instant-save zone.
const FORM_TABS: Tab[] = ["attributes", "anchors"];

// Id of the field a readiness-row jump just targeted. The matching LabeledField
// flashes a ring so the jump is visible even on controls that swallow the focus
// ring (Select/Combobox triggers only show it on keyboard `:focus-visible`).
const FlashContext = createContext<string | null>(null);

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

/**
 * Label + control, stacked. Wraps a shadcn control, associating its `id`.
 * `required` adds a red asterisk; optional fields carry no marker.
 */
function LabeledField({
  label,
  htmlFor,
  children,
  full,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  full?: boolean;
  error?: string;
  required?: boolean;
}) {
  const flashed = useContext(FlashContext) === htmlFor;
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        <span>{label}</span>
        {required ? (
          <span className="text-error" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {/* The flash ring hugs ONLY the control (not the label/error), so a jump
          clearly points at the input — Select/Combobox triggers don't paint a
          focus outline on programmatic focus, so this ring is the cue. */}
      <div
        className={`rounded-xl transition-shadow duration-300 ${
          flashed
            ? "ring-2 ring-accent/70 ring-offset-2 ring-offset-card"
            : "ring-0"
        }`}
      >
        {children}
      </div>
      <FieldError id={`${htmlFor}-error`} message={error} />
    </div>
  );
}

/**
 * One editor tab's content. Stays mounted when inactive (display:none) so field
 * state, the photo dropzone's pending picks, and the model manager's polling all
 * survive a tab switch — only fades IN when it becomes active (a fade-out would
 * need it to stay laid-out, which conflicts with the mounted-but-hidden model).
 */
function TabPanel({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      role="tabpanel"
      initial={false}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 6 }}
      transition={{ duration: 0.2, ease: REVEAL_EASE }}
      style={{ display: active ? undefined : "none" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Catalog editor — the create/edit form for a single jewelry piece. Built
 * entirely on shadcn controls re-themed to the Steel Atelier vocabulary.
 *
 * The rework layers four things over the original:
 *   • Importance cues — required `*` markers (derived from the schema), so the
 *     studio can tell what must be filled.
 *   • Sanitized number fields (NumberInput) — no `03`, `-5`, `1e9`, `2.5`.
 *   • A clear save model — one sticky command bar visible on every tab with a
 *     dirty/saved indicator + a leave-guard; photos/3D are labeled instant.
 *   • A live publish-readiness strip (Полоса) that jumps to each missing field.
 */
export function JewelryForm({
  initial,
  categories,
  anchors,
  title,
  hasPhotos = false,
  hasGlb = false,
  photosSlot,
  modelSlot,
  deleteSlot,
  backHref = "/admin/jewelry",
}: JewelryFormProps) {
  // Type drives the anchor semantics (compat list vs ordered endpoints) and the
  // count rule. No default — it's a deliberate required choice, empty until the
  // studio picks one.
  const [type, setType] = useState<JewelryType | "">(initial?.type ?? "");
  const [tab, setTab] = useState<Tab>("attributes");

  // Disclosure state for the readiness checklist (floats above the command bar).
  const [readinessOpen, setReadinessOpen] = useState(false);

  // The field a readiness jump just targeted — flashes a ring for ~1s.
  const [flashField, setFlashField] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single source of truth for EVERY editable field. The inputs stay
  // uncontrolled (defaultValue) for cursor stability, but mirror here on change;
  // because each field's defaultValue reads from this snapshot, the values
  // survive a remount (e.g. coming back from another tab) instead of resetting
  // to `initial`. The readiness checklist also reads live from here.
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    material: initial?.material ?? "",
    color: initial?.color ?? "",
    gauge: initial?.gauge != null ? String(initial.gauge) : "",
    size: initial?.size != null ? String(initial.size) : "",
    stones: initial?.stones ?? "",
    price: initial?.price != null ? String(initial.price) : "",
    inStock: initial?.inStock != null ? String(initial.inStock) : "",
    status: (initial?.status ?? "DRAFT") as keyof typeof jewelryStatusLabels,
    featured: initial?.featured ?? false,
  });
  const update = (patch: Partial<typeof values>) =>
    setValues((v) => ({ ...v, ...patch }));
  const [anchorIds, setAnchorIds] = useState<string[]>(
    initial?.anchorIds ?? [],
  );

  // "Has unsaved attribute edits" — drives the sticky bar + the leave-guard.
  // Flips on any field interaction; clears once a save succeeds.
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

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

  // ── Readiness "jump to field" ─────────────────────────────────────────────
  // A checklist row navigates to the control it tracks: switch to its tab, then
  // focus the field once the (CSS-hidden) panel is shown. We stash the target id
  // in a ref and drain it after the tab actually changes — never in render, and
  // never via set-state-in-effect, to stay clear of the strict hooks lint.
  const pendingFocus = useRef<string | null>(null);
  const focusPending = useCallback(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    // Flash a ring on the field (visible for Select/Combobox too), then focus +
    // scroll it. The ring is the cue; focus keeps keyboard users in place.
    setFlashField(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashField(null), 1100);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
    });
  }, []);
  // Clear the flash timer on unmount.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  useEffect(() => {
    // Runs after a tab switch repaints the now-visible panel.
    focusPending();
  }, [tab, focusPending]);

  const jumpToItem = (it: ReadinessItem) => {
    pendingFocus.current = it.field ?? null;
    setReadinessOpen(false); // collapse the disclosure on navigation
    if (it.tab !== tab) {
      setTab(it.tab); // the effect above focuses once the panel mounts
    } else {
      focusPending(); // already on the right tab — focus now
    }
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
    if (result?.ok) {
      setDirty(false); // saved → the form matches the server again
    } else if (result?.fieldErrors) {
      flipToFirstError(result.fieldErrors);
    }
    return result;
  };

  const [state, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  // Warn before a full-page unload (reload / tab close) while there are unsaved
  // attribute edits. In-app <Link> navigation isn't covered (App Router has no
  // stable blocker) — the always-visible sticky indicator is the backstop there.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
  const ed = t.editor;
  const cl = t.checklist;

  // With no type yet, fall back to neutral values (compat-list ordering, no
  // count rule) so nothing dereferences an undefined rule before it's chosen.
  const ordered = type ? !isSingleAnchorType(type) : false;
  const anchorRule = type ? ATTACH_RULES[type] : null;
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

  // ── Publish-readiness ─────────────────────────────────────────────────────
  // Each row mirrors "what blocks a save / rounds out the card" AND knows where
  // it lives (tab + field id), so the checklist can jump straight to it.
  const isFilled = (v: string) => v.trim().length > 0;
  const anchorsOk =
    !!anchorRule &&
    anchorIds.length >= anchorRule.min &&
    anchorIds.length <= anchorRule.max;
  const readinessItems: ReadinessItem[] = [
    {
      key: "name",
      label: cl.name,
      done: isFilled(values.name),
      kind: "required",
      tab: "attributes",
      field: "name",
    },
    {
      key: "category",
      label: cl.category,
      done: isFilled(values.categoryId),
      kind: "required",
      tab: "attributes",
      field: "categoryId",
    },
    {
      key: "type",
      label: cl.type,
      done: type !== "",
      kind: "required",
      tab: "attributes",
      field: "type",
    },
    {
      key: "material",
      label: cl.material,
      done: isFilled(values.material),
      kind: "required",
      tab: "attributes",
      field: "material",
    },
    {
      key: "price",
      label: cl.price,
      done: isFilled(values.price),
      kind: "required",
      tab: "attributes",
      field: "price",
    },
    {
      key: "stock",
      label: cl.stock,
      done: isFilled(values.inStock),
      kind: "required",
      tab: "attributes",
      field: "inStock",
    },
    {
      key: "anchors",
      label: cl.anchors,
      done: anchorsOk,
      kind: "required",
      tab: "anchors",
      count: anchorIds.length,
    },
    {
      key: "photo",
      label: cl.photo,
      done: hasPhotos,
      kind: "recommended",
      tab: "photos",
    },
    {
      key: "model",
      label: cl.model,
      done: hasGlb,
      kind: "recommended",
      tab: "model",
    },
  ];
  const readinessDone = readinessItems.filter((i) => i.done).length;
  const readinessTotal = readinessItems.length;
  const readinessPct = Math.round((readinessDone / readinessTotal) * 100);
  const tone = readinessTone(readinessItems);
  const someRequiredMissing = readinessItems.some(
    (i) => i.kind === "required" && !i.done,
  );
  const someRecommendedMissing = readinessItems.some(
    (i) => i.kind === "recommended" && !i.done,
  );
  const nudge = someRequiredMissing
    ? cl.nudgeRequired
    : someRecommendedMissing
      ? cl.nudgeRecommended
      : cl.allDone;

  const checklistLabels = {
    groupRequired: cl.groupRequired,
    groupRecommended: cl.groupRecommended,
    requiredHint: cl.requiredHint,
    recommendedHint: cl.recommendedHint,
    jumpTo: cl.jumpTo,
  };
  const TONE_TEXT = {
    warn: "text-warn",
    accent: "text-accent",
    success: "text-success",
  } as const;
  const TONE_BAR = {
    warn: "bg-warn",
    accent: "bg-accent",
    success: "bg-success",
  } as const;

  // ── Field nodes ──────────────────────────────────────────────────────────
  // Required fields carry the red `*`; optional ones carry no marker.
  const nameField = (
    <LabeledField
      label={f.name}
      htmlFor="name"
      full
      required
      error={errorFor("name")}
    >
      <Input
        id="name"
        name="name"
        defaultValue={values.name}
        placeholder={ph.name}
        aria-invalid={!!errorFor("name")}
        aria-describedby={errorFor("name") ? "name-error" : undefined}
        onInput={(e) => {
          update({ name: e.currentTarget.value });
          clearError("name");
          markDirty();
        }}
      />
    </LabeledField>
  );

  const descriptionField = (
    <LabeledField label={f.description} htmlFor="description" full>
      <Textarea
        id="description"
        name="description"
        rows={3}
        defaultValue={values.description}
        placeholder={ph.description}
        onInput={(e) => {
          update({ description: e.currentTarget.value });
          markDirty();
        }}
      />
    </LabeledField>
  );

  const categoryField = (
    <LabeledField
      label={f.category}
      htmlFor="categoryId"
      required
      error={errorFor("categoryId")}
    >
      <Select
        name="categoryId"
        defaultValue={values.categoryId || undefined}
        onValueChange={(v) => {
          update({ categoryId: v });
          clearError("categoryId");
          markDirty();
        }}
      >
        <SelectTrigger id="categoryId" aria-invalid={!!errorFor("categoryId")}>
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
  );

  const typeField = (
    <LabeledField
      label={f.type}
      htmlFor="type"
      required
      error={errorFor("type")}
    >
      {/* A hidden input carries the value (like `status` below): an UNPICKED
          type must submit "" so the enum fails and the required choice is
          enforced. Radix's own native control can't be relied on here — with a
          controlled empty-string value it falls back to the FIRST option and
          silently submits STUD. So the Select is nameless and this owns the
          submitted value. */}
      <input type="hidden" name="type" value={type} />
      <Select
        value={type}
        onValueChange={(v) => {
          setType(v as JewelryType);
          clearError("type");
          clearError("anchorIds");
          markDirty();
        }}
      >
        <SelectTrigger id="type" aria-invalid={!!errorFor("type")}>
          <SelectValue placeholder={pk.type} />
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
  );

  const materialField = (
    <LabeledField
      label={f.material}
      htmlFor="material"
      required
      error={errorFor("material")}
    >
      <Combobox
        id="material"
        name="material"
        options={MATERIALS}
        defaultValue={values.material}
        placeholder={ph.material}
        searchPlaceholder={pk.search}
        emptyText={pk.empty}
        addLabel={pk.add}
        allowCustom
        invalid={!!errorFor("material")}
        onChange={(v) => {
          update({ material: v });
          clearError("material");
          markDirty();
        }}
      />
    </LabeledField>
  );

  const colorField = (
    <LabeledField label={f.color} htmlFor="color">
      <Combobox
        id="color"
        name="color"
        options={COLORS}
        defaultValue={values.color}
        placeholder={ph.color}
        searchPlaceholder={pk.search}
        emptyText={pk.empty}
        addLabel={pk.add}
        allowCustom
        onChange={(v) => {
          update({ color: v });
          markDirty();
        }}
      />
    </LabeledField>
  );

  const gaugeField = (
    <LabeledField label={f.gauge} htmlFor="gauge" error={errorFor("gauge")}>
      <NumberInput
        id="gauge"
        name="gauge"
        mode="decimal"
        defaultValue={values.gauge}
        placeholder={ph.gauge}
        invalid={!!errorFor("gauge")}
        aria-describedby={errorFor("gauge") ? "gauge-error" : undefined}
        onValueChange={(v) => {
          update({ gauge: v });
          clearError("gauge");
          markDirty();
        }}
      />
    </LabeledField>
  );

  const sizeField = (
    <LabeledField label={f.size} htmlFor="size" error={errorFor("size")}>
      <NumberInput
        id="size"
        name="size"
        mode="decimal"
        defaultValue={values.size}
        placeholder={ph.size}
        invalid={!!errorFor("size")}
        aria-describedby={errorFor("size") ? "size-error" : undefined}
        onValueChange={(v) => {
          update({ size: v });
          clearError("size");
          markDirty();
        }}
      />
    </LabeledField>
  );

  const stonesField = (
    <LabeledField label={f.stones} htmlFor="stones" full>
      <MultiCombobox
        id="stones"
        name="stones"
        options={STONES}
        defaultValue={values.stones}
        placeholder={ph.stones}
        searchPlaceholder={pk.search}
        emptyText={pk.empty}
        addLabel={pk.add}
        allowCustom
        onChange={(v) => {
          update({ stones: v });
          markDirty();
        }}
      />
    </LabeledField>
  );

  const priceField = (
    <LabeledField
      label={f.price}
      htmlFor="price"
      required
      error={errorFor("price")}
    >
      <NumberInput
        id="price"
        name="price"
        mode="decimal"
        defaultValue={values.price}
        placeholder={ph.price}
        invalid={!!errorFor("price")}
        aria-describedby={errorFor("price") ? "price-error" : undefined}
        onValueChange={(v) => {
          update({ price: v });
          clearError("price");
          markDirty();
        }}
      />
    </LabeledField>
  );

  const inStockField = (
    <LabeledField
      label={f.inStock}
      htmlFor="inStock"
      required
      error={errorFor("inStock")}
    >
      <NumberInput
        id="inStock"
        name="inStock"
        mode="integer"
        defaultValue={values.inStock}
        placeholder={ph.inStock}
        invalid={!!errorFor("inStock")}
        aria-describedby={errorFor("inStock") ? "inStock-error" : undefined}
        onValueChange={(v) => {
          update({ inStock: v });
          clearError("inStock");
          markDirty();
        }}
      />
    </LabeledField>
  );

  // Status is mostly machine-driven: PROCESSING / PENDING_REVIEW / REJECTED are
  // set by the 3D pipeline. The admin only meaningfully toggles DRAFT ↔
  // PUBLISHED, so the picker offers just those; a pipeline state shows
  // read-only with an override. A hidden input always carries the *current*
  // value so a save never silently resets a pipeline state (the Select is
  // nameless on purpose — otherwise it'd also emit a `status` field).
  const statusIsHuman =
    values.status === "DRAFT" || values.status === "PUBLISHED";
  const pipelineBadgeTone =
    values.status === "REJECTED"
      ? "border-error/40 bg-error-soft text-error"
      : "border-warn/40 bg-warn-soft text-warn";

  const statusField = (
    <LabeledField label={f.status} htmlFor="status">
      <input type="hidden" name="status" value={values.status} />
      {statusIsHuman ? (
        <Select
          value={values.status}
          onValueChange={(v) => {
            update({ status: v as keyof typeof jewelryStatusLabels });
            markDirty();
          }}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["DRAFT", "PUBLISHED"] as const).map((k) => (
              <SelectItem key={k} value={k}>
                {jewelryStatusLabels[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-11 items-center rounded-xl border px-3.5 text-sm font-medium ${pipelineBadgeTone}`}
            >
              {jewelryStatusLabels[values.status]}
            </span>
            <span className="text-xs text-mute">{ed.statusPipelineNote}</span>
          </div>
          {/* Manual override out of a pipeline state. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                update({ status: "DRAFT" });
                markDirty();
              }}
              className={`${GHOST} flex-1 sm:flex-none`}
            >
              {ed.statusMakeDraft}
            </button>
            <button
              type="button"
              onClick={() => {
                update({ status: "PUBLISHED" });
                markDirty();
              }}
              className={`${GHOST} flex-1 sm:flex-none`}
            >
              {ed.statusPublish}
            </button>
          </div>
        </div>
      )}
    </LabeledField>
  );

  const featuredField = (
    <div className="flex items-center gap-3 self-end pb-1.5">
      <Switch
        id="featured"
        name="featured"
        checked={values.featured}
        onCheckedChange={(c) => {
          update({ featured: c });
          markDirty();
        }}
      />
      <Label htmlFor="featured" className="text-sm text-ink">
        {f.featured}
      </Label>
    </div>
  );

  // Publication block — status + featured.
  const publicationBlock = (
    <>
      <div className="mb-5">
        <h3 className="text-sm font-medium text-ink">
          {t.publication.heading}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-mute">
          {t.publication.lead}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {statusField}
        {featuredField}
      </div>
    </>
  );

  // ── Attributes card — flat grid; required fields carry a red `*` ──────────
  const attributesCard = (
    <FlashContext.Provider value={flashField}>
      <section className={`${CARD} p-6 sm:p-8`}>
        <h2 className="mb-6 font-display text-xl font-medium tracking-tight text-ink">
          {s.attributes}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {nameField}
          {descriptionField}
          {categoryField}
          {typeField}
          {materialField}
          {colorField}
          {gaugeField}
          {sizeField}
          {stonesField}
          {priceField}
          {inStockField}
        </div>
        <div className="mt-8 border-t border-line pt-6">{publicationBlock}</div>
      </section>
    </FlashContext.Provider>
  );

  // ── Top section: title · Полоса (progress strip) · tabs ───────────────────
  const checklistBody = (
    <ReadinessChecklist
      items={readinessItems}
      onJump={jumpToItem}
      labels={checklistLabels}
    />
  );
  const toggleReadiness = () => setReadinessOpen((o) => !o);

  const titleEl = (
    <h1 className="font-display text-3xl font-medium tracking-tight text-ink text-balance sm:text-4xl">
      {title}
    </h1>
  );

  const tabsEl = (
    <div
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
    </div>
  );

  // Compact progress for the command bar: tone ring + count + chevron. Sized to
  // match the bar's h-11 buttons.
  const progressCompact = (
    <button
      type="button"
      onClick={toggleReadiness}
      aria-expanded={readinessOpen ? "true" : undefined}
      aria-label={cl.title}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-medium transition-colors hover:bg-ink/5 ${TONE_TEXT[tone]}`}
    >
      <ReadinessRing
        done={readinessDone}
        total={readinessTotal}
        tone={tone}
        size={18}
      />
      <span className="tabular-nums">
        {readinessDone}/{readinessTotal}
      </span>
      <ChevronDown
        className={`size-4 text-mute transition-transform ${readinessOpen ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );

  // Checklist floating above the command bar; opens on the compact toggle.
  const floatingChecklist = (
    <AnimatePresence initial={false}>
      {readinessOpen ? (
        <motion.div
          key="readiness-floating"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: REVEAL_EASE }}
          className="absolute inset-x-0 bottom-full mb-2"
        >
          <div className={`${CARD} p-4 sm:p-5`}>{checklistBody}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  // Top section is now just the title + tabs; the progress lives in the bar.
  const topSection = (
    <div className="flex flex-col">
      <div className="shrink-0">{titleEl}</div>
      <div className="mt-4">{tabsEl}</div>
    </div>
  );

  // Command-bar save-state zone (transient: error / unsaved / saved / instant).
  const saveStateZone = (
    <div className="min-w-0 flex-1">
      {state && !state.ok ? (
        <span role="alert" aria-live="assertive" className="text-sm text-error">
          {state.error}
        </span>
      ) : dirty ? (
        <span className="flex items-center gap-1.5 text-sm text-warn">
          <span aria-hidden>●</span>
          <span className="truncate">{ed.unsaved}</span>
        </span>
      ) : state?.ok ? (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-sm text-success"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{state.message ?? ed.saved}</span>
        </span>
      ) : (
        // Smooth exit, only here: keep WordReveal's per-word entrance, but wrap
        // in AnimatePresence so leaving the 3D tab fades the note out instead of
        // cutting it dead. The wrapper owns the exit; WordReveal drives entry.
        // AnimatePresence must live OUTSIDE the tab check so it survives to
        // animate the child out.
        <AnimatePresence>
          {tab === "model" ? (
            <motion.span
              key="instant-note"
              exit={{
                opacity: 0,
                filter: "blur(4px)",
                transition: { duration: 0.4, ease: REVEAL_EASE },
              }}
              className="block min-w-0"
            >
              <WordReveal
                as="span"
                text={ed.instantNote}
                className="truncate text-sm text-mute"
              />
            </motion.span>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  );

  const barActions = (
    <div className="flex shrink-0 items-center gap-2">
      <BackButton
        fallbackHref={backHref}
        label={t.backToList}
        className={`${GHOST} gap-2`}
      />
      <Button
        type="submit"
        form={FORM_ID}
        disabled={pending}
        className="gap-2 px-6"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {pending ? "…" : t.save}
      </Button>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* Keep the page a touch past the viewport on EVERY tab — short tabs
          (anchors, 3D) included — so the sticky command bar always engages at
          the same bottom-4 offset. With the old `-6rem` a short tab fit exactly
          in the viewport (no scroll), so flex slack parked the bar ~2rem higher
          than on tall, scrolled tabs where sticky pinned it — switching tabs
          made it jump. `-4rem` guarantees a sliver of overflow; the flex-1
          region still absorbs slack so short tabs don't float up. */}
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-1 flex-col gap-6 pb-3"
        >
          {/* ── Title + tabs (progress lives in the command bar) ─────── */}
          <motion.div variants={item}>{topSection}</motion.div>

          {/* ── Editor form (metadata tabs: attributes + anchors) ────── */}
          {/* Stays mounted on media tabs (display:none) so field values and
            native validation survive; just dropped from the flex flow to
            avoid a doubled gap above the photo/model panels. */}
          <motion.form
            id={FORM_ID}
            variants={item}
            action={action}
            noValidate
            hidden={!onFormTab}
            className="flex flex-col gap-6"
          >
            {initial?.id ? (
              <input type="hidden" name="id" value={initial.id} />
            ) : null}

            {/* ── Attributes tab ─────────────────────────────────────── */}
            <TabPanel
              active={tab === "attributes"}
              className="flex flex-col gap-6"
            >
              {attributesCard}
            </TabPanel>

            {/* ── Anchors (try-on places) ────────────────────────────── */}
            <TabPanel
              active={tab === "anchors"}
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
                onChange={(sel) => {
                  setAnchorIds(sel);
                  clearError("anchorIds");
                  markDirty();
                }}
              />
              <FieldError
                id="anchorIds-error"
                message={errorFor("anchorIds")}
                className="mt-3 block"
              />
            </TabPanel>
          </motion.form>

          {/* ── Photos — sibling of the form; model depends on these ─── */}
          <TabPanel active={tab === "photos"} className="flex flex-col gap-5">
            {photosSlot}
          </TabPanel>

          {/* ── 3D model — upload + auto-gen (own server-action forms) ─ */}
          <TabPanel active={tab === "model"}>{modelSlot}</TabPanel>
        </motion.div>

        {/* ── Sticky command bar — visible on EVERY tab ──────────────── */}
        {/* One reachable home for every action: delete on the far left, the
          compact readiness progress, the save-state, then Back + Save. The
          checklist floats above the bar. Save submits the (hidden) editor
          form via `form=`; photos/3D persist on their own (instant note). */}
        <div className="sticky bottom-4 z-20 mt-1">
          <div className="relative">
            {floatingChecklist}
            <div className="flex items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-card/95 px-3 py-2.5 shadow-elev backdrop-blur sm:px-4 sm:py-3">
              {deleteSlot ? <div className="shrink-0">{deleteSlot}</div> : null}
              {progressCompact}
              {saveStateZone}
              {barActions}
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
