import { ru } from "@/lib/i18n/ru";
import { formatRub } from "./ServiceCard";
import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

interface FeaturedServiceCardProps {
  service: WizardService;
  user: BookingUser | null;
  bookLabel: string;
}

// The flagship service card promoted above the grid: a wide card split into a
// detail column (tag, name, blurb, what's-included) and a price/CTA column
// divided by a hairline rule on sm+. Static (no motion) — the services page
// and the motion-preview variants both render this so the card stays identical
// regardless of which entrance animation wraps it.
export function FeaturedServiceCard({
  service,
  user,
  bookLabel,
}: FeaturedServiceCardProps) {
  const t = ru.pages.services;

  return (
    <div className="grid gap-8 rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)] sm:grid-cols-[1.5fr_1fr] sm:gap-10 sm:p-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t.featuredTag}
        </span>
        <h2 className="mt-5 font-display text-3xl font-medium text-ink sm:text-4xl">
          {service.name}
        </h2>
        {service.description ? (
          <p className="mt-4 max-w-prose text-mute">{service.description}</p>
        ) : null}
        <ul className="mt-6 space-y-2.5">
          {t.included.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 text-sm text-ink"
            >
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-between gap-6 border-line sm:border-l sm:pl-10">
        <div>
          <p className="font-mono text-4xl font-medium tabular-nums text-ink sm:text-5xl">
            {formatRub(service.price)}
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-mute">
              {service.durationMin} мин
            </span>
          </div>
        </div>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </div>
  );
}
