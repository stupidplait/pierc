"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  MotionConfig,
  Reorder,
  useDragControls,
} from "framer-motion";
import { toast } from "sonner";
import {
  ChevronRight,
  GripVertical,
  Plus,
  FileText,
  Sparkles,
  HelpCircle,
  Images,
} from "lucide-react";
import {
  CONTENT_SECTIONS,
  type SectionKey,
  type ContentData,
} from "@/lib/admin/content-view";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  REVEAL_EASE,
} from "@/components/motion/entrance";
import { blurReveal } from "@/components/motion/Stagger";
import { AnimateNumber } from "@/components/ui/AnimateNumber";
import { Card } from "@/components/shadcn/ui/card";
import { Toaster } from "@/components/admin/toast/Toaster";
import { Drawer } from "@/components/booking/Drawer";
import { AboutEditorForm } from "@/components/admin/AboutEditorForm";
import { GalleryPanel } from "./GalleryPanel";
import { ServiceFormBody } from "./ServiceFormBody";
import { FaqFormBody } from "./FaqFormBody";
import {
  serviceMeta,
  toServiceInitial,
  faqCategoryLabel,
  toFaqInitial,
} from "./helpers";
import {
  reorderServices,
  reorderFaq,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

const ICON: Record<SectionKey, typeof FileText> = {
  about: FileText,
  services: Sparkles,
  faq: HelpCircle,
  gallery: Images,
};

// Section panel — the whole block (card + content) blurs IN on enter and OUT on
// exit, the same settings-style reveal. INLINE objects (not variant labels) so
// the panel never becomes a variant parent that swallows the rows' own reveals,
// which still stagger on top.
const PANEL_HIDDEN = ENTRANCE_HIDDEN;
const PANEL_SHOW = {
  ...ENTRANCE_SHOW,
  transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
};
const PANEL_EXIT = {
  ...ENTRANCE_HIDDEN,
  transition: { duration: 0.24, ease: REVEAL_EASE },
};

const SECTION_KEYS = new Set<string>(CONTENT_SECTIONS.map((s) => s.key));
function isSectionKey(v: string | null): v is SectionKey {
  return v !== null && SECTION_KEYS.has(v);
}

// Which list item the drawer is editing (or a new one), per section.
type Editing =
  | { kind: "service"; id: string | null }
  | { kind: "faq"; id: string | null }
  | null;

/**
 * The /admin/content manager: sliding section tabs over the live CMS, with the
 * Service/FAQ editors opening in a side drawer (the About/Gallery sections edit
 * inline). Reads one serializable snapshot from the server page and refreshes
 * it in place after every save.
 *
 * The Suspense boundary is required because the inner component reads
 * `useSearchParams()` (?section=): without it the route would bail to CSR.
 */
export function ContentManager(props: {
  data: ContentData;
  blobConfigured: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <ContentManagerInner {...props} />
    </Suspense>
  );
}

function ContentManagerInner({
  data,
  blobConfigured,
}: {
  data: ContentData;
  blobConfigured: boolean;
}) {
  const { refresh } = useRouter();
  const searchParams = useSearchParams();
  // The active tab lives in the URL (?section=) so it survives refresh, back/
  // forward, and is shareable. window.history keeps the switch shallow — no
  // server round-trip (and no refetch of the four content tables) per tab.
  // Don't destructure searchParams.get — URLSearchParams methods are bound to
  // the instance and throw a TypeError ("Value of 'this' must be of type
  // URLSearchParams") when detached, so the rule's suggestion would crash.
  // react-doctor-disable-next-line react-doctor/react-compiler-destructure-method
  const sectionParam = searchParams.get("section");
  const section: SectionKey = isSectionKey(sectionParam) ? sectionParam : "about";
  const selectSection = (key: SectionKey) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("section", key);
    window.history.pushState(null, "", `?${next.toString()}`);
  };
  const [editing, setEditing] = useState<Editing>(null);

  const close = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    refresh();
  };

  const service =
    editing?.kind === "service" && editing.id
      ? data.services.find((s) => s.id === editing.id)
      : null;
  const faq =
    editing?.kind === "faq" && editing.id
      ? data.faq.find((q) => q.id === editing.id)
      : null;

  const ts = ru.admin.content.services;
  const tf = ru.admin.content.faq;

  const serviceRows: Row[] = data.services.map((s) => ({
    id: s.id,
    title: s.name || ts.nameLabel,
    meta: serviceMeta(s),
    published: s.published,
    statusLabel: s.published ? ts.publishedLabel : ts.draft,
    onClick: () => setEditing({ kind: "service", id: s.id }),
  }));
  const faqRows: Row[] = data.faq.map((q) => ({
    id: q.id,
    title: q.question || tf.questionLabel,
    meta: faqCategoryLabel(q.category),
    published: q.published,
    statusLabel: q.published ? tf.publishedLabel : tf.draft,
    onClick: () => setEditing({ kind: "faq", id: q.id }),
  }));

  // Persist a new order, then refresh so client `data` matches the server (a
  // tab-away/back would otherwise re-seed the list from stale order). Revert on
  // failure by refreshing back to the server's truth.
  const persistOrder = (reorder: (ids: string[]) => Promise<void>) => (ids: string[]) =>
    reorder(ids).then(
      () => {
        toast.success(ru.admin.common.reordered);
        refresh();
      },
      () => {
        toast.error(ru.admin.common.saveError);
        refresh();
      },
    );

  // Per-tab item counts (about is prose — no count).
  const counts: Partial<Record<SectionKey, number>> = {
    services: data.services.length,
    faq: data.faq.length,
    gallery: data.gallery.length,
  };

  const body =
    section === "about" ? (
      <AboutEditorForm initialBody={data.about} />
    ) : section === "gallery" ? (
      <GalleryPanel photos={data.gallery} blobConfigured={blobConfigured} />
    ) : section === "services" ? (
      <SortableRows
        rows={serviceRows}
        empty={ts.empty}
        onReorder={persistOrder(reorderServices)}
      />
    ) : (
      <SortableRows
        rows={faqRows}
        empty={tf.empty}
        onReorder={persistOrder(reorderFaq)}
      />
    );

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-6">
          {/* Tabs on the left, the section's primary "add" on the right — so it's
              always reachable without scrolling to the bottom of a long list. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SlidingTabs
              section={section}
              counts={counts}
              onChange={selectSection}
            />
            {section === "services" || section === "faq" ? (
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    kind: section === "services" ? "service" : "faq",
                    id: null,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-mute transition-colors hover:border-ink/30 hover:text-ink active:scale-[0.98]"
              >
                <Plus aria-hidden className="size-4" />
                {section === "services" ? ts.addHeading : tf.addHeading}
              </button>
            ) : null}
          </div>

          {/* No initial={false}: let the first section's content blur-rise in on
              load too (AnimatePresence would otherwise suppress descendant mount
              animations). The panel itself enters neutral and only blurs on exit. */}
          <AnimatePresence mode="wait">
            <m.div
              key={section}
              initial={PANEL_HIDDEN}
              animate={PANEL_SHOW}
              exit={PANEL_EXIT}
            >
              {body}
            </m.div>
          </AnimatePresence>

        <Drawer
          open={editing?.kind === "service"}
          onClose={close}
          title={service ? service.name || ts.nameLabel : ts.addHeading}
          subtitle={service ? serviceMeta(service) : undefined}
        >
          {editing?.kind === "service" ? (
            <ServiceFormBody
              initial={service ? toServiceInitial(service) : undefined}
              isNew={!service}
              onCancel={close}
              onSaved={saved}
            />
          ) : null}
        </Drawer>

        <Drawer
          open={editing?.kind === "faq"}
          onClose={close}
          title={faq ? faq.question || tf.questionLabel : tf.addHeading}
          subtitle={faq ? faqCategoryLabel(faq.category) : undefined}
        >
          {editing?.kind === "faq" ? (
            <FaqFormBody
              initial={faq ? toFaqInitial(faq) : undefined}
              isNew={!faq}
              onCancel={close}
              onSaved={saved}
            />
          ) : null}
        </Drawer>

        <Toaster />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

