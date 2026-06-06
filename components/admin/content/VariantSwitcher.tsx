"use client";

import { cn } from "@/lib/utils";

/**
 * Tiny segmented control for trying layout variants side by side (a temporary
 * affordance while we pick a final look). Generic over the variant union.
 */
export function VariantSwitcher<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-mute">{label}</span>
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-card p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              value === o.value ? "bg-ink text-bg" : "text-mute hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
