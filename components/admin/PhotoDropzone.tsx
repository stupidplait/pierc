"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBMIT, GHOST } from "@/components/admin/form/styles";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { AnimateNumber } from "@/components/ui/AnimateNumber";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";
import {
  uploadJewelryPhotos,
  createDraftAndUploadPhotos,
  removeJewelryPhoto,
  setJewelryCoverPhoto,
  toggleJewelryPhotoGen,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

const MAX_BYTES = 8 * 1024 * 1024;

/** A styled tooltip wrapper for the icon buttons on each tile. */
function IconTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface Picked {
  /** Stable key — file identity survives re-renders without an index. */
  key: string;
  file: File;
  preview: string;
}

export interface ExistingPhoto {
  url: string;
  alt: string;
  /** Flagged to feed 3D auto-generation. */
  gen?: boolean;
}

/** Russian count agreement: 1 файл / 2–4 файла / 5+ файлов. */
function plural(n: number, d: typeof ru.admin.jewelry.photo.dropzone): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return d.filesOne;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return d.filesFew;
  return d.filesMany;
}

/**
 * Unified photo manager for the jewelry editor. One surface holds everything:
 * the drop zone, the already-uploaded photos (pulled from Vercel Blob, marked
 * with a check + their cover/delete controls), and the freshly-picked files
 * waiting to be sent. Picks are held client-side until submit, then handed to
 * `uploadJewelryPhotos`; on success the page revalidates and the new shots slot
 * into the uploaded row. Add/remove animate; the submit shows a spinner.
 */
