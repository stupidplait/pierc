"use client";

import { useActionState } from "react";
import {
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
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

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={jewelryId} />

      {!blobConfigured ? (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {ru.admin.jewelry.photo.blobNotConfigured}
        </p>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.fileLabel}</span>
        <input
          type="file"
          name="file"
          accept=".glb,model/gltf-binary"
          required
          aria-label={t.fileLabel}
          className="block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-primary hover:file:bg-primary-soft"
        />
      </label>

      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "…" : t.upload}
        </PrimarySubmit>
      </div>
    </form>
  );
}
