"use client";

import { useActionState } from "react";
import {
  CardHeader,
  Field,
  FileField,
  InlineStatus,
  Reveal,
  SubmitPill,
} from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import {
  uploadGalleryPhoto,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

export function GalleryUploadForm({
  blobConfigured = true,
  onUploaded,
}: {
  blobConfigured?: boolean;
  /** Fires after a successful upload — the gallery panel uses it to refresh. */
  onUploaded?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const res = await uploadGalleryPhoto(prev, formData);
      if (res?.ok) onUploaded?.();
      return res;
    },
    undefined,
  );
  const t = ru.admin.content.gallery;

  return (
    <Reveal>
      <form action={action} className={`${CARD} flex flex-col gap-5 p-7 sm:p-9`}>
        <CardHeader title={t.uploadHeading} />

        {!blobConfigured ? (
          <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
            {t.blobNotConfigured}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <FileField
            name="file"
            label={t.fileLabel}
            accept="image/*"
            required
          />
          <Field
            name="caption"
            label={t.captionLabel}
            placeholder={t.captionPlaceholder}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitPill pending={pending}>
            {pending ? "…" : t.upload}
          </SubmitPill>
          <InlineStatus state={state} />
        </div>
      </form>
    </Reveal>
  );
}
