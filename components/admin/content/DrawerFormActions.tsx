"use client";

import { Check, Loader2, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/shadcn/ui/button";
import { Switch } from "@/components/shadcn/ui/switch";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

/**
 * Trial drawer footers (services / FAQ editors) — sticky bottom action bar in a
 * few arrangements so we can pick one. All share: icon buttons, a settings-style
 * Save (spinner + pending label), and `published` submitted via a hidden input
 * (the visible toggle UIs just drive the `published` state). For the
 * "footer-actions" variant the toggle lives in the body instead — render
 * {@link BodyPublishedToggle} there.
 */
export type DrawerVariant =
  | "footer-toggle"
  | "footer-actions"
  | "segmented"
  | "stacked";

export const DRAWER_OPTIONS = [
  { value: "footer-toggle", label: "Тоггл+кнопки" },
  { value: "footer-actions", label: "Кнопки" },
  { value: "segmented", label: "Сегмент" },
  { value: "stacked", label: "Крупная" },
] as const;

export interface ActionLabels {
  save: string;
  add: string;
  delete: string;
  confirmDelete: string;
  publishedLabel: string;
  draft: string;
}

// Sticky bar pinned to the drawer's bottom: spans the body's px-6 (-mx-6) and
// swallows its safe-area pb (-mb…) so it sits flush at the very bottom.
const FOOTER =
  "sticky bottom-0 z-10 col-span-2 -mx-6 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] mt-2 border-t border-line bg-page/95 px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm";

function PublishedSwitch({
  id,
  checked,
  onChange,
  labels,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  labels: ActionLabels;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-sm text-ink"
    >
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {checked ? labels.publishedLabel : labels.draft}
    </label>
  );
}

/** Body toggle for the "footer-actions" variant (no name — value rides the
 *  hidden input in DrawerFormActions). */
export function BodyPublishedToggle({
  id,
  checked,
  onChange,
  labels,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  labels: ActionLabels;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/2 px-3.5 py-2.5 sm:col-span-2">
      <PublishedSwitch id={id} checked={checked} onChange={onChange} labels={labels} />
    </div>
  );
}

export function DrawerFormActions({
  variant,
  isNew,
  pending,
  published,
  onPublishedChange,
  toggleId,
  labels,
  onCancel,
  deleteAction,
}: {
  variant: DrawerVariant;
  isNew: boolean;
  pending: boolean;
  published: boolean;
  onPublishedChange: (v: boolean) => void;
  toggleId: string;
  labels: ActionLabels;
  onCancel?: () => void;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const saveLabel = pending
    ? ru.admin.settings.saving
    : isNew
      ? labels.add
      : labels.save;

  const save = (full?: boolean) => (
    <Button type="submit" disabled={pending} className={cn("px-5", full && "w-full")}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Check className="size-4" />
      )}
      {saveLabel}
    </Button>
  );

  const destroy = isNew ? (
    <Button type="button" variant="ghost" onClick={onCancel}>
      <X className="size-4" />
      {ru.admin.common.cancel}
    </Button>
  ) : (
    <ConfirmDeleteButton
      formAction={deleteAction}
      confirmText={labels.confirmDelete}
      className={buttonVariants({ variant: "destructive" })}
    >
      <Trash2 className="size-4" />
      {labels.delete}
    </ConfirmDeleteButton>
  );

  const segmented = (
    <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onPublishedChange(true)}
        aria-pressed={published}
        className={cn(
          "rounded-md px-3 py-1 font-medium transition-colors",
          published ? "bg-ink text-bg" : "text-mute hover:text-ink",
        )}
      >
        {labels.publishedLabel}
      </button>
      <button
        type="button"
        onClick={() => onPublishedChange(false)}
        aria-pressed={!published}
        className={cn(
          "rounded-md px-3 py-1 font-medium transition-colors",
          !published ? "bg-ink text-bg" : "text-mute hover:text-ink",
        )}
      >
        {labels.draft}
      </button>
    </div>
  );

  const hidden = (
    <input type="hidden" name="published" value={published ? "on" : ""} />
  );

  if (variant === "footer-actions") {
    return (
      <div className={cn(FOOTER, "flex flex-wrap items-center justify-end gap-3")}>
        {hidden}
        {destroy}
        {save()}
      </div>
    );
  }

  if (variant === "segmented") {
    return (
      <div className={cn(FOOTER, "flex flex-wrap items-center justify-between gap-3")}>
        {hidden}
        {segmented}
        <div className="flex items-center gap-2">
          {!isNew ? destroy : null}
          {save()}
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn(FOOTER, "flex flex-col gap-2.5")}>
        {hidden}
        <PublishedSwitch
          id={toggleId}
          checked={published}
          onChange={onPublishedChange}
          labels={labels}
        />
        {save(true)}
        <div className="flex justify-center">{destroy}</div>
      </div>
    );
  }

  // footer-toggle (default)
  return (
    <div className={cn(FOOTER, "flex flex-wrap items-center justify-between gap-3")}>
      {hidden}
      <PublishedSwitch
        id={toggleId}
        checked={published}
        onChange={onPublishedChange}
        labels={labels}
      />
      <div className="flex items-center gap-2">
        {destroy}
        {save()}
      </div>
    </div>
  );
}
