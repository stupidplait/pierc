import { ru } from "@/lib/i18n/ru";
import { ruPhoneHref } from "@/lib/phone";

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

  // sameAs — collect any social links.
  const sameAs: string[] = [];
  if (s?.instagramUrl) sameAs.push(s.instagramUrl);
  if (s?.telegramUrl) sameAs.push(s.telegramUrl);

  // We always emit name + url + image even if Settings is empty; that
  // alone is useful to Google. Bail out only if there's literally no
  // base URL to write.
  if (!base) return null;

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
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
