import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import type { AboutData } from "./types";

/**
 * Contacts card — email / phone / address (+ Yandex directions link) / hours.
 * Just the card surface; the variant supplies its own heading so the contacts
 * read consistently no matter which design wraps them.
 */
export function ContactsBlock({ data }: { data: AboutData }) {
  const { email, phone, address, hours, t } = data;
  return (
    <Card radius="rounded-xl" className="grid gap-6 sm:grid-cols-2">
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
      <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
        {label}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
