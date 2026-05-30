"use client";

import { useCallback, useRef, useState } from "react";
import { catalogStrings } from "@/lib/i18n/ru";

interface SelfieDropzoneProps {
  onFile: (file: File) => void;
}

const ACCEPT = "image/*";

/**
 * Client-side selfie picker. Accepts drag-drop or click-to-pick. The
 * resulting File is handed to `onFile` — the parent (`<LiteMode>`) is
 * responsible for running Face Landmarker on it.
 *
 * Privacy hint is embedded under the CTA so the user sees it before
 * uploading anything.
 */
export function SelfieDropzone({ onFile }: SelfieDropzoneProps) {
  const t = catalogStrings.liteMode.dropzone;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      // Reset so picking the same file twice still fires onChange.
      e.target.value = "";
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = Array.from(e.dataTransfer.files).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handlePick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex h-full min-h-[60vh] cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-line bg-card hover:border-primary/60"
      }`}
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-2xl font-semibold text-ink">{t.title}</h2>
        <p className="text-sm leading-relaxed text-mute">{t.lead}</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary">
          {t.cta}
        </span>
        <span className="text-xs text-mute">{t.dropHint}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="sr-only"
        aria-label={t.cta}
      />
    </div>
  );
}
