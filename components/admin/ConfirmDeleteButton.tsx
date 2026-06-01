"use client";

import { forwardRef, type ReactNode, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ru } from "@/lib/i18n/ru";

type ConfirmDeleteButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "children"
> & {
  children: ReactNode;
  /** The question shown in the confirmation modal (used as its heading). */
  confirmText: string;
  /** Confirm-button label inside the modal (defaults to "Удалить"). */
  confirmLabel?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Override the trigger's classes (e.g. the Steel Atelier ghost variant). */
  className?: string;
  /** Accessible label for icon-only triggers (no visible text). */
  ariaLabel?: string;
};

const DEFAULT_TRIGGER =
  "inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-mute transition-colors hover:border-primary hover:text-primary";

// Submit button that asks for confirmation via an in-app modal (not the native
// window.confirm) before triggering its formAction. The real <button> stays a
// form submitter so every hidden field in the parent form is still sent; the
// click is intercepted to open the modal, and confirming re-submits the form
// programmatically with this button as the submitter (so its formAction wins).
//
// forwardRef + prop spread so it can sit inside a `TooltipTrigger asChild`
// (or any other composer): Radix's hover/focus handlers + ref reach the button.
export const ConfirmDeleteButton = forwardRef<
  HTMLButtonElement,
  ConfirmDeleteButtonProps
>(function ConfirmDeleteButton(
  {
    children,
    confirmText,
    confirmLabel,
    formAction,
    className,
    ariaLabel,
    onClick,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLButtonElement>(null);
  const setRefs = (node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <>
      <button
        {...rest}
        ref={setRefs}
        type="submit"
        formAction={formAction}
        aria-label={ariaLabel}
        onClick={(e) => {
          onClick?.(e);
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
          const btn = innerRef.current;
          btn?.form?.requestSubmit(btn);
        }}
        title={confirmText}
        confirmLabel={confirmLabel ?? ru.admin.common.delete}
        cancelLabel={ru.admin.common.cancel}
        tone="danger"
      />
    </>
  );
});
