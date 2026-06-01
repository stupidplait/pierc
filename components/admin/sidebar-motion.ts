// Shared motion constants for the admin rail's collapse animation.
//
// The wordmark + nav labels reveal via a CSS-grid `0fr → 1fr` column (see
// AdminSidebar / AdminSidebarNav): the track collapses to a true zero width, so
// opacity can fade in alongside the wipe without a 1px glyph sliver — no
// opacity-timing workaround needed.

export const RAIL_EASE = [0.16, 1, 0.3, 1] as const;
