"use client";

import { useActionState, useId } from "react";
import { Button, buttonVariants } from "@/components/shadcn/ui/button";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { InlineStatus } from "@/components/admin/form/atelier";
import { NumberField, SwitchRow, TextAreaField, TextField } from "./fields";
import {
  upsertService,
  deleteService,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export interface ServiceInitial {
  id?: string;
  name?: string;
  description?: string | null;
  price?: string | null;
  durationMin?: number | null;
  order?: number | null;
  published?: boolean;
}

/**
 * The bare Service editor `<form>` — fields + submit + delete/cancel + inline
 * status. The content manager opens it inside a side drawer.
 *
 * `onSaved` fires after a successful save or delete; the caller uses it to
 * `router.refresh()` and close the drawer.
 */
export function ServiceFormBody({
  initial,
  isNew = false,
  onSaved,
  onCancel,
}: {
  initial?: ServiceInitial;
  isNew?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const res = await upsertService(prev, formData);
      if (res?.ok) onSaved?.();
      return res;
    },
    undefined,
  );
  const uid = useId();
  const t = ru.admin.content.services;
  const published = initial?.published ?? true;

  // Delete reuses the server action, then lets the caller refresh/close.
  const deleteAction = onSaved
    ? async (formData: FormData) => {
        await deleteService(formData);
        onSaved();
      }
    : deleteService;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <TextField
        id={`${uid}-name`}
        name="name"
        label={t.nameLabel}
        defaultValue={initial?.name}
        placeholder={t.namePlaceholder}
        required
        full
      />
      <TextAreaField
        id={`${uid}-desc`}
        name="description"
        label={t.descriptionLabel}
        defaultValue={initial?.description}
        placeholder={t.descriptionPlaceholder}
        rows={3}
        full
      />
      <NumberField
        id={`${uid}-price`}
        name="price"
        label={t.priceLabel}
        defaultValue={initial?.price ?? ""}
        step="0.01"
        min={0}
      />
      <NumberField
        id={`${uid}-dur`}
        name="durationMin"
        label={t.durationLabel}
        defaultValue={initial?.durationMin ?? ""}
        min={1}
      />
      <NumberField
        id={`${uid}-order`}
        name="order"
        label={t.orderLabel}
        defaultValue={initial?.order ?? 0}
      />
      <SwitchRow
        id={`${uid}-pub`}
        name="published"
        label={t.publishedLabel}
        defaultChecked={published}
      />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : isNew ? t.add : t.save}
        </Button>
        {isNew ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {ru.admin.common.cancel}
          </Button>
        ) : (
          <ConfirmDeleteButton
            formAction={deleteAction}
            confirmText={t.confirmDelete}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {t.delete}
          </ConfirmDeleteButton>
        )}
        <InlineStatus state={state} />
      </div>
    </form>
  );
}
