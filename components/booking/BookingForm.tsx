"use client";

import { useActionState, useMemo, useState } from "react";
import { SlotPicker } from "./SlotPicker";
import { ServiceSelect } from "./ServiceSelect";
import { JewelrySelect } from "./JewelrySelect";
import {
  ContactFields,
  initialContact,
  isContactValid,
  type ContactValues,
} from "./ContactFields";
import { BookingSummary } from "./BookingSummary";
import { createBooking, type BookingActionState } from "@/lib/booking/actions";
import type {
  BookingUser,
  WizardJewelry,
  WizardService,
  WizardSlot,
} from "@/lib/booking/wizard-types";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

// Site-wide primary CTA: ink-filled pill with the small magenta accent dot
// (matches the auth submit + profile PILL — magenta stays a page accent only).
const PRIMARY_BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink/90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none";

const RU_SLOT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const RU_SLOT_END = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
function slotLabel(slot: WizardSlot): string {
  return `${RU_SLOT.format(new Date(slot.startsAt))} – ${RU_SLOT_END.format(new Date(slot.endsAt))}`;
}

interface BookingFormProps {
  services: WizardService[];
  jewelry: WizardJewelry[];
  slots: WizardSlot[];
  user: BookingUser | null;
  initialItemIds: string[];
  initialServiceId?: string | null;
  /** Single-column layout for the in-drawer mount (no right rail/sticky bar). */
  compact?: boolean;
}

