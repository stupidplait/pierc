import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
import { Badge } from "@/components/shadcn/ui/badge";
import { Card } from "@/components/shadcn/ui/card";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatRub(price: string | number): string {
  return priceFormatter.format(Number(price));
}

interface ServiceCardProps {
  service: WizardService;
  user: BookingUser | null;
  bookLabel: string;
  className?: string;
}

// The service card the studio already likes, lifted verbatim out of the
// services page so every redesign variant renders the identical surface:
// rounded card + layered shadow, name + mono price on one row, the duration as
// a chip, a two-line clamped (and height-reserved) blurb, and a subtle hover
// lift. Shared so the cards stay pixel-identical across all five layouts.
export function ServiceCard({
  service,
  user,
  bookLabel,
  className = "",
}: ServiceCardProps) {
  return (
    <Card
      className={`group flex h-full flex-col p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-medium text-ink">
          {service.name}
        </h3>
        <span className="shrink-0 font-mono text-base font-medium tabular-nums text-ink">
          {formatRub(service.price)}
        </span>
      </div>
      {service.description ? (
        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-mute">
          {service.description}
        </p>
      ) : (
        // Keep the two-line slot reserved so cards stay aligned in the grid
        // even when a service has no blurb (matches min-h-10 above).
        <p className="mt-3 min-h-10" aria-hidden />
      )}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-5">
        <Badge
          variant="quiet"
          className="rounded-full text-[11px] font-normal uppercase tracking-widest"
        >
          {service.durationMin} мин
        </Badge>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </Card>
  );
}
