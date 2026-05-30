"use client";

import { useActionState } from "react";
import {
  FileField,
  InlineStatus,
  SubmitPill,
} from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import {
  uploadJewelryPhotos,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

interface JewelryPhotoUploadFormProps {
  jewelryId: string;
  blobConfigured: boolean;
}

export function JewelryPhotoUploadForm({
  jewelryId,
  blobConfigured,
}: JewelryPhotoUploadFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadJewelryPhotos,
    undefined,
  );
  const t = ru.admin.jewelry.photo;

  return (
    <form action={action} className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
      <input type="hidden" name="id" value={jewelryId} />

      {!blobConfigured ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          {t.blobNotConfigured}
        </p>
      ) : null}

      <FileField
        name="files"
        label={t.fileLabel}
        accept="image/*"
        multiple
        required
      />

      <div className="flex flex-wrap items-center gap-4">
        <SubmitPill pending={pending}>
          {pending ? "…" : t.upload}
        </SubmitPill>
        <InlineStatus state={state} />
      </div>
    </form>
  );
}
