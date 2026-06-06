/**
 * SpecSheet — the materials/standards rendered as a technical data sheet
 * instead of equal tiles: a bordered list with hairline row dividers, the
 * human-readable label on the left and the mono spec value pinned right. Reads
 * like the readout panel the "Steel Atelier" identity is built on.
 *
 * Server component — purely presentational. The entrance is supplied by the
 * <Reveal> wrapper on the About page.
 */
export function SpecSheet({
  items,
}: {
  items: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <dl className="overflow-hidden rounded-xl border border-line bg-card shadow-elev">
      {items.map((m, i) => (
        <div
          key={m.label}
          className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-6 sm:py-5 ${
            i > 0 ? "border-t border-line" : ""
          }`}
        >
          <dt className="text-sm text-mute sm:text-base">{m.label}</dt>
          <dd className="font-mono text-base font-medium text-ink sm:whitespace-nowrap sm:text-lg">
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
