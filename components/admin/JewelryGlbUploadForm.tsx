"use client";

import { useActionState } from "react";
import {
  FileField,
  InlineStatus,
  SubmitPill,
} from "@/components/admin/form/atelier";
import {
  uploadJewelryGlb,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import { ru } from "@/lib/i18n/ru";

interface JewelryGlbUploadFormProps {
  jewelryId: string;
  blobConfigured: boolean;
}

export function JewelryGlbUploadForm({
  jewelryId,
  blobConfigured,
}: JewelryGlbUploadFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadJewelryGlb,
    undefined,
  );
  const t = ru.admin.jewelry.model;

  // Card-less on purpose — this form is a sub-block inside the model manager
  // card, so an outer surface would read as a card-in-card.
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={jewelryId} />

      {!blobConfigured ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          {ru.admin.jewelry.photo.blobNotConfigured}
        </p>
      ) : null}

      <FileField
        name="file"
        label={t.fileLabel}
        accept=".glb,model/gltf-binary"
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
