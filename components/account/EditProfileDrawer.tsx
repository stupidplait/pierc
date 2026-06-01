"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Drawer } from "@/components/booking/Drawer";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { ru } from "@/lib/i18n/ru";
import { updateMyProfile } from "@/lib/user/profile-actions";

const t = ru.pages.account;

const FIELD =
  "h-11 w-full rounded-xl border border-ink/15 bg-ink/[0.03] px-3 text-base text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50 md:text-sm";
const ICON_BTN =
  "inline-flex size-9 items-center justify-center rounded-xl border border-ink/15 text-mute transition-colors duration-150 hover:border-ink hover:text-ink active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const SAVE =
  "inline-flex h-10 items-center justify-center rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50";
const CANCEL =
  "inline-flex h-10 items-center justify-center rounded-xl border border-ink-line-strong px-5 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink active:scale-[0.98]";

interface EditProfileDrawerProps {
  name: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  telegramConnected: boolean;
}

export function EditProfileDrawer({
  name,
  email,
  phone,
  telegram,
  telegramConnected,
}: EditProfileDrawerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMyProfile(fd);
      if (res.ok) {
        setError(null);
        setOpen(false);
      } else {
        setError(res.error ?? t.contactError);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={t.editProfile}
        title={t.editProfile}
        className={ICON_BTN}
      >
        <PencilIcon />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t.editProfileTitle}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label={t.nameLabel} name="name" defaultValue={name} required autoComplete="name" placeholder={t.namePlaceholder} />
          <Field
            label={t.emailLabel}
            name="email"
            type="email"
            inputMode="email"
            defaultValue={email}
            required
            autoComplete="email"
            placeholder={t.emailPlaceholder}
          />
          <Field
            label={t.phoneLabel}
            name="phone"
            phone
            defaultValue={phone ?? ""}
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-mute">{t.telegramLabel}</span>
            <input
              name="telegram"
              type="text"
              defaultValue={telegram ?? ""}
              disabled={telegramConnected}
              placeholder={t.telegramPlaceholder}
              className={FIELD}
            />
            {telegramConnected ? (
              <span className="text-xs text-mute">{t.telegramLockedHint}</span>
            ) : null}
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-error/40 bg-error-soft px-3 py-2 text-sm text-error"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={pending} className={SAVE}>
              {pending ? t.contactSaving : t.contactSave}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={CANCEL}>
              {t.close}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric" | "decimal";
  /** Render a RU phone field with the +7 (XXX) XXX-XX-XX live mask. */
  phone?: boolean;
  placeholder?: string;
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.4 2.6a1.4 1.4 0 0 1 2 2L6 12l-2.8.8.8-2.8 7.4-7.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type,
  required,
  autoComplete,
  inputMode,
  phone,
  placeholder,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-mute">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {phone ? (
        <PhoneInput
          name={name}
          defaultValue={defaultValue}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={FIELD}
        />
      ) : (
        <input
          name={name}
          type={type ?? "text"}
          defaultValue={defaultValue}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          className={FIELD}
        />
      )}
    </label>
  );
}
