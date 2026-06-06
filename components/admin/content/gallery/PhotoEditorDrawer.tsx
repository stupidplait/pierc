"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "@/components/booking/Drawer";
import { Button } from "@/components/shadcn/ui/button";
import { Input } from "@/components/shadcn/ui/input";
import { Label } from "@/components/shadcn/ui/label";
import { Switch } from "@/components/shadcn/ui/switch";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  deleteGalleryPhoto,
  replaceGalleryPhoto,
  updateGalleryPhoto,
} from "@/lib/admin/content-actions";
import type { GalleryRow } from "@/lib/admin/content-view";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

/**
 * Detail editor for a single gallery photo — the per-card CRUD that the grid
 * never exposed even though the action ({@link updateGalleryPhoto}) supports it:
 * rename the caption, show/hide it from the public gallery, or delete. Reuses the
 * shared {@link Drawer} (same one the service/FAQ editors ride) with a sticky
 * Save/Delete footer.
 *
 * `open` is `!!photo`. The body is keyed by `photo.id` so each open remounts with
 * fresh defaults (no set-state-in-effect re-seed).
 */
export function PhotoEditorDrawer({
  photo,
  onClose,
  onSaved,
}: {
  photo: GalleryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Drawer
      open={!!photo}
      onClose={onClose}
      title={ru.admin.content.gallery.editHeading}
      subtitle={photo?.caption ?? ru.admin.content.gallery.noCaption}
    >
      {photo ? (
        <EditorBody key={photo.id} photo={photo} onSaved={onSaved} />
      ) : null}
    </Drawer>
  );
}

function EditorBody({
  photo,
  onSaved,
}: {
  photo: GalleryRow;
  onSaved: () => void;
}) {
  const t = ru.admin.content.gallery;
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [published, setPublished] = useState(photo.published);
  const [pending, startTransition] = useTransition();
  const [replacing, startReplace] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", photo.id);
      fd.set("caption", caption.trim());
      fd.set("order", String(photo.order));
      if (published) fd.set("published", "on");
      await updateGalleryPhoto(fd);
      toast.success(ru.admin.common.saved);
      onSaved();
    });
  };

  const handleDelete = async (formData: FormData) => {
    await deleteGalleryPhoto(formData);
    toast.success(ru.admin.common.deleted);
    onSaved();
  };

  const onPickReplacement = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = ""; // allow re-picking the same file
    if (!file) return;
    startReplace(async () => {
      const fd = new FormData();
      fd.set("id", photo.id);
      fd.set("file", file);
      const res = await replaceGalleryPhoto(fd);
      if (res?.ok) {
        toast.success(res.message ?? ru.admin.common.saved);
        onSaved();
      } else {
        toast.error(res?.error ?? ru.admin.common.saveError);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="group relative aspect-4/3 overflow-hidden rounded-xl border border-line bg-bg">
        <Image
          src={photo.url}
          alt={caption || ""}
          fill
          sizes="(max-width: 640px) 100vw, 28rem"
          className={cn(
            "object-cover transition-opacity",
            replacing ? "opacity-40" : "opacity-100",
          )}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label={t.replacePhoto}
          onChange={onPickReplacement}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={replacing}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-bg/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
        >
          {replacing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UploadCloud className="size-3.5" />
          )}
          {t.replacePhoto}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`cap-${photo.id}`}>{t.captionLabel}</Label>
        <Input
          id={`cap-${photo.id}`}
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
          placeholder={t.captionPlaceholder}
        />
      </div>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-4 py-3">
        <span className="text-sm font-medium text-ink">
          {t.publishedLabel}
        </span>
        <Switch checked={published} onCheckedChange={setPublished} />
      </label>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        <form>
          <input type="hidden" name="id" value={photo.id} />
          <ConfirmDeleteButton
            formAction={handleDelete}
            confirmText={t.confirmDelete}
            ariaLabel={t.delete}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 text-sm font-medium text-error transition-colors hover:border-error/50 hover:bg-error/15"
          >
            <Trash2 className="size-4" />
            {t.delete}
          </ConfirmDeleteButton>
        </form>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t.save}
            </>
          ) : (
            t.save
          )}
        </Button>
      </div>
    </div>
  );
}
