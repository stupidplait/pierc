"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBMIT } from "@/components/admin/form/styles";
import { InlineStatus } from "@/components/admin/form/atelier";
import { GlbPreview } from "@/components/admin/GlbPreview";
import { uploadJewelryGlb, type ActionState } from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

// Mirrors GLB_MAX_BYTES in jewelry-actions — the server re-validates, this just
// rejects oversized files before they ever hit the network.
const MAX_BYTES = 25 * 1024 * 1024;

interface Picked {
  file: File;
  /** Object URL feeding the live r3f preview; revoked when replaced/cleared. */
  url: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

/**
 * Drag-and-drop .glb uploader for the jewelry 3D-model panel — the single-file
 * sibling of PhotoDropzone. Reuses the Steel Atelier drop surface, but instead
 * of an <img> thumbnail it renders the picked model in the live r3f viewer
 * (GlbPreview), so the studio can orbit/inspect the mesh *before* committing the
 * upload. The file is held client-side until submit, then handed to the existing
 * `uploadJewelryGlb` server action as a single `file` — the action and its
 * validation (extension, 25 MB cap, blob cleanup) are unchanged.
 */
export function GlbDropzone({
  jewelryId,
  blobConfigured,
}: {
  jewelryId: string;
  blobConfigured: boolean;
}) {
  const t = ru.admin.jewelry.model;
  const d = t.dropzone;

  const [picked, setPicked] = useState<Picked | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

  // Revoke the live object URL on unmount. Kept current via a ref so the
  // empty-deps cleanup sees the latest pick without revoking it mid-session.
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  });
  useEffect(() => {
    return () => {
      if (pickedRef.current) URL.revokeObjectURL(pickedRef.current.url);
    };
  }, []);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setState(undefined);
      setRejected(rejections[0]?.file.name ?? null);
      const file = accepted[0];
      if (!file) return;
      setPicked((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file) };
      });
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // .glb often arrives with an empty MIME type; the extension entry makes
    // react-dropzone accept it by name regardless of what the browser reports.
    accept: { "model/gltf-binary": [".glb"] },
    maxSize: MAX_BYTES,
    multiple: false,
    maxFiles: 1,
    // The drop surface is a <label> wrapping the input, so native label→input
    // handles click + keyboard; disable dropzone's own openers to avoid a
    // double dialog.
    noClick: true,
    noKeyboard: true,
  });

  const clear = () => {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
    setRejected(null);
    setState(undefined);
  };

  const submit = () => {
    if (!picked) return;
    const fd = new FormData();
    fd.set("id", jewelryId);
    fd.set("file", picked.file);

    startTransition(async () => {
      const result = await uploadJewelryGlb(undefined, fd);
      setState(result);
      if (result?.ok) {
        URL.revokeObjectURL(picked.url);
        setPicked(null);
        setRejected(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!blobConfigured ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          {ru.admin.jewelry.photo.blobNotConfigured}
        </p>
      ) : null}

      {/* ── Drop surface ─────────────────────────────────────────── */}
      {/* A <label> so a native click/keyboard activation opens the file dialog
          (dropzone's own openers are disabled); drag/drop still comes from
          getRootProps. */}
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
            {isDragActive ? d.active : picked ? d.replace : d.idle}
          </span>
          <span className="text-xs text-mute">{d.browse}</span>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-mute/70">
          {d.hint}
        </span>
      </label>

      {/* ── Rejected file notice ─────────────────────────────────── */}
      {rejected ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-xs text-warn">
          {d.rejected} {rejected}
        </p>
      ) : null}

      {/* ── Picked-model preview (live r3f viewer) ───────────────── */}
      <AnimatePresence initial={false}>
        {picked ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="relative w-full sm:max-w-[16rem]">
                <GlbPreview url={picked.url} />
                <button
                  type="button"
                  onClick={clear}
                  aria-label={`${d.clear}: ${picked.file.name}`}
                  className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink backdrop-blur-sm transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex min-w-0 flex-col gap-1 pt-1">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Box className="size-4 shrink-0 text-mute" aria-hidden />
                  <span className="truncate">{picked.file.name}</span>
                </span>
                <span className="text-xs tabular-nums text-mute">
                  {formatBytes(picked.file.size)}
                </span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !picked || !blobConfigured}
          className={SUBMIT}
        >
          {pending ? "…" : t.upload}
        </button>
        {picked && !pending ? (
          <button
            type="button"
            onClick={clear}
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
