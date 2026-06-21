import { ru } from "@/lib/i18n/ru";
import { ruPhoneHref } from "@/lib/phone";
import { TELEGRAM_ENABLED, INSTAGRAM_ENABLED } from "@/lib/flags";

export interface LocalBusinessInput {
  /** Absolute base URL of the deployment, e.g. "https://piercing.studio". */
  baseUrl: string;
  /** Settings singleton — fields are optional. */
  settings: {
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
    instagramUrl: string | null;
    telegramUrl: string | null;
    workingHoursHint: string | null;
  } | null;
}

/**
 * Build a `LocalBusiness` JSON-LD payload for embedding in `/about`.
 * Empty fields are omitted — Google tolerates partial schemas, and a
 * half-complete record is better than fabricated data. Returns `null`
 * when there's truly nothing useful to publish (no settings at all).
 *
 * See docs/17-seo.md for the full spec.
 */
export function buildLocalBusinessJsonLd(
  input: LocalBusinessInput,
): Record<string, unknown> | null {
  const s = input.settings;
  const base = input.baseUrl.replace(/\/$/, "");
  const studioName = ru.studio.name;

  // sameAs — collect any social links. A channel is omitted when its
  // kill-switch is off so the public knowledge-graph doesn't advertise a
  // hidden channel.
  const sameAs: string[] = [];
  if (INSTAGRAM_ENABLED && s?.instagramUrl) sameAs.push(s.instagramUrl);
  if (TELEGRAM_ENABLED && s?.telegramUrl) sameAs.push(s.telegramUrl);

  // We always emit name + url + image even if Settings is empty; that
  // alone is useful to Google. Bail out only if there's literally no
  // base URL to write.
  if (!base) return null;

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    // HealthAndBeautyBusiness is a LocalBusiness subtype that maps a piercing
    // studio more precisely; @id gives the entity a stable node identity other
    // pages / structured data can reference.
    "@type": "HealthAndBeautyBusiness",
    "@id": `${base}/#business`,
    name: studioName,
    url: `${base}/`,
    image: `${base}/og/home.jpg`,
  };

  if (s?.contactEmail) json.email = s.contactEmail;
  if (s?.contactPhone) json.telephone = ruPhoneHref(s.contactPhone);
  if (s?.contactAddress) {
    json.address = {
      "@type": "PostalAddress",
      streetAddress: s.contactAddress,
      addressCountry: "RU",
    };
  }
  if (s?.workingHoursHint) {
    json.openingHoursSpecification = [
      {
        "@type": "OpeningHoursSpecification",
        description: s.workingHoursHint,
      },
    ];
  }
  if (sameAs.length > 0) json.sameAs = sameAs;

  return json;
}

/**
 * Build a `FAQPage` JSON-LD payload from the published Q&A rows so search
 * engines can surface the Q&A. `inLanguage: "ru"` matches the all-Russian
 * content. Serialize for embedding with {@link jsonLdScript}.
 */
export function buildFaqJsonLd(
  items: ReadonlyArray<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "ru",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}

/**
 * Build an `OfferCatalog` JSON-LD payload from the published services so search
 * engines can read the studio's priced offerings (consistency with the
 * LocalBusiness + FAQPage schemas). Each entry is an Offer for a Service tied to
 * the business via `provider` @id; `price` is the RAW decimal string, never the
 * formatted "₽" display value. Returns null when there's nothing to publish.
 * Serialize for embedding with {@link jsonLdScript}.
 */
export function buildServicesJsonLd(
  services: ReadonlyArray<{
    name: string;
    description: string | null;
    price: string;
  }>,
  baseUrl: string,
): Record<string, unknown> | null {
  const base = baseUrl.replace(/\/$/, "");
  if (!base || services.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: ru.studio.name,
    inLanguage: "ru",
    itemListElement: services.map((s) => ({
      "@type": "Offer",
      priceCurrency: "RUB",
      price: s.price,
      itemOffered: {
        "@type": "Service",
        name: s.name,
        ...(s.description ? { description: s.description } : {}),
        provider: { "@id": `${base}/#business` },
      },
    })),
  };
}

/**
 * Build an `ImageGallery` JSON-LD payload from the published gallery photos so
 * image search can surface the studio's work. Each photo is an ImageObject with
 * its contentUrl + (when present) the caption as name/caption. Returns null when
 * there's nothing to publish. Serialize with {@link jsonLdScript}.
 */
export function buildGalleryJsonLd(
  photos: ReadonlyArray<{ url: string; caption: string | null }>,
): Record<string, unknown> | null {
  if (photos.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: ru.studio.name,
    inLanguage: "ru",
    image: photos.map((p) => ({
      "@type": "ImageObject",
      contentUrl: p.url,
      ...(p.caption ? { name: p.caption, caption: p.caption } : {}),
    })),
  };
}

/**
 * Serialize a JSON-LD payload for a `<script type="application/ld+json">` body.
 *
 * Escapes the characters that are dangerous inside a `<script>` element: `<`
 * (escaped to `<`) prevents a `</script>` breakout — broken markup at best,
 * stored XSS at worst — and U+2028 / U+2029 keep inline parsers happy. The output
 * is still valid JSON-LD that Google parses. This matters because some payloads
 * carry admin-editable, free-form text (e.g. FAQ answers) injected via
 * `dangerouslySetInnerHTML`.
 */
export function jsonLdScript(json: unknown): string {
  return JSON.stringify(json)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
