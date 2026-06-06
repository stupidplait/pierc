import type { ReactNode } from "react";
import { Card } from "@/components/shadcn/ui/card";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import type { AboutData } from "./types";

/**
 * Contacts card — email / phone / address (+ Yandex directions link) / hours,
 * as a single surface with a two-column grid of labelled fields.
 *
 * Server component — purely presentational. The entrance is supplied by the
 * <Reveal> wrapper on the About page.
 */
export function ContactsBlock({ data }: { data: AboutData }) {
  const { email, phone, address, hours, t } = data;
  return (
    <Card className="grid gap-6 rounded-xl p-6 sm:grid-cols-2 sm:p-8">
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
