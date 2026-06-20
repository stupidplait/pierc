import type { ru } from "@/lib/i18n/ru";
import type { TestimonialCardData } from "@/components/public/TestimonialCard";

/** Exact (readonly) shape of the About page's RU strings (`ru.pages.about`). */
export type AboutStrings = (typeof ru)["pages"]["about"];

/**
 * Everything the About page derives once in the server component and hands to
 * the AboutContent orchestrator. Presentational leaves read this typed contract
 * (mostly `t`) and never fetch or touch i18n directly.
 */
export interface AboutData {
  /** Studio-story paragraphs, split on blank lines (may be empty). */
  paragraphs: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  testimonials: TestimonialCardData[];
  /** `ru.pages.about` — all page copy, incl. the reviews heading/lead. */
  t: AboutStrings;
  /** Nav label for the secondary hero CTA (`ru.nav.services`). */
  servicesLabel: string;
}
