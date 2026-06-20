"use client";

import { useId, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import {
  cancelMyAppointment,
  cancelMyBooking,
} from "@/lib/user/booking-actions";
import {
  AppointmentStatusBadge,
  BookingStatusBadge,
} from "@/components/admin/StatusBadges";
import { CancelButton, Chevron, Dot, PieceChip } from "./shared";
import type { AppointmentEntry, FeedItem, StandaloneBooking } from "./types";

const t = ru.pages.account;

// ─── Appointment accordion (parent → nested jewelry pieces) ──────────────────
export function AppointmentAccordion({
  entry,
  pinned = false,
  countdownLabel,
}: {
  entry: AppointmentEntry;
  pinned?: boolean;
  countdownLabel?: string;
}) {
  const hasPieces = entry.pieces.length > 0;
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(pinned);
  const contentId = useId();

  const showSlotMeta = Boolean(entry.serviceName && entry.slotLabel);
  const showCountdown = Boolean(pinned && countdownLabel);
  const showMeta = showSlotMeta || showCountdown;

  const titleBlock = (
    <div className="min-w-0">
      {pinned ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
          {t.nextHeading}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[15px] font-medium text-ink">
          {entry.serviceName ?? entry.slotLabel ?? t.appointmentGeneric}
        </span>
        {hasPieces ? (
          <>
            <PieceChip count={entry.pieces.length} />
            <Chevron open={open} />
          </>
        ) : null}
      </div>
      {showMeta ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
          {showSlotMeta ? (
            <span className="tabular-nums">{entry.slotLabel}</span>
          ) : null}
          {showCountdown ? (
            <>
              {showSlotMeta ? <Dot /> : null}
              <span className="font-medium text-accent">{countdownLabel}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // One destructive affordance, identical across every row type: the cancel ✕
  // always trails the status badge as the rightmost element (see Standalone
  // BookingRow / nested pieces). The accordion's expand control is the title
  // itself + the inline chevron above — never a competing trailing icon-button.
  const cancelIcon = entry.canCancel ? (
    <CancelButton
      action={cancelMyAppointment}
      id={entry.id}
      label={t.cancelAppointment}
      confirmTitle={t.cancelConfirmTitleAppointment}
      icon
    />
  ) : null;

  if (!hasPieces) {
    return (
      <div className="flex items-start justify-between gap-3">
        {titleBlock}
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <AppointmentStatusBadge status={entry.status} />
          {cancelIcon}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open ? "true" : "false"}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {titleBlock}
        </button>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <AppointmentStatusBadge status={entry.status} />
          {cancelIcon}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            id={contentId}
            key="pieces"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="mt-5 flex flex-col gap-3">
              {entry.pieces.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-ink/2 px-3.5 py-3"
                >
                  <span className="min-w-0 truncate text-sm text-ink">
                    {p.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-mute tabular-nums">
                      {p.price}
                    </span>
                    <BookingStatusBadge status={p.status} />
                    {p.canCancel ? (
                      <CancelButton
                        action={cancelMyBooking}
                        id={p.id}
                        label={t.pieceRemove}
                        icon
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function StandaloneBookingRow({
  booking,
}: {
  booking: StandaloneBooking;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-wider text-mute tabular-nums">
          {booking.shortDate}
        </p>
        <p className="mt-1.5 truncate text-[15px] font-medium leading-relaxed text-ink">
          {booking.name}
          <span className="ml-2 font-mono text-mute tabular-nums">
            {booking.price}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <BookingStatusBadge status={booking.status} />
        {booking.canCancel ? (
          <CancelButton action={cancelMyBooking} id={booking.id} icon />
        ) : null}
      </div>
    </div>
  );
}

// Renders a single feed row's content regardless of variant — variants own the
// wrapper (timeline node, card, agenda line); this owns the inside.
export function FeedItemContent({ item }: { item: FeedItem }) {
  return item.kind === "appt" ? (
    <AppointmentAccordion entry={item.appt} />
  ) : (
    <StandaloneBookingRow booking={item.booking} />
  );
}
