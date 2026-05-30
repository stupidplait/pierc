"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { Drawer } from "./Drawer";
import { SlotPicker } from "./SlotPicker";
import {
  ContactFields,
  initialContact,
  isContactValid,
  type ContactValues,
} from "./ContactFields";
import { createBooking, type BookingActionState } from "@/lib/booking/actions";
import { getOpenSlots } from "@/lib/booking/slot-actions";
import type {
  BookingUser,
  WizardJewelry,
  WizardSlot,
} from "@/lib/booking/wizard-types";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

interface JewelryBookingDrawerProps {
  open: boolean;
  onClose: () => void;
  items: WizardJewelry[];
  user: BookingUser | null;
}

export function JewelryBookingDrawer({
  open,
  onClose,
  items,
  user,
}: JewelryBookingDrawerProps) {
  const t = ru.pages.book.bookingDrawer;
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    createBooking,
    undefined,
  );

  const [withAppointment, setWithAppointment] = useState(false);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [slots, setSlots] = useState<WizardSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [contact, setContact] = useState<ContactValues>(() =>
    initialContact(user),
  );
  const patchContact = (patch: Partial<ContactValues>) =>
    setContact((c) => ({ ...c, ...patch }));

  // Lazy-load slots the first time the appointment add-on is enabled. Runs in
  // an event handler (not an effect) to satisfy the set-state-in-effect rule.
  async function toggleAppointment() {
    const next = !withAppointment;
    setWithAppointment(next);
    if (next && slots === null && !slotsLoading) {
      setSlotsLoading(true);
      try {
        setSlots(await getOpenSlots());
      } finally {
        setSlotsLoading(false);
      }
    }
  }

  const itemIds = items.map((i) => i.id).join(",");
  const total = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const canSubmit =
    items.length > 0 &&
    !pending &&
    (!withAppointment || Boolean(slotId)) &&
    isContactValid(contact);

  return (
    <Drawer open={open} onClose={onClose} title={t.title}>
      {items.length === 0 ? (
        <p className="text-sm text-mute">{t.emptyLook}</p>
      ) : (
        <form action={action} className="flex flex-col gap-6">
          <input
            type="hidden"
            name="purpose"
            value={withAppointment ? "both" : "jewelry"}
          />
          <input type="hidden" name="items" value={itemIds} />
          {withAppointment && slotId ? (
            <input type="hidden" name="slotId" value={slotId} />
          ) : null}
          <input type="hidden" name="name" value={contact.name} />
          <input type="hidden" name="email" value={contact.email} />
          <input type="hidden" name="phone" value={contact.phone} />
          <input type="hidden" name="notes" value={contact.notes} />

          {/* ── The curated look ─────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-mute">
              {t.lookHeading}
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card p-2"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-page">
                    {it.photo ? (
                      <Image
                        src={it.photo}
                        alt={it.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {it.name}
                  </p>
                  <span className="shrink-0 text-sm text-mute tabular-nums">
                    {formatPrice(it.price)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-line pt-3 text-sm font-medium text-ink">
              <span>{t.total}</span>
              <span className="tabular-nums">{formatPrice(String(total))}</span>
            </p>
          </section>

          {/* ── Optional appointment add-on ──────────────────────── */}
          <section className="rounded-2xl border border-line bg-card p-4">
            <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left focus-within:ring-2 focus-within:ring-primary/30">
              <input
                type="checkbox"
                className="sr-only"
                checked={withAppointment}
                onChange={toggleAppointment}
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  {t.addAppointmentLabel}
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {t.addAppointmentLead}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  withAppointment ? "bg-primary" : "bg-ink-line-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-on-primary transition-transform ${
                    withAppointment ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>

            {withAppointment ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-3 text-sm font-medium text-ink">
                  {t.chooseTime}
                </p>
                <SlotPicker
                  slots={slots ?? []}
                  value={slotId}
                  onChange={setSlotId}
                  loading={slotsLoading}
                />
              </div>
            ) : null}
          </section>

          {/* ── Contact ──────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-mute">
              {t.contactHeading}
            </h3>
            <ContactFields
              values={contact}
              onChange={patchContact}
              mode={user ? "phoneNotes" : "full"}
            />
          </section>

          {state && !state.ok ? (
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft active:scale-[0.99] disabled:opacity-50"
          >
            {pending
              ? t.submitting
              : withAppointment
                ? t.submitBoth
                : t.submitJewelry}
          </button>
        </form>
      )}
    </Drawer>
  );
}
