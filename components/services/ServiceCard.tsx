import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
import { Badge } from "@/components/shadcn/ui/badge";
import { Card } from "@/components/shadcn/ui/card";
import { formatDuration, formatPrice } from "@/lib/jewelry/format";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

interface ServiceCardProps {
  service: WizardService;
  user: BookingUser | null;
  bookLabel: string;
  className?: string;
}

// The grid cell for /services: rounded card + layered shadow, name + mono price
// on one row, the duration as a chip, a two-line clamped (height-reserved)
// blurb, and a subtle hover lift. Rendered by ServiceGrid; the flagship service
// uses the wider FeaturedServiceCard.
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
        {/* h2 (not h3): each service is a top-level section under the page h1 —
            the flagship FeaturedServiceCard is also an h2, so grid cards are its
            peers, not orphaned h3s nested under it (WCAG 1.3.1). */}
        <h2 className="font-display text-xl font-medium text-ink">
          {service.name}
        </h2>
        <span className="shrink-0 font-mono text-base font-medium tabular-nums text-ink">
          {formatPrice(service.price)}
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
          {formatDuration(service.durationMin)}
        </Badge>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </Card>
  );
}
