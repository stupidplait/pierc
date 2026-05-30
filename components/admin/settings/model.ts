import { ru } from "@/lib/i18n/ru";

// Serializable shape the settings page passes to every variant. Mirrors the
// columns the `updateSettings` action reads from the form, so the three
// presentations stay in lockstep with the data model.
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
  /** RU +7 (XXX) XXX-XX-XX live mask instead of a plain input. */
  phone?: boolean;
  /** Spans both columns in two-up grids. */
  full?: boolean;
}

export interface SectionDef {
  key: string;
  heading: string;
  lead: string;
  fields: FieldDef[];
}

const t = ru.admin.settings;

// The single source of truth for which fields live where. All three variants
// iterate this — only the layout around it differs.
export const SETTINGS_SECTIONS: SectionDef[] = [
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
        full: true,
      },
      {
        name: "workingHoursHint",
        label: t.workingHoursLabel,
        placeholder: "Вт–Сб · 11:00–19:00",
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
        type: "url",
        inputMode: "url",
        autoComplete: "url",
        placeholder: "https://instagram.com/…",
      },
      {
        name: "telegramUrl",
        label: t.telegramUrlLabel,
        type: "url",
        inputMode: "url",
        autoComplete: "url",
        placeholder: "https://t.me/…",
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
        full: true,
      },
    ],
  },
];
