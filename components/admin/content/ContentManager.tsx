"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronRight,
  GripVertical,
  Plus,
  FileText,
  Tag,
  HelpCircle,
  Images,
} from "lucide-react";
import {
  CONTENT_SECTIONS,
  type SectionKey,
  type ContentData,
} from "@/lib/admin/content-view";
import { REVEAL_EASE } from "@/components/services/entrance/config";
import { CARD } from "@/components/admin/form/styles";
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
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

const ICON: Record<SectionKey, typeof FileText> = {
  about: FileText,
  services: Tag,
  faq: HelpCircle,
  gallery: Images,
};

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
 */
export function ContentManager({
  data,
  blobConfigured,
}: {
  data: ContentData;
  blobConfigured: boolean;
}) {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>("about");
  const [editing, setEditing] = useState<Editing>(null);

  const close = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    router.refresh();
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

  return (
    <div className="flex flex-col gap-6">
      <SlidingTabs section={section} onChange={setSection} />

      {section === "about" ? (
        <AboutEditorForm initialBody={data.about} />
      ) : section === "gallery" ? (
        <GalleryPanel photos={data.gallery} blobConfigured={blobConfigured} />
      ) : section === "services" ? (
        <RowList
          empty={ts.empty}
          addLabel={ts.addHeading}
          onAdd={() => setEditing({ kind: "service", id: null })}
          rows={data.services.map((s, i) => ({
            id: s.id,
            index: i + 1,
            title: s.name || ts.nameLabel,
            meta: serviceMeta(s),
            published: s.published,
            onClick: () => setEditing({ kind: "service", id: s.id }),
          }))}
        />
      ) : (
        <RowList
          empty={tf.empty}
          addLabel={tf.addHeading}
          onAdd={() => setEditing({ kind: "faq", id: null })}
          rows={data.faq.map((q, i) => ({
            id: q.id,
            index: i + 1,
            title: q.question || tf.questionLabel,
            meta: faqCategoryLabel(q.category),
            published: q.published,
            onClick: () => setEditing({ kind: "faq", id: q.id }),
          }))}
        />
      )}

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
    </div>
  );
}

function SlidingTabs({
  section,
  onChange,
}: {
  section: SectionKey;
  onChange: (s: SectionKey) => void;
}) {
  return (
    <nav className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
      {CONTENT_SECTIONS.map((s) => {
        const active = s.key === section;
        const Icon = ICON[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              active ? "text-bg" : "text-mute hover:text-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId="content-tab-active"
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ ease: REVEAL_EASE, duration: 0.25 }}
              />
            ) : null}
            <Icon className="relative z-10 size-4" />
            <span className="relative z-10">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

interface Row {
  id: string;
  index: number;
  title: string;
  meta?: string;
  published: boolean;
  onClick: () => void;
}

function RowList({
  rows,
  empty,
  addLabel,
  onAdd,
}: {
  rows: Row[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-mute">{empty}</p>
      ) : (
        <ul className={cn(CARD, "divide-y divide-line overflow-hidden")}>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={r.onClick}
                className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink/3"
              >
                <GripVertical
                  aria-hidden
                  className="size-4 shrink-0 text-mute/40"
                />
                <span className="w-5 shrink-0 text-center text-xs tabular-nums text-mute/60">
                  {r.index}
                </span>
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${
                    r.published ? "bg-success" : "bg-ink/25"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {r.title}
                  </span>
                  {r.meta ? (
                    <span className="mt-0.5 block truncate text-xs text-mute">
                      {r.meta}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-4 shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="flex w-fit items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-medium text-mute transition-colors hover:border-ink/30 hover:text-ink"
      >
        <Plus className="size-4" />
        {addLabel}
      </button>
    </div>
  );
}
