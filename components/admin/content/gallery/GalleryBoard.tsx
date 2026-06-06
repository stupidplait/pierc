"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  m,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import { EyeOff, GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { Button } from "@/components/shadcn/ui/button";
import {
  deleteGalleryPhoto,
  reorderGalleryPhotos,
} from "@/lib/admin/content-actions";
import type { GalleryRow } from "@/lib/admin/content-view";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { useGalleryUpload, type GalleryUpload } from "./useGalleryUpload";
import { PhotoEditorDrawer } from "./PhotoEditorDrawer";

// Dynamic-island spring — snappy but fluid; shared by the pending-card morph,
// the grid reflow, and the drag-reorder FLIP so every motion feels of a piece.
const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 } as const;

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";

// Caption-footer focus that matches the shared text-field language (accent on
// focus) without the boxed ring/bg that looked off on an edge-to-edge footer.
const CAPTION_INPUT =
  "w-full border-t border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/50 focus-visible:border-accent/60 focus-visible:bg-ink/5";

/**
 * The gallery board: one grid whose first cell is a "+" tile that doubles as the
 * upload control (add more · count · commit). Just-picked photos sit right after
 * it as captioned "pending" cards that morph in on a shared spring; the live
 * photos follow, drag-reorderable and opening a detail editor on click. The
 * whole grid is a drop target, so files can be dropped anywhere over it.
 */
