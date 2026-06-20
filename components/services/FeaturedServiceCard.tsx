import { formatDuration, formatPrice } from "@/lib/jewelry/format";
import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
import { Badge } from "@/components/shadcn/ui/badge";
import { Card } from "@/components/shadcn/ui/card";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

interface FeaturedServiceCardProps {
  service: WizardService;
  user: BookingUser | null;
  bookLabel: string;
  featuredTag: string;
  included: readonly string[];
}

// The flagship service card promoted above the grid by /services: a wide card
// split into a detail column (tag, name, blurb, what's-included) and a price/CTA
// column divided by a hairline rule on sm+. Static (no motion) — the page wraps
// it in the entrance reveal. i18n strings arrive as props (like ServiceCard), so
// the card stays presentational.
export function FeaturedServiceCard({
  service,
  user,
  bookLabel,
  featuredTag,
  included,
}: FeaturedServiceCardProps) {
  return (
    <Card className="grid gap-8 p-6 sm:grid-cols-[1.5fr_1fr] sm:gap-10 sm:p-8">
      <div>
        <Badge variant="accent" className="rounded-full px-2.5">
          {featuredTag}
        </Badge>
        <h2 className="mt-5 font-display text-3xl font-medium text-ink sm:text-4xl">
          {service.name}
        </h2>
        {service.description ? (
          <p className="mt-4 max-w-prose text-mute">{service.description}</p>
        ) : null}
        <ul className="mt-6 space-y-2.5">
          {included.map((item) => (
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
            {formatPrice(service.price)}
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <Badge
              variant="quiet"
              className="rounded-full text-[11px] font-normal uppercase tracking-widest"
            >
              {formatDuration(service.durationMin)}
            </Badge>
          </div>
        </div>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </Card>
  );
}