export function BookingForm({
  services,
  jewelry,
  slots,
  user,
  initialItemIds,
  initialServiceId = null,
  compact = false,
}: BookingFormProps) {
  const t = ru.pages.book;

  // Service is fixed (drawer) when initialServiceId is set; otherwise the field
  // is only shown when there are services to choose from.
  const showServiceField = !initialServiceId && services.length > 0;
  const servicesPresent = Boolean(initialServiceId) || services.length > 0;

  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [itemIds, setItemIds] = useState<Set<string>>(
    () => new Set(initialItemIds),
  );
  const [contact, setContact] = useState<ContactValues>(() =>
    initialContact(user),
  );
  const patchContact = (patch: Partial<ContactValues>) =>
    setContact((c) => ({ ...c, ...patch }));

  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    createBooking,
    undefined,
  );

  const toggleItem = (id: string) =>
    setItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );
  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  const selectedItems = jewelry.filter((j) => itemIds.has(j.id));

  const canSubmit =
    !pending &&
    Boolean(slotId) &&
    (servicesPresent ? Boolean(serviceId) : true) &&
    isContactValid(contact);

  // When the CTA is disabled, name the first unmet requirement so the button is
  // never a silent dead end. Order mirrors the form's top-to-bottom flow.
  const missingHint = (() => {
    if (pending) return null;
    if (servicesPresent && !serviceId) return t.form.needService;
    if (!slotId) return t.form.needSlot;
    if (!isContactValid(contact)) return t.form.needContact;
    return null;
  })();

  const submitLabel = pending ? t.contactStep.submitting : t.contactStep.submit;
  const contactMode = user ? "phoneNotes" : "full";

  const hiddenInputs = (
    <>
      <input
        type="hidden"
        name="purpose"
        value={itemIds.size > 0 ? "both" : "appointment"}
      />
      {serviceId ? (
        <input type="hidden" name="serviceId" value={serviceId} />
      ) : null}
      {slotId ? <input type="hidden" name="slotId" value={slotId} /> : null}
      <input type="hidden" name="items" value={[...itemIds].join(",")} />
      {/* Contact values live in state and ride along as always-present hidden
          inputs, so a field is never dropped from the submission. */}
      <input type="hidden" name="name" value={contact.name} />
      <input type="hidden" name="email" value={contact.email} />
      <input type="hidden" name="phone" value={contact.phone} />
      <input type="hidden" name="notes" value={contact.notes} />
    </>
  );

  const sections = (
    <div className="flex min-w-0 flex-col gap-10">
      {showServiceField ? (
        <Section heading={t.serviceStep.heading} lead={t.serviceStep.lead}>
          <ServiceSelect
            services={services}
            value={serviceId}
            onChange={setServiceId}
          />
        </Section>
      ) : null}

      <Section heading={t.slotStep.heading} lead={t.slotStep.lead}>
        <SlotPicker slots={slots} value={slotId} onChange={setSlotId} />
      </Section>

      {jewelry.length > 0 ? (
        <Section
          heading={t.form.jewelryHeading}
          lead={t.wizard.addJewelryLead}
          optional={t.form.jewelryOptional}
        >
          <JewelrySelect
            jewelry={jewelry}
            selected={itemIds}
            onToggle={toggleItem}
          />
        </Section>
      ) : null}

      <Section heading={t.contactStep.heading} lead={t.contactStep.lead}>
        <ContactFields
          values={contact}
          onChange={patchContact}
          mode={contactMode}
        />
      </Section>

      {state && !state.ok ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );

  const summaryEl = (
    <BookingSummary
      service={
        selectedService
          ? { name: selectedService.name, price: selectedService.price }
          : null
      }
      items={selectedItems.map((j) => ({
        id: j.id,
        name: j.name,
        price: j.price,
      }))}
      slotLabel={selectedSlot ? slotLabel(selectedSlot) : null}
    />
  );

  const submitBtn = (
    <button type="submit" disabled={!canSubmit} className={`${PRIMARY_BTN} w-full`}>
      <span aria-hidden="true" className="size-[5px] rounded-full bg-accent" />
      {submitLabel}
    </button>
  );

  // Below the CTA: name what's still missing (disabled state) or reassure once
  // ready. aria-live so the change is announced as the form becomes submittable.
  const caption = (
    <p
      aria-live="polite"
      className={`text-center text-xs ${missingHint ? "text-primary" : "text-mute"}`}
    >
      {missingHint ?? t.contactStep.reassure}
    </p>
  );

  // ── Compact (drawer) — single column, summary + submit at the end ─────────
  if (compact) {
    return (
      <form action={action} className="flex flex-col gap-8">
        {hiddenInputs}
        {sections}
        {summaryEl}
        <div className="flex flex-col gap-3">
          {submitBtn}
          {caption}
        </div>
      </form>
    );
  }

  // ── Page — two columns with a sticky right rail, sticky bottom bar on mobile.
  return (
    <form action={action}>
      {hiddenInputs}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {sections}
        <aside className="hidden lg:flex lg:sticky lg:top-24 lg:self-start flex-col gap-6">
          {summaryEl}
          <div className="flex flex-col gap-3">
            {submitBtn}
            {caption}
          </div>
        </aside>
      </div>

      {/* Mobile: inline summary, then a sticky bar carrying total + submit. */}
      <div className="mt-10 lg:hidden">{summaryEl}</div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-1.5 border-t border-line bg-page/85 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Total service={selectedService} items={selectedItems} />
          <button
            type="submit"
            disabled={!canSubmit}
            className={`${PRIMARY_BTN} shrink-0`}
          >
            <span
              aria-hidden="true"
              className="size-[5px] rounded-full bg-accent"
            />
            {submitLabel}
          </button>
        </div>
        {missingHint ? (
          <p aria-live="polite" className="text-center text-xs text-primary">
            {missingHint}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  heading,
  lead,
  optional,
  children,
}: {
  heading: string;
  lead: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h2 className="flex items-baseline gap-2 font-display text-2xl font-medium text-ink">
          {heading}
          {optional ? (
            <span className="text-xs font-normal uppercase tracking-[0.15em] text-mute">
              {optional}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-mute">{lead}</p>
      </header>
      {children}
    </section>
  );
}

function Total({
  service,
  items,
}: {
  service: WizardService | null;
  items: WizardJewelry[];
}) {
  let total = service ? Number(service.price) || 0 : 0;
  for (const it of items) total += Number(it.price) || 0;
  if (total <= 0) return <span className="text-sm text-mute" />;
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[11px] uppercase tracking-[0.15em] text-mute">
        {ru.pages.book.contactStep.summaryTotal}
      </span>
      <span className="font-mono text-base font-medium text-ink tabular-nums">
        {formatPrice(String(total))}
      </span>
    </span>
  );
}
