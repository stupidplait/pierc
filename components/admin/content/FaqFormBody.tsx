"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/shadcn/ui/label";
import { Combobox } from "@/components/shadcn/Combobox";
import { TextAreaField, TextField } from "./fields";
import { VariantSwitcher } from "./VariantSwitcher";
import {
  DrawerFormActions,
  BodyPublishedToggle,
  DRAWER_OPTIONS,
  type DrawerVariant,
  type ActionLabels,
} from "./DrawerFormActions";
import {
  upsertFaq,
  deleteFaq,
  type ActionState,
} from "@/lib/admin/content-actions";
import {
  parseFaqFormData,
  faqFieldErrors,
  firstFaqError,
  CONTENT_VALIDATION_SUMMARY,
  type FaqFieldName,
  type FaqFieldErrors,
} from "@/lib/admin/content-schema";
import { FAQ_CATEGORIES } from "@/components/faq/faqData";
import { ru } from "@/lib/i18n/ru";

const CATEGORY_OPTIONS = FAQ_CATEGORIES.map((c) => ({
  value: c.key,
  label: c.label,
}));

export interface FaqInitial {
  id?: string;
  question?: string;
  answer?: string;
  category?: string | null;
  published?: boolean;
}

/**
 * The bare FAQ editor `<form>` — twin of {@link ServiceFormBody}. Used by the
 * content manager's drawer. Same client-first validation + controlled fields +
 * toast feedback + sticky drawer action footer; ordering is handled by
 * drag-to-reorder on the list. `onSaved` fires after a successful save or delete.
 */
export function FaqFormBody({
  initial,
  isNew = false,
  onSaved,
  onCancel,
}: {
  initial?: FaqInitial;
  isNew?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const t = ru.admin.content.faq;

  const [values, setValues] = useState<Record<FaqFieldName, string>>(() => ({
    question: initial?.question ?? "",
    answer: initial?.answer ?? "",
  }));
  const [published, setPublished] = useState(initial?.published ?? true);
  const [cleared, setCleared] = useState<Set<FaqFieldName>>(() => new Set());
  const [drawerVariant, setDrawerVariant] =
    useState<DrawerVariant>("footer-toggle");

  const focusFirstError = (errors: FaqFieldErrors) => {
    const first = firstFaqError(errors);
    if (first) document.getElementById(`${uid}-${first}`)?.focus();
  };

  const validatedAction = async (
    prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> => {
    setCleared(new Set());
    const parsed = parseFaqFormData(formData);
    if (!parsed.success) {
      const fieldErrors = faqFieldErrors(parsed.error);
      focusFirstError(fieldErrors);
      toast.error(CONTENT_VALIDATION_SUMMARY);
      return { ok: false, error: CONTENT_VALIDATION_SUMMARY, fieldErrors };
    }
    const res = await upsertFaq(prev, formData);
    if (res?.ok) {
      toast.success(res.message ?? ru.admin.common.saved);
      onSaved?.();
    } else if (res) {
      toast.error(res.error || ru.admin.common.saveError);
      if (!res.ok && res.fieldErrors)
        focusFirstError(res.fieldErrors as FaqFieldErrors);
    }
    return res;
  };

  const [state, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const errorFor = (name: FaqFieldName) =>
    fieldErrors && !cleared.has(name) ? fieldErrors[name] : undefined;
  const setFieldValue = (name: FaqFieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setCleared((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  };

  const deleteAction = onSaved
    ? async (formData: FormData) => {
        await deleteFaq(formData);
        toast.success(ru.admin.common.deleted);
        onSaved();
      }
    : deleteFaq;

  const labels: ActionLabels = {
    save: t.save,
    add: t.add,
    delete: t.delete,
    confirmDelete: t.confirmDelete,
    publishedLabel: t.publishedLabel,
    draft: t.draft,
  };

  return (
    <form action={action} noValidate className="grid gap-4 sm:grid-cols-2">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="sm:col-span-2">
        <VariantSwitcher
          label="Низ ящика:"
          value={drawerVariant}
          options={DRAWER_OPTIONS}
          onChange={setDrawerVariant}
        />
      </div>

      <TextField
        id={`${uid}-question`}
        name="question"
        label={t.questionLabel}
        value={values.question}
        error={errorFor("question")}
        onValueChange={(v) => setFieldValue("question", v)}
        placeholder={t.questionPlaceholder}
        required
        full
      />
      <TextAreaField
        id={`${uid}-answer`}
        name="answer"
        label={t.answerLabel}
        value={values.answer}
        error={errorFor("answer")}
        onValueChange={(v) => setFieldValue("answer", v)}
        placeholder={t.answerPlaceholder}
        required
        rows={4}
        full
      />

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${uid}-cat`}>{t.categoryLabel}</Label>
        <Combobox
          id={`${uid}-cat`}
          name="category"
          options={CATEGORY_OPTIONS}
          defaultValue={initial?.category ?? ""}
          placeholder={t.categoryNone}
        />
      </div>

      {drawerVariant === "footer-actions" ? (
        <BodyPublishedToggle
          id={`${uid}-published`}
          checked={published}
          onChange={setPublished}
          labels={labels}
        />
      ) : null}

      <DrawerFormActions
        variant={drawerVariant}
        isNew={isNew}
        pending={pending}
        published={published}
        onPublishedChange={setPublished}
        toggleId={`${uid}-published`}
        labels={labels}
        onCancel={onCancel}
        deleteAction={deleteAction}
      />
    </form>
  );
}