function SlidingTabs({
  section,
  counts,
  onChange,
}: {
  section: SectionKey;
  counts: Partial<Record<SectionKey, number>>;
  onChange: (s: SectionKey) => void;
}) {
  return (
    <nav className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
      {CONTENT_SECTIONS.map((s, i) => {
        const active = s.key === section;
        const Icon = ICON[s.key];
        const count = counts[s.key];
        return (
          <m.button
            key={s.key}
            {...blurReveal(i)}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => onChange(s.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              active ? "text-bg" : "text-mute hover:text-ink",
            )}
          >
            {active ? (
              <m.span
                layoutId="content-tab-active"
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ ease: REVEAL_EASE, duration: 0.25 }}
              />
            ) : null}
            <Icon aria-hidden className="relative z-10 size-4" />
            <span className="relative z-10">{s.label}</span>
            {count !== undefined ? (
              <span
                className={cn(
                  "relative z-10 min-w-4 rounded-full px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums",
                  active ? "bg-bg/20 text-bg" : "bg-ink/8 text-mute",
                )}
              >
                {/* Rolls 0 → count once on mount; later add/delete springs to the
                    new total. AnimateNumber is aria-hidden, so carry the real
                    count for screen readers alongside it. */}
                <AnimateNumber value={count} from={0} />
                <span className="sr-only">{count}</span>
              </span>
            ) : null}
          </m.button>
        );
      })}
    </nav>
  );
}

