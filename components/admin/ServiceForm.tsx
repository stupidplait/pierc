"use client";

import { useActionState } from "react";
import {
  CardHeader,
  Field,
  InlineStatus,
  NumberField,
  Reveal,
  SubmitPill,
  TextArea,
  Toggle,
} from "@/components/admin/form/atelier";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
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
  /** Stagger offset for the entrance, derived from the row index. */
  delay?: number;
}

export function ServiceForm({ initial, isNew = false, delay = 0 }: ServiceFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertService,
    undefined,
  );
  const t = ru.admin.content.services;

  return (
    <Reveal delay={delay}>
      <form
        action={action}
        className={`${CARD} grid gap-5 p-6 sm:grid-cols-2 sm:p-7 ${
          isNew ? "border-accent/25" : ""
        }`}
      >
        {initial?.id ? (
          <input type="hidden" name="id" value={initial.id} />
        ) : null}

        {isNew ? <CardHeader title={t.addHeading} /> : null}

        <Field
          name="name"
          label={t.nameLabel}
          required
          defaultValue={initial?.name ?? ""}
          placeholder={t.namePlaceholder}
          full
        />

        <TextArea
          name="description"
          label={t.descriptionLabel}
          defaultValue={initial?.description ?? ""}
          rows={3}
          placeholder={t.descriptionPlaceholder}
          full
        />

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

        <Toggle
          name="published"
          label={t.publishedLabel}
          defaultChecked={initial?.published ?? true}
        />

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <SubmitPill pending={pending}>
            {pending ? "…" : isNew ? t.add : t.save}
          </SubmitPill>
          {initial?.id ? (
            <ConfirmDeleteButton
              formAction={deleteService}
              confirmText={t.confirmDelete}
              className={GHOST_DELETE}
            >
              {t.delete}
            </ConfirmDeleteButton>
          ) : null}
          <InlineStatus state={state} />
        </div>
      </form>
    </Reveal>
  );
}
