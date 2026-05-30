"use client";

import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

interface SummaryLine {
  id: string;
  name: string;
  price: string;
}

interface BookingSummaryProps {
  service?: { name: string; price: string } | null;
  items?: SummaryLine[];
  slotLabel?: string | null;
}

function sumPrices(
  service: BookingSummaryProps["service"],
  items: SummaryLine[],
): number {
  let total = service ? Number(service.price) || 0 : 0;
  for (const it of items) total += Number(it.price) || 0;
  return total;
}

export function BookingSummary({
  service = null,
  items = [],
  slotLabel = null,
}: BookingSummaryProps) {
  const t = ru.pages.book.contactStep;
  const empty = !service && items.length === 0 && !slotLabel;
  const total = sumPrices(service, items);

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
        {t.summaryHeading}
      </h3>
      {empty ? (
        <p className="text-sm text-mute">{t.summaryNothing}</p>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          {service ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-mute">
                {t.summaryService}
              </p>
              <p className="flex justify-between gap-3 text-ink">
                <span>{service.name}</span>
                <span className="tabular-nums">{formatPrice(service.price)}</span>
              </p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-mute">
                {t.summaryJewelry}
              </p>
              <ul className="flex flex-col gap-1">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3 text-ink">
                    <span className="truncate">{it.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatPrice(it.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {slotLabel ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-mute">
                {t.summarySlot}
              </p>
              <p className="text-ink">{slotLabel}</p>
            </div>
          ) : null}

          {total > 0 ? (
            <div className="flex justify-between gap-3 border-t border-line pt-3 font-medium text-ink">
              <span>{t.summaryTotal}</span>
              <span className="tabular-nums">{formatPrice(String(total))}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
