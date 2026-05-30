"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBMIT } from "@/components/admin/form/styles";
import { InlineStatus } from "@/components/admin/form/atelier";
import {
  uploadJewelryPhotos,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

const MAX_BYTES = 8 * 1024 * 1024;

interface Picked {
  /** Stable key — file identity survives re-renders without an index. */
  key: string;
  file: File;
  preview: string;
}

/** Russian count agreement: 1 файл / 2–4 файла / 5+ файлов. */
function plural(n: number, d: typeof ru.admin.jewelry.photo.dropzone): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return d.filesOne;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return d.filesFew;
  return d.filesMany;
}

/**
 * Drag-and-drop photo uploader for the jewelry editor. Wraps react-dropzone in
 * the Steel Atelier vocabulary: a dashed drop surface that lifts to the accent
 * tone while a file hovers, a thumbnail strip with per-file remove, and a
 * pending-aware submit. Files are held client-side until submit, then handed to
 * the existing `uploadJewelryPhotos` server action as a `files` FormData list —
 * the action and its validation are unchanged.
 */
export function PhotoDropzone({ jewelryId }: { jewelryId: string }) {
  const t = ru.admin.jewelry.photo;
  const d = t.dropzone;

  const [picked, setPicked] = useState<Picked[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

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
          key: `${file.name}-${file.size}-${file.lastModified}`,
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
    const fd = new FormData();
    fd.set("id", jewelryId);
    for (const p of picked) fd.append("files", p.file);

    startTransition(async () => {
      const result = await uploadJewelryPhotos(undefined, fd);
      setState(result);
      if (result?.ok) {
        for (const p of picked) URL.revokeObjectURL(p.preview);
        setPicked([]);
        setRejected([]);
      }
    });
  };

  const count = picked.length;

  return (
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
        <input {...getInputProps()} className="sr-only" />
        <motion.span
          aria-hidden
          animate={{ y: isDragActive ? -4 : 0, scale: isDragActive ? 1.08 : 1 }}
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
      {rejected.length > 0 ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-xs text-warn">
          {d.rejected} {rejected.join(", ")}
        </p>
      ) : null}

      {/* ── Thumbnail strip ──────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2.5 overflow-hidden"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {picked.map((p) => (
                <motion.li
                  key={p.key}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-bg"
                >
                  {/* Local object-URL preview — not a remote asset, so a plain
                      <img> is correct here (next/image would try to optimize a
                      blob: URL). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt={p.file.name}
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(p.key)}
                    aria-label={`${d.remove}: ${p.file.name}`}
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink opacity-0 backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <X className="size-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || count === 0}
          className={SUBMIT}
        >
          {pending
            ? "…"
            : count > 0
              ? `${t.upload} ${count} ${plural(count, d)}`
              : t.upload}
        </button>
        {count > 0 && !pending ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-mute transition-colors hover:text-ink"
          >
            {d.clear}
          </button>
        ) : null}
        <InlineStatus state={state} />
      </div>
    </div>
  );
}
