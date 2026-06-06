"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { NumberField, TextAreaField, TextField } from "./fields";
import { VariantSwitcher } from "./VariantSwitcher";
import {
  DrawerFormActions,
  BodyPublishedToggle,
  DRAWER_OPTIONS,
  type DrawerVariant,
  type ActionLabels,
} from "./DrawerFormActions";
import {
  upsertService,
  deleteService,
  type ActionState,
} from "@/lib/admin/content-actions";
import {
  parseServiceFormData,
  serviceFieldErrors,
  firstServiceError,
  CONTENT_VALIDATION_SUMMARY,
  type ServiceFieldName,
  type ServiceFieldErrors,
} from "@/lib/admin/content-schema";
import { ru } from "@/lib/i18n/ru";

export interface ServiceInitial {
  id?: string;
  name?: string;
  description?: string | null;
  price?: string | null;
  durationMin?: number | null;
  published?: boolean;
}

/**
 * The bare Service editor `<form>` — fields + the sticky drawer action footer.
 * The content manager opens it inside a side drawer; ordering is handled by
 * drag-to-reorder on the list, not here.
 *
 * Validation mirrors the settings page: the shared schema runs client-side
 * first, the server re-validates as the authority, and fields are controlled so
 * a rejected submit keeps what was typed. Feedback is a sonner toast. `onSaved`
 * fires after a successful save or delete; the caller refreshes + closes.
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
  const uid = useId();
  const t = ru.admin.content.services;

  const [values, setValues] = useState<Record<ServiceFieldName, string>>(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    price: initial?.price ?? "",
    durationMin: initial?.durationMin != null ? String(initial.durationMin) : "",
  }));
  const [published, setPublished] = useState(initial?.published ?? true);
  const [cleared, setCleared] = useState<Set<ServiceFieldName>>(() => new Set());
  const [drawerVariant, setDrawerVariant] =
    useState<DrawerVariant>("footer-toggle");

  const focusFirstError = (errors: ServiceFieldErrors) => {
    const first = firstServiceError(errors);
    if (first) document.getElementById(`${uid}-${first}`)?.focus();
  };

  const validatedAction = async (
    prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> => {
    setCleared(new Set());
    const parsed = parseServiceFormData(formData);
    if (!parsed.success) {
      const fieldErrors = serviceFieldErrors(parsed.error);
      focusFirstError(fieldErrors);
      toast.error(CONTENT_VALIDATION_SUMMARY);
      return { ok: false, error: CONTENT_VALIDATION_SUMMARY, fieldErrors };
    }
    const res = await upsertService(prev, formData);
    if (res?.ok) {
      toast.success(res.message ?? ru.admin.common.saved);
      onSaved?.();
    } else if (res) {
      toast.error(res.error || ru.admin.common.saveError);
      if (!res.ok && res.fieldErrors)
        focusFirstError(res.fieldErrors as ServiceFieldErrors);
    }
    return res;
  };

  const [state, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const errorFor = (name: ServiceFieldName) =>
    fieldErrors && !cleared.has(name) ? fieldErrors[name] : undefined;
  const setFieldValue = (name: ServiceFieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setCleared((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  };

  // Delete reuses the server action, then lets the caller refresh/close.
  const deleteAction = onSaved
    ? async (formData: FormData) => {
        await deleteService(formData);
        toast.success(ru.admin.common.deleted);
        onSaved();
      }
    : deleteService;

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
        id={`${uid}-name`}
        name="name"
        label={t.nameLabel}
        value={values.name}
        error={errorFor("name")}
        onValueChange={(v) => setFieldValue("name", v)}
        placeholder={t.namePlaceholder}
        required
        full
      />
      <TextAreaField
        id={`${uid}-description`}
        name="description"
        label={t.descriptionLabel}
        value={values.description}
        error={errorFor("description")}
        onValueChange={(v) => setFieldValue("description", v)}
        placeholder={t.descriptionPlaceholder}
        rows={3}
        full
      />
      <NumberField
        id={`${uid}-price`}
        name="price"
        label={t.priceLabel}
        value={values.price}
        error={errorFor("price")}
        onValueChange={(v) => setFieldValue("price", v)}
        placeholder={t.pricePlaceholder}
        step="0.01"
        min={0}
      />
      <NumberField
        id={`${uid}-durationMin`}
        name="durationMin"
        label={t.durationLabel}
        value={values.durationMin}
        error={errorFor("durationMin")}
        onValueChange={(v) => setFieldValue("durationMin", v)}
        placeholder={t.durationPlaceholder}
        min={1}
        required
      />

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