export function PhotoDropzone({
  jewelryId,
  photos = [],
  formId,
}: {
  /** The piece's id once persisted. Omitted on the add page — the first upload
   *  creates the piece and redirects to its edit page (see `submit`). */
  jewelryId?: string;
  /** Already-persisted photos (cover first). */
  photos?: ExistingPhoto[];
  /** Editor form id (add page only). When there's no `jewelryId`, the upload
   *  reads this form's current fields so the created piece is populated, not
   *  blank — see `createDraftAndUploadPhotos`. */
  formId?: string;
}) {
  const t = ru.admin.jewelry.photo;
  const d = t.dropzone;

  const [picked, setPicked] = useState<Picked[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();
  // Bumped after each successful upload to remount the file <input>, so the
  // exact same file can be re-picked after being deleted (a native input won't
  // fire `change` when its value is unchanged).
  const [inputKey, setInputKey] = useState(0);
  // Monotonic id so two picks of the identical file never collide on key (which
  // would make a re-picked file silently not render).
  const uid = useRef(0);

  // Revoke object URLs on unmount only. The ref is kept current in a separate
  // effect so the unmount cleanup (empty-deps) sees the latest previews without
  // a `picked` dependency that would revoke live URLs mid-session.
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  });
  useEffect(() => {
    return () => {
      for (const p of pickedRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setState(undefined);
      setRejected(rejections.map((r) => r.file.name));
      if (accepted.length === 0) return;
      setPicked((prev) => [
        ...prev,
        ...accepted.map((file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}-${uid.current++}`,
          file,
          preview: URL.createObjectURL(file),
        })),
      ]);
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxSize: MAX_BYTES,
    // The drop surface is a <label> wrapping the file input, so the native
    // label→input association handles click + keyboard. Disable dropzone's own
    // click/keyboard openers to avoid opening the dialog twice.
    noClick: true,
    noKeyboard: true,
  });

  const removeAt = (key: string) =>
    setPicked((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((p) => p.key !== key);
    });

  const clearAll = () => {
    for (const p of picked) URL.revokeObjectURL(p.preview);
    setPicked([]);
    setRejected([]);
    setState(undefined);
  };

  const submit = () => {
    if (picked.length === 0) return;

    startTransition(async () => {
      if (!jewelryId) {
        // No row yet (add page): create the piece WITH the editor form's
        // current fields (so it isn't a blank record) + attach the photos, in
        // one step. On success the action redirects to the new edit page and
        // this component unmounts (its object URLs are revoked by the unmount
        // effect), so only a failure falls through to surface an error here.
        const formEl =
          formId && typeof document !== "undefined"
            ? (document.getElementById(formId) as HTMLFormElement | null)
            : null;
        const fd = formEl ? new FormData(formEl) : new FormData();
        for (const p of picked) fd.append("files", p.file);
        const result = await createDraftAndUploadPhotos(undefined, fd);
        setState(result);
        return;
      }

      const fd = new FormData();
      fd.set("id", jewelryId);
      for (const p of picked) fd.append("files", p.file);
      const result = await uploadJewelryPhotos(undefined, fd);
      setState(result);
      if (result?.ok) {
        for (const p of picked) URL.revokeObjectURL(p.preview);
        setPicked([]);
        setRejected([]);
        setInputKey((k) => k + 1); // fresh input → same file can be re-picked
      }
    });
  };

  const count = picked.length;
  const hasTiles = photos.length > 0 || count > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-4">
        {/* ── Drop surface ─────────────────────────────────────────── */}
        {/* A <label> so a native click/keyboard activation opens the file
          dialog (dropzone's own openers are disabled); drag/drop handlers
          still come from getRootProps. */}
        <label
          {...getRootProps()}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center outline-none transition-colors duration-200",
            isDragActive
              ? "border-accent bg-accent/8"
              : "border-ink/20 bg-ink/3 hover:border-ink/35 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30",
          )}
        >
          <input key={inputKey} {...getInputProps()} className="sr-only" />
          <motion.span
            aria-hidden
            animate={{
              y: isDragActive ? -4 : 0,
              scale: isDragActive ? 1.08 : 1,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={cn(
              "flex size-12 items-center justify-center rounded-full transition-colors",
              isDragActive
                ? "bg-accent/15 text-accent"
                : "bg-ink/8 text-mute group-hover:text-ink",
            )}
          >
            <UploadCloud className="size-6" />
          </motion.span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-ink">
              {isDragActive ? d.active : d.idle}
            </span>
            <span className="text-xs text-mute">{d.browse}</span>
          </div>
          <span className="text-[11px] uppercase tracking-wide text-mute/70">
            {d.hint}
          </span>
        </label>

        {/* ── Rejected files notice ────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {rejected.length > 0 ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-xs text-warn"
            >
              {d.rejected} {rejected.join(", ")}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* ── Unified grid: uploaded photos + freshly-picked files ─── */}
        <AnimatePresence initial={false}>
          {hasTiles ? (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3 overflow-hidden"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {/* Already uploaded — cover first, each marked + actionable. */}
                {photos.map((p, i) => (
                  <motion.li
                    key={p.url}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-bg"
                  >
                    <Image
                      src={p.url}
                      alt={p.alt}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                    {i === 0 ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bg backdrop-blur-sm">
                        {t.cover}
                      </span>
                    ) : null}

                    {/* 3D-generation toggle — icon only, in the shared circular
                      style. Stays visible when ON (accent) so the flagged set is
                      legible at a glance; OFF reveals on hover like the others. */}
                    <form className="absolute bottom-1.5 left-1.5">
                      <input type="hidden" name="id" value={jewelryId} />
                      <input type="hidden" name="url" value={p.url} />
                      <IconTip label={p.gen ? t.gen3dExclude : t.gen3dInclude}>
                        <button
                          type="submit"
                          formAction={toggleJewelryPhotoGen}
                          aria-pressed={p.gen ? "true" : "false"}
                          aria-label={p.gen ? t.gen3dExclude : t.gen3dInclude}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                            p.gen
                              ? "bg-accent text-bg opacity-100"
                              : "bg-bg/80 text-ink opacity-0 hover:bg-bg group-hover:opacity-100",
                          )}
                        >
                          <Sparkles className="size-4" aria-hidden />
                        </button>
                      </IconTip>
                    </form>

                    {/* Promote to cover — bottom-right on hover (non-cover only). */}
                    {i !== 0 ? (
                      <form className="absolute bottom-1.5 right-1.5">
                        <input type="hidden" name="id" value={jewelryId} />
                        <input type="hidden" name="url" value={p.url} />
                        <IconTip label={t.setCover}>
                          <button
                            type="submit"
                            formAction={setJewelryCoverPhoto}
                            aria-label={
                              p.alt ? `${t.setCover}: ${p.alt}` : t.setCover
                            }
                            className="flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink opacity-0 backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            <Star className="size-4" aria-hidden />
                          </button>
                        </IconTip>
                      </form>
                    ) : null}

                    {/* Uploaded mark — a check, no status text. */}
                    <span
                      title={t.uploaded}
                      aria-label={t.uploaded}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-success/90 text-bg shadow-sm transition-opacity group-hover:opacity-0"
                    >
                      <Check className="size-3" aria-hidden />
                    </span>
                    {/* Delete — replaces the mark on hover. */}
                    <form className="absolute right-1.5 top-1.5">
                      <input type="hidden" name="id" value={jewelryId} />
                      <input type="hidden" name="url" value={p.url} />
                      <IconTip label={t.delete}>
                        <ConfirmDeleteButton
                          formAction={removeJewelryPhoto}
                          confirmText={t.confirmDelete}
                          ariaLabel={p.alt ? `${t.delete}: ${p.alt}` : t.delete}
                          className="flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink opacity-0 backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <Trash2 className="size-4" />
                        </ConfirmDeleteButton>
                      </IconTip>
                    </form>
                  </motion.li>
                ))}

                {/* Freshly picked — not yet uploaded: dashed accent frame, a
                  spinner overlay while the upload is in flight. */}
                {picked.map((p) => (
                  <motion.li
                    key={p.key}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-dashed border-accent/50 bg-bg"
                  >
                    {/* Local object-URL preview — not a remote asset, so a plain
                      <img> is correct here (next/image would try to optimize a
                      blob: URL). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.preview}
                      alt={p.file.name}
                      className={cn(
                        "size-full object-cover transition-opacity",
                        pending ? "opacity-40" : "opacity-100",
                      )}
                    />
                    <AnimatePresence>
                      {pending ? (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <Loader2 className="size-5 animate-spin text-accent" />
                        </motion.span>
                      ) : (
                        <motion.button
                          type="button"
                          onClick={() => removeAt(p.key)}
                          aria-label={`${d.remove}: ${p.file.name}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink opacity-0 backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <X className="size-4" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : null}
        </AnimatePresence>

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* `layout` animates the button's width as the label changes; the icon
              crossfades and the file count rolls via AnimateNumber. */}
          <motion.button
            layout
            type="button"
            onClick={submit}
            disabled={pending || count === 0}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(SUBMIT, "gap-2 overflow-hidden")}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={pending ? "spin" : "up"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                className="flex"
                aria-hidden
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
              </motion.span>
            </AnimatePresence>
            <motion.span
              layout
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {pending ? (
                  <motion.span
                    key="uploading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {t.uploading}
                  </motion.span>
                ) : count > 0 ? (
                  <motion.span
                    key="count"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1"
                  >
                    {t.upload} <AnimateNumber value={count} />{" "}
                    {plural(count, d)}
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {t.upload}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
          </motion.button>
          <AnimatePresence initial={false}>
            {count > 0 && !pending ? (
              <motion.button
                type="button"
                onClick={clearAll}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(GHOST, "gap-2")}
              >
                <X className="size-4" aria-hidden />
                {d.clear}
              </motion.button>
            ) : null}
          </AnimatePresence>
          {/* Errors only — success is conveyed by the photo joining the grid. */}
          {state && !state.ok ? (
            <span
              role="alert"
              aria-live="assertive"
              className="text-sm text-error"
            >
              {state.error}
            </span>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
