import { jsonLdScript } from "@/lib/seo/local-business";

/**
 * Renders a server-built JSON-LD payload as a
 * `<script type="application/ld+json">`. The dangerous part — escaping a
 * `</script>` breakout from admin-entered text — is centralized in jsonLdScript,
 * so this is the single home for the dangerouslySetInnerHTML (the no-danger
 * suppression no longer needs copy-pasting into every page that emits schema).
 * Renders nothing when `data` is null.
 */
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      // Trusted, server-built JSON-LD; jsonLdScript escapes `<`/`>`/`&` so
      // admin-entered text can't break out of the <script>.
      // react-doctor-disable-next-line react-doctor/no-danger
      dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
    />
  );
}
