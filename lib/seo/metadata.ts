import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";

const DEFAULT_OG_IMAGE = "/og/home.jpg";

export interface BuildPageMetadataInput {
  /** Page title — `studio.name` is appended automatically. */
  title?: string;
  /** SERP / OG description, ideally 120–160 chars in Russian. */
  description: string;
  /** Path-relative canonical (e.g., "/about"). Resolved via metadataBase. */
  path: string;
  /**
   * OG / Twitter image URL. Can be absolute (e.g., a Vercel Blob URL
   * for jewelry photos) or path-relative ("/og/home.jpg"). Falls back
   * to the studio default.
   */
  image?: string | null;
  /** OG image alt text. Defaults to the page title. */
  imageAlt?: string;
}

/**
 * Build a Next.js `Metadata` object with OpenGraph + Twitter Cards
 * populated. Used by every public page so every shared link gets a
 * proper preview on Telegram / Instagram / WhatsApp.
 *
 * See docs/17-seo.md for the page-by-page matrix.
 */
export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const studio = ru.studio.name;
  const fullTitle = input.title ? `${input.title} — ${studio}` : studio;
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const imageAlt = input.imageAlt ?? input.title ?? studio;

  return {
    title: fullTitle,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      url: input.path,
      title: fullTitle,
      description: input.description,
      siteName: studio,
      locale: "ru_RU",
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: input.description,
      images: [image],
    },
  };
}
