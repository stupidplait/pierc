"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  useDropzone,
  type DropzoneRootProps,
  type DropzoneInputProps,
  type FileRejection,
} from "react-dropzone";
import { toast } from "sonner";
import { uploadGalleryPhoto } from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

const MAX_BYTES = 8 * 1024 * 1024;

export interface Picked {
  /** Stable key so a re-picked identical file never collides. */
  key: string;
  file: File;
  preview: string;
  /** Per-photo caption, edited inline on the pending card before upload. */
  caption: string;
}

export interface GalleryUpload {
  // Dropzone plumbing — attach root props to the grid wrapper (drop anywhere)
  // and render the input via getInputProps inside it.
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
  /** Opens the file dialog programmatically (the "+" tile / Add button). */
  open: () => void;
  isDragActive: boolean;
  /** Bumped after a batch so the same file can be re-picked. Key the input on it. */
  inputKey: number;

  picked: Picked[];
  rejected: string[];
  count: number;
  pending: boolean;

  setCaptionFor: (key: string, caption: string) => void;
  removeAt: (key: string) => void;
  clearAll: () => void;
  submit: () => void;
}

/**
 * The gallery upload engine. Drag-or-pick multiple files, each becoming a
 * "pending" card in the grid with its OWN caption (the studio captions photos
 * individually before committing). Upload is sequential on purpose: the action
 * appends order = max+1, so concurrent uploads would read the same max and
 * collide on order.
 */
export function useGalleryUpload(onUploaded?: () => void): GalleryUpload {
  const t = ru.admin.content.gallery;

  const [picked, setPicked] = useState<Picked[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [inputKey, setInputKey] = useState(0);
  const counter = useRef(0);

  // Revoke object URLs on unmount only. Reading the LATEST previews from a ref
  // in the cleanup is the intent (not a stale-ref bug): we want to free whatever
  // is picked at unmount, without a `picked` dep that would revoke live URLs.
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  });
  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => {
    return () => {
      for (const p of pickedRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setRejected(rejections.map((r) => r.file.name));
    if (accepted.length === 0) return;
    setPicked((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${counter.current++}`,
        file,
        preview: URL.createObjectURL(file),
        caption: "",
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxSize: MAX_BYTES,
    // The grid wrapper never opens the dialog on its own click (that's the "+"
    // tile / Add button via open()) so clicking a photo card doesn't pop a file
    // dialog.
    noClick: true,
    noKeyboard: true,
  });

  const setCaptionFor = (key: string, caption: string) =>
    setPicked((prev) =>
      prev.map((p) => (p.key === key ? { ...p, caption } : p)),
    );

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
  };

  const submit = () => {
    if (picked.length === 0) return;
    const batch = picked;
    startTransition(async () => {
      let errored: string | undefined;
      // Sequential ON PURPOSE: uploadGalleryPhoto appends order = max+1, so
      // concurrent uploads would read the same max and collide on order.
      for (const p of batch) {
        const fd = new FormData();
        fd.set("file", p.file);
        const cap = p.caption.trim();
        if (cap) fd.set("caption", cap);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const res = await uploadGalleryPhoto(undefined, fd);
        if (!res?.ok) errored = res?.error ?? ru.admin.common.saveError;
      }
      for (const p of batch) URL.revokeObjectURL(p.preview);
      setPicked([]);
      setRejected([]);
      setInputKey((k) => k + 1);
      if (errored) toast.error(errored);
      else toast.success(t.uploaded);
      onUploaded?.();
    });
  };

  return {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
    inputKey,
    picked,
    rejected,
    count: picked.length,
    pending,
    setCaptionFor,
    removeAt,
    clearAll,
    submit,
  };
}
