/**
 * A single shimmering placeholder block for route `loading.tsx` skeletons —
 * the house surface (`bg-card`) with a pulse. Decorative, so it's `aria-hidden`;
 * each loading.tsx pairs a tree of these with ONE sr-only `role="status"` line
 * so assistive tech announces "Загрузка…" once, not once per bar.
 *
 * Default radius is `rounded-xl`; pass `rounded-full` / `rounded-2xl` / `rounded`
 * via className to match the real element being stood in for.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-card ${className}`}
    />
  );
}