interface Row {
  id: string;
  title: string;
  meta?: string;
  published: boolean;
  /** Localized status word ("Опубликовано" / "Черновик") for the dot + draft tag. */
  statusLabel: string;
  onClick: () => void;
}

/**
 * Drag-to-reorder list (services / FAQ). Each row carries a dedicated grip
 * handle (so the rest of the row stays a click-to-edit button); dropping commits
 * the new sequence via `onReorder`. Order is owned here, not by a form field.
 * The "add" action lives up in the tab row (see ContentManagerInner).
 *
 * The local state is just the ORDER (an array of ids); the row CONTENT is read
 * from `rows` (props) each render. So an edit/add/delete reflects immediately
 * without remounting or re-animating — existing rows keep their place (keyed by
 * id), only a genuinely new row mounts and blurs in. Reorder tracks string ids,
 * which stay stable across renders even while dragging.
 */
function SortableRows({
  rows,
  empty,
  onReorder,
}: {
  rows: Row[];
  empty: string;
  onReorder: (ids: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const known = new Set(order);
  // Reconcile the local order with current data: known ids in their local order,
  // then any new ids appended, dropping removed ones.
  const ids = [
    ...order.filter((id) => byId.has(id)),
    ...rows.flatMap((r) => (known.has(r.id) ? [] : [r.id])),
  ];
  const persist = () => onReorder(ids);

  if (ids.length === 0) {
    return <p className="text-sm text-mute">{empty}</p>;
  }

  return (
    <Card className="overflow-hidden">
      <Reorder.Group
        as="ul"
        axis="y"
        values={ids}
        onReorder={setOrder}
        className="divide-y divide-line"
      >
        {ids.map((id, i) => (
          <SortableRow
            key={id}
            id={id}
            row={byId.get(id)!}
            index={i}
            onCommit={persist}
          />
        ))}
      </Reorder.Group>
    </Card>
  );
}

function SortableRow({
  id,
  row,
  index,
  onCommit,
}: {
  id: string;
  row: Row;
  index: number;
  onCommit: () => void;
}) {
  const controls = useDragControls();
  // Freeze the entrance delay at mount (lazy init). blurReveal's `animate`
  // depends on the index; if it tracked the LIVE index, reordering a row would
  // change `animate` and replay the blur on the row you're dragging. The
  // position number below still uses the live index (it should update on
  // reorder).
  const [revealIndex] = useState(() => index);
  // Pin elevation via STATE, not whileDrag: whileDrag's zIndex is a gesture
  // value that can lose to a sibling's transform stacking context for a frame
  // mid-swap (the row slipping behind). A state-driven inline z-index is a real
  // CSS value that persists across the re-renders the reorder triggers.
  const [dragging, setDragging] = useState(false);
  return (
    <Reorder.Item
      value={id}
      {...blurReveal(revealIndex)}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onCommit();
      }}
      whileDrag={{ scale: 1.01, boxShadow: "var(--elev-hover)" }}
      style={{ position: "relative", zIndex: dragging ? 50 : undefined }}
      // Hover tint is an ::after OVERLAY, not a `hover:bg-*` that would REPLACE
      // the opaque bg-card — otherwise the dragged row turns translucent and the
      // rows beneath show through. bg-card stays solid so the lifted row covers.
      className="flex items-center gap-1 bg-card pr-2 after:pointer-events-none after:absolute after:inset-0 after:bg-accent/0 after:transition-colors after:content-[''] hover:after:bg-accent/5"
    >
      <button
        type="button"
        aria-label="Перетащите, чтобы изменить порядок"
        // Pointer-only drag handle (no keyboard reorder), so keep it out of the
        // tab order — keyboard users reach the edit button beside it instead.
        tabIndex={-1}
        onPointerDown={(e) => controls.start(e)}
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-mute/40 transition-colors hover:text-mute active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={row.onClick}
        className="group flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left"
      >
        <span className="w-5 shrink-0 text-center text-xs tabular-nums text-mute/60">
          <AnimateNumber value={index + 1} />
        </span>
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${
            row.published ? "bg-accent" : "bg-ink/25"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {row.title}
            </span>
            {row.published ? (
              <span className="sr-only">{row.statusLabel}</span>
            ) : (
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
                {row.statusLabel}
              </span>
            )}
          </span>
          {row.meta ? (
            <span className="mt-0.5 block truncate text-xs text-mute">
              {row.meta}
            </span>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
    </Reorder.Item>
  );
}
