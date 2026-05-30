import type { ru } from "@/lib/i18n/ru";
import type { TestimonialCardData } from "@/components/public/TestimonialCard";

/** Exact (readonly) shape of the About page's RU strings, incl. variant copy. */
export type AboutStrings = (typeof ru)["pages"]["about"];

/**
 * Everything the About page fetches/derives once in the server component,
 * handed to whichever design variant is selected via `?v=`. Variants are
 * presentational — they never fetch or touch i18n directly, they read `t`.
 */
export interface AboutData {
  /** Studio-story paragraphs, split on blank lines (may be empty). */
  paragraphs: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  testimonials: TestimonialCardData[];
  /** `ru.pages.about` — all page copy. */
  t: AboutStrings;
  /** Reviews-section heading/lead (live under a separate i18n namespace). */
  reviewsHeading: string;
  reviewsLead: string;
}
