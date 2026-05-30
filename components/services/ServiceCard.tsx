import { ServiceBookButton } from "@/components/booking/ServiceBookButton";
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
    <div
      className={`group flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-medium text-ink">
          {service.name}
        </h3>
        <span className="shrink-0 font-mono text-base font-medium tabular-nums text-ink">
          {formatRub(service.price)}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-mute">
        {service.description}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-5">
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-mute">
          {service.durationMin} мин
        </span>
        <ServiceBookButton service={service} user={user} label={bookLabel} />
      </div>
    </div>
  );
}
