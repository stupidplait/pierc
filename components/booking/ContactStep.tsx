"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ru } from "@/lib/i18n/ru";
import {
  type BookingPurpose,
  previousStep,
  serializeBookingParams,
} from "@/lib/booking/url-state";
import {
  createBooking,
  type BookingActionState,
} from "@/lib/booking/actions";
import { formatPrice } from "@/lib/jewelry/format";

interface SummaryItem {
  id: string;
  name: string;
  price: string;
}

interface SummarySlot {
  id: string;
  label: string;
}

interface ContactStepProps {
  purpose: BookingPurpose;
  itemIds: string[];
  slotId: string | null;
  summary: {
    items: SummaryItem[];
    slot: SummarySlot | null;
  };
  user: {
    name: string;
    email: string;
  } | null;
}

export function ContactStep({
  purpose,
  itemIds,
  slotId,
  summary,
  user,
}: ContactStepProps) {
  const [state, action] = useActionState<BookingActionState, FormData>(
    createBooking,
    undefined,
  );
  const t = ru.pages.book.contactStep;
  const back = previousStep("contact", purpose);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="items" value={itemIds.join(",")} />
      {slotId ? <input type="hidden" name="slotId" value={slotId} /> : null}

      <header>
        <h2 className="font-display text-2xl font-medium text-ink">
          {t.heading}
        </h2>
        <p className="mt-1 text-mute">{t.lead}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label={t.nameLabel}
          required
          autoComplete="name"
          defaultValue={user?.name}
        />
        <Field
          name="email"
          label={t.emailLabel}
          required
          type="email"
          autoComplete="email"
          defaultValue={user?.email}
        />
        <Field
          name="phone"
          label={t.phoneLabel}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
        <Field
          name="notes"
          label={t.notesLabel}
          textarea
          autoComplete="off"
        />
      </div>

      {/* Summary pinned below the contact fields. */}
      <section className="rounded-2xl border border-line bg-card/40 p-5">
        <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
          {t.summaryHeading}
        </h3>
        {summary.items.length === 0 && !summary.slot ? (
          <p className="text-sm text-mute">{t.summaryNothing}</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            {summary.items.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.15em] text-mute">
                  {t.summaryJewelry}
                </p>
                <ul className="flex flex-col gap-1">
                  {summary.items.map((j) => (
                    <li key={j.id} className="flex justify-between text-ink">
                      <span>{j.name}</span>
                      <span>{formatPrice(j.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.slot ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.15em] text-mute">
                  {t.summarySlot}
                </p>
                <p className="text-ink">{summary.slot.label}</p>
              </div>
            ) : null}
          </div>
        )}
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

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {back ? (
          <Link
            href={`/book?${serializeBookingParams({
              step: back,
              purpose,
              itemIds,
              slotId,
            })}`}
            className="text-sm text-mute hover:text-primary"
          >
            в†ђ {ru.pages.book.nav.back}
          </Link>
        ) : (
          <span />
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft disabled:opacity-60"
    >
      {pending
        ? ru.pages.book.contactStep.submitting
        : ru.pages.book.contactStep.submit}
    </button>
  );
}

interface FieldProps {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric" | "decimal";
  textarea?: boolean;
  defaultValue?: string;
}

function Field({
  name,
  label,
  required,
  type,
  autoComplete,
  inputMode,
  textarea,
  defaultValue,
}: FieldProps) {
  const inputCls =
    "h-11 w-full rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
  const textareaCls =
    "min-h-24 w-full rounded-xl border border-line bg-page px-4 py-3 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
  return (
    <label
      className={`flex flex-col gap-2 ${textarea ? "sm:col-span-2" : ""}`}
    >
      <span className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          className={textareaCls}
          autoComplete={autoComplete}
        />
      ) : (
        <input
          type={type ?? "text"}
          name={name}
          required={required}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className={inputCls}
        />
      )}
    </label>
  );
}
