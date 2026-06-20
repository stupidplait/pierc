import type { ReactNode } from "react";
import { Card } from "@/components/shadcn/ui/card";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import type { AboutStrings } from "./types";

/**
 * Contacts card — email / phone / address (+ Yandex directions link) / hours,
 * as a single surface with a two-column description list. Modelled as a
 * <dl>/<dt>/<dd> (like the adjacent SpecSheet) so the field names don't pollute
 * the page's heading outline and assistive tech gets the label↔value
 * association for free.
 *
 * Server component — purely presentational. Takes the narrow fields it renders
 * (not the whole AboutData blob). The entrance is supplied by the <Reveal>
 * wrapper on the About page.
 */
export function ContactsBlock({
  email,
  phone,
  address,
  hours,
  t,
}: {
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  t: AboutStrings;
}) {
  return (
    <Card className="rounded-xl p-6 sm:p-8">
      <dl className="grid gap-6 sm:grid-cols-2">
        <ContactItem label={t.email}>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="text-ink transition-colors hover:text-primary"
            >
              {email}
            </a>
          ) : (
            <span className="text-mute">–</span>
          )}
        </ContactItem>
        <ContactItem label={t.phone}>
          {phone ? (
            <a
              href={`tel:${ruPhoneHref(phone)}`}
              className="text-ink transition-colors hover:text-primary"
            >
              {formatRuPhone(phone)}
            </a>
          ) : (
            <span className="text-mute">–</span>
          )}
        </ContactItem>
        <ContactItem label={t.address}>
          {address ? (
            <div className="space-y-1">
              <span className="block text-ink">{address}</span>
              <a
                href={`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary transition-colors hover:text-primary-soft"
              >
                {t.directions} →
              </a>
            </div>
          ) : (
            <span className="text-mute">–</span>
          )}
        </ContactItem>
        <ContactItem label={t.hours}>
          <span className="text-ink">{hours ?? "–"}</span>
        </ContactItem>
      </dl>
    </Card>
  );
}

function ContactItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
        {label}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}
