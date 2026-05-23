"use client";

import { useActionState } from "react";
import {
  TextField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import {
  updateSettings,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

interface SettingsLike {
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  instagramUrl?: string | null;
  telegramUrl?: string | null;
  telegramChatId?: string | null;
  workingHoursHint?: string | null;
}

export function SettingsForm({ initial }: { initial: SettingsLike }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateSettings,
    undefined,
  );
  const t = ru.admin.settings;

  return (
    <form action={action} className="flex flex-col gap-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-mute sm:col-span-2">
          {t.contactsHeading}
        </legend>
        <TextField
          name="contactEmail"
          label={t.contactEmailLabel}
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={initial.contactEmail}
          placeholder="hello@example.com"
        />
        <TextField
          name="contactPhone"
          label={t.contactPhoneLabel}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={initial.contactPhone}
          placeholder="+7 (000) 000-00-00"
        />
        <div className="sm:col-span-2">
          <TextField
            name="contactAddress"
            label={t.contactAddressLabel}
            defaultValue={initial.contactAddress}
          />
        </div>
        <TextField
          name="workingHoursHint"
          label={t.workingHoursLabel}
          defaultValue={initial.workingHoursHint}
          placeholder="Вт–Сб · 11:00–19:00"
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-mute sm:col-span-2">
          {t.socialHeading}
        </legend>
        <TextField
          name="instagramUrl"
          label={t.instagramUrlLabel}
          type="url"
          inputMode="url"
          autoComplete="url"
          defaultValue={initial.instagramUrl}
          placeholder="https://instagram.com/…"
        />
        <TextField
          name="telegramUrl"
          label={t.telegramUrlLabel}
          type="url"
          inputMode="url"
          autoComplete="url"
          defaultValue={initial.telegramUrl}
          placeholder="https://t.me/…"
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-mute sm:col-span-2">
          {t.integrationsHeading}
        </legend>
        <div className="sm:col-span-2">
          <TextField
            name="telegramChatId"
            label={t.telegramChatIdLabel}
            defaultValue={initial.telegramChatId}
            placeholder="123456789"
          />
        </div>
      </fieldset>

      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "…" : t.save}
        </PrimarySubmit>
      </div>
    </form>
  );
}
