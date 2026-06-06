import { ru } from "@/lib/i18n/ru";

/**
 * Shared, client-safe model for the /admin/content manager. The Prisma loader
 * lives in the sibling `content-view-data.ts` (server-only) so importing the
 * constants/types below into a client component never drags Prisma into the
 * browser bundle.
 */

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMin: number | null;
  order: number;
  published: boolean;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  published: boolean;
}

export interface GalleryRow {
  id: string;
  url: string;
  caption: string | null;
  order: number;
  published: boolean;
}

export interface ContentData {
  about: string;
  services: ServiceRow[];
  faq: FaqRow[];
  gallery: GalleryRow[];
}

/** The four content sections, shared by the manager's tab navigation. */
export const CONTENT_SECTIONS = [
  { key: "about", label: ru.admin.content.tabs.about },
  { key: "services", label: ru.admin.content.tabs.services },
  { key: "faq", label: ru.admin.content.tabs.faq },
  { key: "gallery", label: ru.admin.content.tabs.gallery },
] as const;

export type SectionKey = (typeof CONTENT_SECTIONS)[number]["key"];
