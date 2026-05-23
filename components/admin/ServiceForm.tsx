"use client";

import { useActionState } from "react";
import {
  TextField,
  TextAreaField,
  NumberField,
  CheckboxField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  upsertService,
  deleteService,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

interface ServiceLike {
  id?: string;
  name?: string;
  description?: string | null;
  price?: number | string | null;
  durationMin?: number | null;
  order?: number | null;
  published?: boolean;
}

interface ServiceFormProps {
  initial?: ServiceLike;
  // When true, this is the "Add new" form rather than an existing-row edit.
  isNew?: boolean;
}

export function ServiceForm({ initial, isNew = false }: ServiceFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertService,
    undefined,
  );
  const t = ru.admin.content.services;

  return (
    <form
      action={action}
      className={`grid gap-4 rounded-2xl border border-line p-5 sm:grid-cols-2 ${
        isNew ? "bg-card/40" : "bg-page"
      }`}
    >
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="sm:col-span-2">
        <TextField
          name="name"
          label={t.nameLabel}
          required
          defaultValue={initial?.name ?? ""}
        />
      </div>

      <div className="sm:col-span-2">
        <TextAreaField
          name="description"
          label={t.descriptionLabel}
          defaultValue={initial?.description ?? ""}
          rows={3}
        />
      </div>

      <NumberField
        name="price"
        label={t.priceLabel}
        defaultValue={initial?.price?.toString() ?? ""}
        step="0.01"
        min={0}
      />

      <NumberField
        name="durationMin"
        label={t.durationLabel}
        defaultValue={initial?.durationMin ?? ""}
        min={1}
      />

      <NumberField
        name="order"
        label={t.orderLabel}
        defaultValue={initial?.order ?? 0}
      />

      <CheckboxField
        name="published"
        label={t.publishedLabel}
        defaultChecked={initial?.published ?? true}
      />

      <div className="sm:col-span-2 space-y-3">
        <FormStatus state={state} />
        <div className="flex items-center gap-3">
          <PrimarySubmit pending={pending}>
            {pending ? "…" : isNew ? t.add : t.save}
          </PrimarySubmit>
          {initial?.id ? (
            <ConfirmDeleteButton
              formAction={deleteService}
              confirmText={t.confirmDelete}
            >
              {t.delete}
            </ConfirmDeleteButton>
          ) : null}
        </div>
      </div>
    </form>
  );
}