export function GalleryBoard({
  photos,
  blobConfigured,
}: {
  photos: GalleryRow[];
  blobConfigured: boolean;
}) {
  const { refresh } = useRouter();
  const upload = useGalleryUpload(refresh);
  const [editing, setEditing] = useState<GalleryRow | null>(null);

  const t = ru.admin.content.gallery;
  const dz = ru.admin.jewelry.photo.dropzone;

  // Local drag order (ids). Reconciled with server data each render: known ids
  // in their local order, then any new ids appended, dropping removed ones.
  const [order, setOrder] = useState<string[]>(() => photos.map((p) => p.id));
  const byId = new Map(photos.map((p) => [p.id, p]));
  const known = new Set(order);
  const ids = [
    ...order.filter((id) => byId.has(id)),
    ...photos.flatMap((p) => (known.has(p.id) ? [] : [p.id])),
  ];

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cardEls = useRef(new Map<string, HTMLLIElement>());
  const [, startReorder] = useTransition();

  const registerEl = (id: string, el: HTMLLIElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };

  // While dragging, slot the dragged id into the position of whichever card the
  // pointer is over; `layout` then FLIP-animates the displaced cards.
  const onCardDrag = (id: string, x: number, y: number) => {
    let overId: string | null = null;
    for (const [cid, el] of cardEls.current) {
      if (cid === id) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        overId = cid;
        break;
      }
    }
    if (!overId) return;
    const others = ids.filter((x2) => x2 !== id);
    const at = others.indexOf(overId);
    const next = [...others.slice(0, at), id, ...others.slice(at)];
    if (next.join() !== ids.join()) setOrder(next);
  };

  const persistOrder = () => {
    const snapshot = ids;
    startReorder(() => {
      reorderGalleryPhotos(snapshot).then(
        () => toast.success(ru.admin.common.reordered),
        () => {
          toast.error(ru.admin.common.saveError);
          refresh();
        },
      );
    });
  };

  const handleDelete = async (formData: FormData) => {
    await deleteGalleryPhoto(formData);
    toast.success(ru.admin.common.deleted);
    refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      {!blobConfigured ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          {t.blobNotConfigured}
        </p>
      ) : null}

      {/* Rejected files. */}
      <AnimatePresence initial={false}>
        {upload.rejected.length > 0 ? (
          <m.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-xs text-warn"
          >
            {dz.rejected} {upload.rejected.join(", ")}
          </m.p>
        ) : null}
      </AnimatePresence>

      {/* The grid is the drop surface (drop files anywhere over it). */}
      <div {...upload.getRootProps()} className="outline-none">
        <input
          key={upload.inputKey}
          {...upload.getInputProps()}
          className="sr-only"
        />
        <ul className={GRID}>
          <AddTile upload={upload} />

          <AnimatePresence initial={false} mode="popLayout">
            {upload.picked.map((p) => (
              <PendingCard
                key={p.key}
                upload={upload}
                photoKey={p.key}
                preview={p.preview}
                fileName={p.file.name}
                caption={p.caption}
              />
            ))}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="popLayout">
            {ids.map((id) => {
              const photo = byId.get(id);
              if (!photo) return null;
              return (
                <ReorderableCard
                  key={id}
                  photo={photo}
                  dragging={draggingId === id}
                  registerEl={registerEl}
                  onDragStart={() => setDraggingId(id)}
                  onDrag={(x, y) => onCardDrag(id, x, y)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    persistOrder();
                  }}
                  onEdit={() => setEditing(photo)}
                  onDelete={handleDelete}
                />
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <PhotoEditorDrawer
        photo={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}

/* ── "+" tile = add + upload control ─────────────────────────────────────── */

function AddTile({ upload }: { upload: GalleryUpload }) {
  const t = ru.admin.content.gallery;
  const dz = ru.admin.jewelry.photo.dropzone;
  const active = upload.isDragActive;
  const hasPending = upload.count > 0;

  const base = cn(
    "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-center transition-colors duration-200",
    active
      ? "border-accent bg-accent/8"
      : "border-ink/25 bg-ink/3",
  );

  // Pending: the tile becomes the commit control (add more · count · upload).
  if (hasPending) {
    return (
      <li className={base}>
        {upload.pending ? (
          <span className="flex flex-col items-center gap-2 text-mute">
            <Loader2 className="size-6 animate-spin text-accent" />
            <span className="text-xs font-medium">
              {ru.admin.jewelry.photo.uploading}
            </span>
          </span>
        ) : (
          <>
            <Button size="sm" onClick={upload.submit} className="w-full max-w-[10rem]">
              {`${t.upload} · ${upload.count}`}
            </Button>
            <button
              type="button"
              onClick={upload.open}
              className="text-xs font-medium text-mute transition-colors hover:text-ink"
            >
              {t.addMore}
            </button>
            <button
              type="button"
              onClick={upload.clearAll}
              className="text-xs text-mute/70 transition-colors hover:text-ink"
            >
              {dz.clear}
            </button>
          </>
        )}
      </li>
    );
  }

  // Idle: the add affordance.
  return (
    <li>
      <button
        type="button"
        onClick={upload.open}
        className={cn(
          base,
          "group w-full outline-none",
          active
            ? ""
            : "hover:border-ink/40 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
        )}
      >
        <m.span
          aria-hidden
          animate={{ scale: active ? 1.12 : 1, y: active ? -2 : 0 }}
          transition={SPRING}
          className={cn(
            "flex size-10 items-center justify-center rounded-full transition-colors",
            active
              ? "bg-accent/15 text-accent"
              : "bg-ink/8 text-mute group-hover:text-ink",
          )}
        >
          <Plus className="size-5" />
        </m.span>
        <span className="text-xs font-medium text-mute group-hover:text-ink">
          {active ? t.dropToAdd : t.addPhotos}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-mute/60">
          {dz.hint}
        </span>
      </button>
    </li>
  );
}

/* ── Pending (just-picked) card — caption it, then upload ────────────────── */

function PendingCard({
  upload,
  photoKey,
  preview,
  fileName,
  caption,
}: {
  upload: GalleryUpload;
  photoKey: string;
  preview: string;
  fileName: string;
  caption: string;
}) {
  const t = ru.admin.content.gallery;
  const dz = ru.admin.jewelry.photo.dropzone;
  return (
    <m.li
      layout
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.82 }}
      transition={SPRING}
      className="group relative overflow-hidden rounded-xl border border-line bg-card"
    >
      <div className="relative aspect-square overflow-hidden bg-bg">
        {/* `unoptimized` — next/image can't optimize a blob: URL. */}
        <Image
          src={preview}
          alt={fileName}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 25vw"
          className={cn(
            "object-cover transition-opacity",
            upload.pending ? "opacity-40" : "opacity-100",
          )}
        />
        {upload.pending ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-accent" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => upload.removeAt(photoKey)}
            aria-label={`${dz.remove}: ${fileName}`}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-bg/85 text-ink opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {/* Caption input under the thumb — mirrors the live card's footer. */}
      <input
        value={caption}
        disabled={upload.pending}
        onChange={(e) => upload.setCaptionFor(photoKey, e.currentTarget.value)}
        placeholder={t.captionPlaceholder}
        className={CAPTION_INPUT}
      />
    </m.li>
  );
}

/* ── Live photo card — drag to reorder, click to edit ────────────────────── */

function ReorderableCard({
  photo,
  dragging,
  registerEl,
  onDragStart,
  onDrag,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  photo: GalleryRow;
  dragging: boolean;
  registerEl: (id: string, el: HTMLLIElement | null) => void;
  onDragStart: () => void;
  onDrag: (x: number, y: number) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const t = ru.admin.content.gallery;
  const controls = useDragControls();

  const handleDrag = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    onDrag(info.point.x, info.point.y);
  };

  return (
    <m.li
      ref={(el) => registerEl(photo.id, el)}
      // No entrance animation: a just-uploaded card should simply appear like
      // the rest. `layout` drives reorder + delete reflow; disable it on the
      // dragged card so it tracks the pointer instead of FLIP-animating.
      layout={!dragging}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      drag
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      onDragStart={onDragStart}
      onDrag={handleDrag}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.04, boxShadow: "var(--elev-overlay)" }}
      style={{ position: "relative", zIndex: dragging ? 50 : undefined }}
      className="group overflow-hidden rounded-xl border border-line bg-card"
    >
      <div className="relative aspect-square overflow-hidden bg-bg">
        <button
          type="button"
          onClick={onEdit}
          className="absolute inset-0 z-1 block size-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
          aria-label={t.editHeading}
        >
          <Image
            src={photo.url}
            alt={photo.caption ?? ""}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-all duration-200 group-hover:bg-ink/25 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-bg/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
              <Pencil className="size-3.5" />
              {t.editHeading}
            </span>
          </span>
        </button>

        {/* Drag handle — TOP-LEFT, pointer-only (keyboard users edit via the card). */}
        <button
          type="button"
          aria-label={t.reorderHint}
          tabIndex={-1}
          onPointerDown={(e) => controls.start(e)}
          className="absolute left-2 top-2 z-2 flex size-8 cursor-grab touch-none items-center justify-center rounded-full bg-bg/85 text-mute opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:text-ink group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Delete — TOP-RIGHT, hover overlay. */}
        <form className="absolute right-2 top-2 z-2">
          <input type="hidden" name="id" value={photo.id} />
          <ConfirmDeleteButton
            formAction={onDelete}
            confirmText={t.confirmDelete}
            ariaLabel={t.delete}
            className="flex size-8 items-center justify-center rounded-full bg-bg/85 text-ink opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Trash2 className="size-4" />
          </ConfirmDeleteButton>
        </form>

        {!photo.published ? (
          <span className="pointer-events-none absolute bottom-2 left-2 z-2 inline-flex items-center gap-1 rounded-full bg-bg/85 px-2 py-0.5 text-[11px] font-medium text-mute shadow-sm backdrop-blur-sm">
            <EyeOff className="size-3" />
            {t.hiddenBadge}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "truncate border-t border-line px-3 py-2.5 text-sm",
          photo.caption ? "text-ink" : "italic text-mute/50",
        )}
      >
        {photo.caption || t.noCaption}
      </p>
    </m.li>
  );
}
