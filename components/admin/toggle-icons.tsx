// Collapse/expand chevron for the rail's edge handle. Decorative — the button
// supplies the accessible name. Points the way the rail will move: ‹ to fold,
// › to expand.
export function ChevronToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={collapsed ? "M6 3l5 5-5 5" : "M10 3 5 8l5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
