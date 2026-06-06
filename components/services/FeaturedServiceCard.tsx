import { ru } from "@/lib/i18n/ru";
import { formatRub } from "./ServiceCard";
import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
import { Badge } from "@/components/shadcn/ui/badge";
import { Card } from "@/components/shadcn/ui/card";
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
    <Card className="grid gap-8 p-6 sm:grid-cols-[1.5fr_1fr] sm:gap-10 sm:p-8">
      <div>
        <Badge variant="accent" className="rounded-full px-2.5">
          {t.featuredTag}
        </Badge>
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
            <Badge
              variant="quiet"
              className="rounded-full text-[11px] font-normal uppercase tracking-widest"
            >
              {service.durationMin} мин
            </Badge>
          </div>
        </div>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </Card>
  );
}
