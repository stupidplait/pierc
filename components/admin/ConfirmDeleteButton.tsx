"use client";

import { type ReactNode, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ru } from "@/lib/i18n/ru";

interface ConfirmDeleteButtonProps {
  children: ReactNode;
  /** The question shown in the confirmation modal (used as its heading). */
  confirmText: string;
  /** Confirm-button label inside the modal (defaults to "Удалить"). */
  confirmLabel?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Override the trigger's classes (e.g. the Steel Atelier ghost variant). */
  className?: string;
}

const DEFAULT_TRIGGER =
  "inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-mute transition-colors hover:border-primary hover:text-primary";

// Submit button that asks for confirmation via an in-app modal (not the native
// window.confirm) before triggering its formAction. The real <button> stays a
// form submitter so every hidden field in the parent form is still sent; the
// click is intercepted to open the modal, and confirming re-submits the form
// programmatically with this button as the submitter (so its formAction wins).
export function ConfirmDeleteButton({
  children,
  confirmText,
  confirmLabel,
  formAction,
  className,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="submit"
        formAction={formAction}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className={className ?? DEFAULT_TRIGGER}
      >
        {children}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          const btn = btnRef.current;
          btn?.form?.requestSubmit(btn);
        }}
        title={confirmText}
        confirmLabel={confirmLabel ?? ru.admin.common.delete}
        cancelLabel={ru.admin.common.cancel}
        tone="danger"
      />
    </>
  );
}
