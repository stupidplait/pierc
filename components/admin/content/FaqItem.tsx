"use client";

import { useActionState, useId } from "react";
import { Button, buttonVariants } from "@/components/shadcn/ui/button";
import { Badge } from "@/components/shadcn/ui/badge";
import { Label } from "@/components/shadcn/ui/label";
import { Combobox } from "@/components/shadcn/Combobox";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { InlineStatus } from "@/components/admin/form/atelier";
import { CollapsibleEditor } from "./CollapsibleEditor";
import { NumberField, SwitchRow, TextAreaField, TextField } from "./fields";
import {
  upsertFaq,
  deleteFaq,
  type ActionState,
} from "@/lib/admin/content-actions";
import { FAQ_CATEGORIES } from "@/components/faq/faqData";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = FAQ_CATEGORIES.map((c) => ({
  value: c.key,
  label: c.label,
}));
const CATEGORY_LABEL = new Map(FAQ_CATEGORIES.map((c) => [c.key, c.label]));

export interface FaqInitial {
  id?: string;
  question?: string;
  answer?: string;
  category?: string | null;
  order?: number | null;
  published?: boolean;
}

function StatusBadge({ published }: { published: boolean }) {
  const t = ru.admin.content.faq;
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

export function FaqItem({
  initial,
  isNew = false,
  defaultOpen = false,
  delay = 0,
  onCancel,
}: {
  initial?: FaqInitial;
  isNew?: boolean;
  defaultOpen?: boolean;
  delay?: number;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertFaq,
    undefined,
  );
  const uid = useId();
  const t = ru.admin.content.faq;
  const published = initial?.published ?? true;
  const categoryLabel = initial?.category
    ? (CATEGORY_LABEL.get(initial.category) ?? initial.category)
    : undefined;

  return (
    <CollapsibleEditor
      title={isNew ? t.addHeading : initial?.question || t.questionLabel}
      meta={isNew ? undefined : categoryLabel}
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
          id={`${uid}-q`}
          name="question"
          label={t.questionLabel}
          defaultValue={initial?.question}
          placeholder={t.questionPlaceholder}
          required
          full
        />
        <TextAreaField
          id={`${uid}-a`}
          name="answer"
          label={t.answerLabel}
          defaultValue={initial?.answer}
          placeholder={t.answerPlaceholder}
          required
          rows={4}
          full
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-cat`}>{t.categoryLabel}</Label>
          <Combobox
            id={`${uid}-cat`}
            name="category"
            options={CATEGORY_OPTIONS}
            defaultValue={initial?.category ?? ""}
            placeholder={t.categoryNone}
          />
        </div>
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
              formAction={deleteFaq}
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
