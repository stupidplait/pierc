"use client";

import { useActionState, useId } from "react";
import { Button, buttonVariants } from "@/components/shadcn/ui/button";
import { Badge } from "@/components/shadcn/ui/badge";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { InlineStatus } from "@/components/admin/form/atelier";
import { CollapsibleEditor } from "./CollapsibleEditor";
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

function StatusBadge({ published }: { published: boolean }) {
  const t = ru.admin.content.services;
  return published ? (
    <Badge variant="secondary" className="gap-1.5 text-success">
      <span className="size-1.5 rounded-full bg-current" />
      {t.publishedLabel}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1.5 text-mute">
      <span className="size-1.5 rounded-full bg-current" />
      {t.draft}
    </Badge>
  );
}

export function ServiceItem({
  initial,
  isNew = false,
  defaultOpen = false,
  delay = 0,
  onCancel,
}: {
  initial?: ServiceInitial;
  isNew?: boolean;
  defaultOpen?: boolean;
  delay?: number;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertService,
    undefined,
  );
  const uid = useId();
  const t = ru.admin.content.services;
  const published = initial?.published ?? true;

  const meta = [
    initial?.price ? `${initial.price} ₽` : null,
    initial?.durationMin ? `${initial.durationMin} мин` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CollapsibleEditor
      title={isNew ? t.addHeading : initial?.name || t.nameLabel}
      meta={isNew ? undefined : meta || undefined}
      status={isNew ? undefined : <StatusBadge published={published} />}
      defaultOpen={defaultOpen || isNew}
      accent={isNew}
      delay={delay}
    >
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {initial?.id ? (
          <input type="hidden" name="id" value={initial.id} />
        ) : null}

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
              formAction={deleteService}
              confirmText={t.confirmDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {t.delete}
            </ConfirmDeleteButton>
          )}
          <InlineStatus state={state} />
        </div>
      </form>
    </CollapsibleEditor>
  );
}
