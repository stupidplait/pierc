"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormStatus } from "@/components/admin/FormFields";
import {
  uploadJewelrySprite,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

interface SpriteAutoRemoverProps {
  jewelryId: string;
  blobConfigured: boolean;
  /** Callback when the admin asks to switch to the manual upload flow. */
  onSwitchToManual: () => void;
}

type Stage = "idle" | "removing" | "ready" | "error";

/**
 * Auto bg-removal sprite uploader.
 *
 * Pipeline:
 *   1. Admin picks a regular jewelry photo.
 *   2. We dynamic-import @imgly/background-removal and run it in the
 *      admin's browser. Models load from our self-hosted Vercel Blob
 *      mirror (`IMGLY_PUBLIC_PATH`) — see scripts/lite/upload-wasm-assets.mjs.
 *   3. The resulting transparent PNG is previewed over a CSS checker tile.
 *   4. Admin clicks "Сохранить" — we POST the cutout to uploadJewelrySprite.
 *   5. On bad cutouts admin can flip to manual upload via onSwitchToManual.
 *
 * State machine: idle → removing → (ready | error). Switching files resets.
 */
export function SpriteAutoRemover({
  jewelryId,
  blobConfigured,
  onSwitchToManual,
}: SpriteAutoRemoverProps) {
  const t = ru.admin.jewelry.sprite;

  const [stage, setStage] = useState<Stage>("idle");
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<ActionState>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the previous object URL when result changes / unmounts.
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset previous result.
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultBlob(null);
      setResultUrl(null);
      setSubmitState(undefined);
      setOriginalName(file.name);
      setStage("removing");
      setErrorMsg("");
      setProgressMsg(t.autoStarting);

      try {
        const { removeBackground } = await import("@/lib/lite/bg-removal");
        const blob = await removeBackground(file, {
          onProgress: ({ message, fraction }) => {
            const pct = Math.round(fraction * 100);
            setProgressMsg(`${message} ${pct ? `(${pct}%)` : ""}`.trim());
          },
        });
        const url = URL.createObjectURL(blob);
        setResultBlob(blob);
        setResultUrl(url);
        setStage("ready");
        setProgressMsg("");
      } catch (err) {
        setStage("error");
        setErrorMsg(
          err instanceof Error ? err.message : String(err ?? "Unknown error"),
        );
      }
    },
    [resultUrl, t.autoStarting],
  );

  const handleSave = useCallback(async () => {
    if (!resultBlob || !originalName) return;
    setSubmitting(true);

    // Repackage the Blob as a File with a .png extension so the server
    // action's MIME + extension validation passes.
    const safeBase = originalName.replace(/\.[^.]+$/, "").slice(0, 80);
    const file = new File([resultBlob], `${safeBase}.png`, {
      type: "image/png",
    });
    const fd = new FormData();
    fd.set("id", jewelryId);
    fd.set("file", file);

    const result = await uploadJewelrySprite(undefined, fd);
    setSubmitState(result);
    setSubmitting(false);
  }, [resultBlob, originalName, jewelryId]);

  const handlePickAgain = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {!blobConfigured ? (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {ru.admin.jewelry.photo.blobNotConfigured}
        </p>
      ) : null}

      <p className="max-w-prose text-sm text-mute">{t.autoLead}</p>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.autoFileLabel}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          aria-label={t.autoFileLabel}
          className="block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-primary hover:file:bg-primary-soft"
        />
      </label>

      {stage === "removing" ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-page px-4 py-3 text-sm text-mute">
          <span
            className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary"
            aria-hidden
          />
          <span>{t.autoProcessing}</span>
          {progressMsg ? (
            <span className="truncate text-xs text-mute/80">
              {progressMsg}
            </span>
          ) : null}
        </div>
      ) : null}

      {stage === "error" ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          <span className="font-medium">{t.autoErrorTitle}</span>
          <span className="text-xs">{errorMsg}</span>
          <span className="text-xs">{t.autoErrorHint}</span>
        </div>
      ) : null}

      {stage === "ready" && resultUrl ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-page p-4">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-mute">
            {t.autoPreviewLabel}
          </span>
          <div
            className="relative h-48 w-full max-w-xs rounded-xl border border-line"
            style={{
              backgroundColor: "#ffffff",
              backgroundImage:
                "linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%), linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 8px 8px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt={t.autoPreviewLabel}
              className="absolute inset-0 h-full w-full rounded-xl object-contain p-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSave}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none disabled:opacity-50"
            >
              {submitting ? "…" : t.autoSave}
            </button>
            <button
              type="button"
              onClick={handlePickAgain}
              className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
            >
              {t.autoPickAgain}
            </button>
          </div>
          <FormStatus state={submitState} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSwitchToManual}
        className="self-start text-xs text-mute underline-offset-4 hover:underline"
      >
        {t.autoSwitchManual}
      </button>
    </div>
  );
}
