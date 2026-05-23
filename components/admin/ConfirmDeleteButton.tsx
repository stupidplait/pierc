"use client";

import type { ReactNode } from "react";

interface ConfirmDeleteButtonProps {
  children: ReactNode;
  confirmText: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}

// Submit button that asks for confirmation before triggering its formAction.
// If the user cancels, the form submission is aborted.
export function ConfirmDeleteButton({
  children,
  confirmText,
  formAction,
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      formAction={formAction}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-mute transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}
