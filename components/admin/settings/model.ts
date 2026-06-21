import { ru } from "@/lib/i18n/ru";
import { TELEGRAM_ENABLED, INSTAGRAM_ENABLED } from "@/lib/flags";

export interface SettingsLike {
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  instagramUrl?: string | null;
  telegramUrl?: string | null;
  telegramChatId?: string | null;
  workingHoursHint?: string | null;
}

export type FieldName = keyof SettingsLike;

export interface FieldDef {
  name: FieldName;
  label: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric" | "decimal";
  autoComplete?: string;
  placeholder?: string;
  phone?: boolean;
  digitsOnly?: boolean;
  full?: boolean;
  /**
   * When set, the field renders as a fixed, non-editable URL prefix (shown
   * greyed) followed by an editable handle. The form still submits — and the
   * store keeps — the full URL (`prefix + handle`).
   */
  prefix?: string;
  /**
   * Renders an inline "Проверить" link beside the label that pings the
   * currently-typed value as a Telegram chat id. Only meaningful for
   * `telegramChatId`.
   */
  testTelegram?: boolean;
}

export interface SectionDef {
  key: string;
  heading: string;
  lead: string;
  fields: FieldDef[];
}

const t = ru.admin.settings;

// Per-field feature gates: a field is rendered only when its flag is on (true
// when no flag governs it). Telegram + Instagram each have a kill-switch.
// Sections left empty after filtering (e.g. the Telegram-only integrations
// section) are dropped entirely.
const FIELD_ENABLED: Partial<Record<FieldName, boolean>> = {
  telegramUrl: TELEGRAM_ENABLED,
  telegramChatId: TELEGRAM_ENABLED,
  instagramUrl: INSTAGRAM_ENABLED,
};

const ALL_SETTINGS_SECTIONS: SectionDef[] = [
  {
    key: "contacts",
    heading: t.contactsHeading,
    lead: t.contactsLead,
    fields: [
      {
        name: "contactEmail",
        label: t.contactEmailLabel,
        type: "email",
        inputMode: "email",
        autoComplete: "email",
        placeholder: "hello@example.com",
      },
      {
        name: "contactPhone",
        label: t.contactPhoneLabel,
        phone: true,
        placeholder: "+7 (000) 000-00-00",
      },
      {
        name: "contactAddress",
        label: t.contactAddressLabel,
        placeholder: t.contactAddressPlaceholder,
      },
      {
        name: "workingHoursHint",
        label: t.workingHoursLabel,
        placeholder: "Пн–Пт: 11:00–19:00",
      },
    ],
  },
  {
    key: "social",
    heading: t.socialHeading,
    lead: t.socialLead,
    fields: [
      {
        name: "instagramUrl",
        label: t.instagramUrlLabel,
        prefix: "https://instagram.com/",
        placeholder: "username",
      },
      {
        name: "telegramUrl",
        label: t.telegramUrlLabel,
        prefix: "https://t.me/",
        placeholder: "username",
      },
    ],
  },
  {
    key: "integrations",
    heading: t.integrationsHeading,
    lead: t.integrationsLead,
    fields: [
      {
        name: "telegramChatId",
        label: t.telegramChatIdLabel,
        placeholder: "123456789",
        inputMode: "numeric",
        digitsOnly: true,
        full: true,
        testTelegram: true,
      },
    ],
  },
];

export const SETTINGS_SECTIONS: SectionDef[] = ALL_SETTINGS_SECTIONS.map(
  (section) => ({
    ...section,
    fields: section.fields.filter((f) => FIELD_ENABLED[f.name] ?? true),
  }),
).filter((section) => section.fields.length > 0);
