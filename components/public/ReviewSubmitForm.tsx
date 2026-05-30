"use client";

import { useActionState, useState } from "react";
import {
  submitReviewFromMagicLink,
  type SubmitReviewState,
} from "@/lib/reviews/submit-action";
import { reviewsStrings, ru } from "@/lib/i18n/ru";

interface JewelryOption {
  id: string;
  name: string;
}

interface ReviewSubmitFormProps {
  token: string;
  defaultAuthorName: string;
  jewelryOptions: JewelryOption[];
  /** Pre-selected jewelry ids — populated from the appointment's bookings. */
  defaultSelectedIds: string[];
}

/**
 * Public-facing form for the magic-link review flow. Submits via
 * `submitReviewFromMagicLink` server action, which validates the token,
 * creates a Review(PENDING), sets Appointment.reviewedAt, and redirects
 * to /review/thanks.
 */
export function ReviewSubmitForm({
  token,
  defaultAuthorName,
  jewelryOptions,
  defaultSelectedIds,
}: ReviewSubmitFormProps) {
  const [state, action, pending] = useActionState<
    SubmitReviewState,
    FormData
  >(submitReviewFromMagicLink, undefined);
  const t = reviewsStrings.form;

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelectedIds),
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <form
      action={action}
      encType="multipart/form-data"
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.ratingLabel}</span>
        <select
          name="rating"
          defaultValue="5"
          required
          className="h-11 w-full rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
              {"☆".repeat(5 - n)} ({n}/5)
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.textLabel}</span>
        <textarea
          name="text"
          rows={6}
          required
          placeholder={t.textPlaceholder}
          className="w-full rounded-xl border border-line bg-page px-4 py-3 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.authorLabel}</span>
        <input
          type="text"
          name="authorName"
          required
          autoComplete="off"
          defaultValue={defaultAuthorName}
          placeholder={t.authorPlaceholder}
          className="h-11 w-full rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <span className="text-xs text-mute">{t.authorHint}</span>
      </label>

      {jewelryOptions.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">
            {t.jewelryLabel}
          </legend>
          <p className="text-xs text-mute">{t.jewelryHint}</p>
          <div className="flex flex-col gap-2">
            {jewelryOptions.map((j) => {
              const checked = selected.has(j.id);
              return (
                <label
                  key={j.id}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-sm transition-colors ${
                    checked
                      ? "border-primary bg-primary/5 text-ink"
                      : "border-line bg-page text-ink hover:border-primary/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="jewelryIds"
                    value={j.id}
                    checked={checked}
                    onChange={(e) => toggle(j.id, e.target.checked)}
                    className="mt-0.5 size-4 rounded border-line text-primary focus:ring-primary"
                  />
                  <span>{j.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t.photoLabel}</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
        />
        <span className="text-xs text-mute">{t.photoHint}</span>
      </label>

      {state && state.ok === false ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-error/40 bg-error-soft px-4 py-2 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
      >
        {pending ? "…" : t.submit}
      </button>

      <p className="text-xs text-mute">
        {ru.studio.name}
      </p>
    </form>
  );
}
