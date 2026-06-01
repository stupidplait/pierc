"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { signOutAdminAction } from "@/lib/admin/auth-actions";
import { ExitIcon } from "@/components/admin/dashboard/icons";
import { RAIL_EASE } from "./sidebar-motion";

// Avatar initials from the admin's name, falling back to the email local-part.
function initials(name: string, email: string): string {
  const src = name.trim() || email.split("@")[0] || "";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR =
  "flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-bg";

/**
 * Auth state pinned to the bottom of the sidebar. The row is a fixed height so
 * the avatar never shifts as the rail folds.
 *
 *   - Expanded: avatar + name/email + a sign-out button, sliding/fading in.
 *   - Collapsed: name/email aren't needed, so the avatar itself becomes the
 *     sign-out control — click it to log out (it swaps to an exit glyph on
 *     hover/focus, with a tooltip). No flyover to chase.
 *
 * Used by the desktop rail and the (always-expanded) mobile header.
 */
export function AdminIdentity({
  name,
  email,
  collapsed = false,
}: {
  name: string;
  email: string;
  collapsed?: boolean;
}) {
  const label = initials(name, email);

  // px-1.5 (not px-3): the 32px avatar is wider than the 18px nav icons, so it
  // needs less padding to sit centred in the narrow collapsed strip. This also
  // centre-aligns it with the nav-icon column and keeps it stationary across the
  // fold (it's left-anchored, so the rail just narrows around it).
  return (
    <div className="flex h-9 items-center gap-2.5 px-1.5">
      {/* Avatar — display chip when expanded; the sign-out control itself when
          collapsed (same chip, so the swap is invisible; no vertical shift since
          the row height is fixed). */}
      {collapsed ? (
        <form action={signOutAdminAction}>
          <button
            type="submit"
            aria-label={ru.admin.nav.signOut}
            title={ru.admin.nav.signOut}
            className={`${AVATAR} group/av relative overflow-hidden transition-transform duration-150 active:scale-[0.97]`}
          >
            <span
              aria-hidden
              className="transition-opacity duration-150 group-hover/av:opacity-0 group-focus-visible/av:opacity-0"
            >
              {label}
            </span>
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/av:opacity-100 group-focus-visible/av:opacity-100"
            >
              <ExitIcon />
            </span>
          </button>
        </form>
      ) : (
        <span aria-hidden className={AVATAR}>
          {label}
        </span>
      )}

      {/* Name/email + sign-out — only expanded, sliding/fading with the rail.
          Kept under a stable AnimatePresence so it animates on every toggle. */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="meta"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.22, ease: RAIL_EASE }}
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            <span className="min-w-0 flex-1">
              {name ? (
                <span className="block truncate text-sm font-medium leading-tight text-ink">
                  {name}
                </span>
              ) : null}
              <span className="block truncate text-xs leading-tight text-mute">
                {email}
              </span>
            </span>
            <form action={signOutAdminAction}>
              <button
                type="submit"
                aria-label={ru.admin.nav.signOut}
                title={ru.admin.nav.signOut}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-mute transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
              >
                <ExitIcon />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
