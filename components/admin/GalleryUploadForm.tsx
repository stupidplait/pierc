"use client";

import { useActionState } from "react";
import {
  TextField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import {
  uploadGalleryPhoto,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

export function GalleryUploadForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadGalleryPhoto,
    undefined,
  );
  const t = ru.admin.content.gallery;

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-card/40 p-5"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.fileLabel}</span>
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          aria-label={t.fileLabel}
          className="block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-primary hover:file:bg-primary-soft"
        />
      </label>
      <TextField name="caption" label={t.captionLabel} />
      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "…" : t.upload}
        </PrimarySubmit>
      </div>
    </form>
  );
}
