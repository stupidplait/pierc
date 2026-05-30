/**
 * SpecSheet — the materials/standards rendered as a technical data sheet
 * instead of equal tiles: a bordered list with hairline row dividers, the
 * human-readable label on the left and the mono spec value pinned right. Reads
 * like the readout panel the "Steel Atelier" identity is built on.
 */
export function SpecSheet({
  items,
}: {
  items: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <dl className="overflow-hidden rounded-xl border border-line bg-card">
      {items.map((m, i) => (
        <div
          key={m.label}
          className={`flex items-baseline justify-between gap-6 px-5 py-4 sm:px-6 sm:py-5 ${
            i > 0 ? "border-t border-line" : ""
          }`}
        >
          <dt className="text-sm text-mute sm:text-base">{m.label}</dt>
          <dd className="whitespace-nowrap font-mono text-base font-medium text-ink sm:text-lg">
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
