"use client";

import { useState, useTransition } from "react";
import { ru } from "@/lib/i18n/ru";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const t = ru.pages.account;

// Self-serve cancel — a quiet destructive action guarded by an in-app
// confirmation modal (not window.confirm). The trigger lives outside any toggle
// so it never expands/collapses the accordion; the server action runs inside a
// transition so the modal can show its pending state, then the row revalidates
// away on success.
export function CancelButton({
  action,
  id,
  label,
  confirmTitle = t.cancelConfirmTitleBooking,
  icon = false,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  /** Modal heading — defaults to the booking copy; appointments pass their own. */
  confirmTitle?: string;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      await action(fd);
      // Success revalidates /account and this row unmounts; if the action is a
      // no-op (e.g. an already-acted booking) we still tidy up the modal.
      setOpen(false);
    });
  }

  return (
    <>
      {icon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          aria-label={label ?? t.cancel}
          title={label ?? t.cancel}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-mute transition-colors duration-150 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-50"
        >
          <CloseIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="text-xs font-medium text-mute underline-offset-4 transition-colors duration-150 hover:text-error hover:underline disabled:opacity-50"
        >
          {pending ? t.cancelling : label ?? t.cancel}
        </button>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={t.cancelConfirmBody}
        confirmLabel={t.cancelConfirmYes}
        cancelLabel={t.cancelConfirmNo}
        pendingLabel={t.cancelling}
        pending={pending}
        tone="danger"
      />
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PieceChip({ count }: { count: number }) {
  return (
    <span
      aria-label={`${t.piecesAria}: ${count}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-ink"
    >
      <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
      {count}
    </span>
  );
}

export function Dot() {
  return (
    <span aria-hidden className="text-mute">
      ·
    </span>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 16 16"
      className={`shrink-0 text-mute transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Shared section header used at the top of every feed variant.
export function FeedHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-ink/10 pb-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-mute">
        {label}
      </h2>
      <span className="font-mono text-xs text-mute tabular-nums">{count}</span>
    </div>
  );
}

// A small uppercase divider used by variants that split into groups
// (Активные / История, month buckets, …).
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-mute/80">
      {children}
    </p>
  );
}
