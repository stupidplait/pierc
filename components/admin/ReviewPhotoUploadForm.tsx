"use client";

import { useActionState } from "react";
import {
  uploadReviewPhoto,
  type ReviewActionState,
} from "@/lib/admin/review-actions";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";

interface ReviewPhotoUploadFormProps {
  reviewId: string;
  blobConfigured: boolean;
}

export function ReviewPhotoUploadForm({
  reviewId,
  blobConfigured,
}: ReviewPhotoUploadFormProps) {
  const [state, action, pending] = useActionState<
    ReviewActionState,
    FormData
  >(uploadReviewPhoto, undefined);
  const t = ru.admin.reviews.photo;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={reviewId} />

      {!blobConfigured ? (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {ru.admin.jewelry.photo.blobNotConfigured}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-mute">{t.fileLabel}</span>
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          aria-label={t.fileLabel}
          className="block w-full rounded-xl border border-ink/15 bg-ink/3 text-sm text-ink outline-none transition-colors file:mr-4 file:h-11 file:border-0 file:bg-ink/5 file:px-4 file:text-sm file:font-medium file:text-ink hover:file:bg-ink/10 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : t.upload}
        </Button>
        {state ? (
          state.ok ? (
            <span
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-success"
            >
              {state.message ?? ru.admin.common.saved}
            </span>
          ) : (
            <span role="alert" aria-live="assertive" className="text-sm text-error">
              {state.error}
            </span>
          )
        ) : null}
      </div>
    </form>
  );
}
