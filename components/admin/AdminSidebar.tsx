"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "@/lib/admin/sidebar-collapsed";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { AdminIdentity } from "./AdminIdentity";
import { ChevronToggle } from "./toggle-icons";
import { RAIL_EASE as EASE } from "./sidebar-motion";

const EXPANDED_W = 288; // a touch wider than w-64 so the admin email fits
const COLLAPSED_W = 84; // narrow icon strip — px-3 reads as centred at this width

/**
 * Desktop admin rail. The header carries only the logo; the collapse control is
 * a rounded-square handle floating on the rail's right divider (Notion/Supabase
 * style), so nothing competes for space in the narrow strip. Only the wordmark's
 * width animates as the rail folds. Mobile uses the layout's top header instead
 * (this is `hidden md:flex`).
 */
export function AdminSidebar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const collapsed = useSidebarCollapsed();
  const toggleLabel = collapsed ? ru.admin.nav.expand : ru.admin.nav.collapse;

  return (
    <MotionConfig reducedMotion="user">
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={{ duration: 0.32, ease: EASE }}
        className="sticky top-0 z-20 hidden h-screen shrink-0 flex-col overflow-visible border-r border-line/70 bg-card/60 p-5 backdrop-blur-xl md:flex"
      >
        {/* Rounded-square handle on the divider — always visible, never competes
            with the logo for horizontal space. */}
        <button
          type="button"
          onClick={() => toggleSidebarCollapsed()}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="absolute right-0 top-8 z-30 inline-flex size-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-lg border border-line bg-card text-mute shadow-[0_1px_3px_rgba(8,8,8,0.4)] transition-colors duration-150 hover:border-ink/40 hover:text-ink active:scale-[0.97]"
        >
          <ChevronToggle collapsed={collapsed} />
        </button>

        {/* Header: logo only. `pl-3` shares the nav icons' left edge when
            expanded, but the 24px mark is wider than the 18px nav glyphs, so a
            fixed left pad leaves it ~2px right of centre in the narrow strip.
            We ease the left pad 12→10px as it folds so the mark lands dead-centre
            of the 44px collapsed strip — aligned with the avatar below it. */}
        <motion.div
          initial={false}
          animate={{ paddingLeft: collapsed ? 10 : 12 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex items-center pr-3"
        >
          <Link
            href="/"
            aria-label={ru.studio.name}
            className="flex min-w-0 items-center font-display text-lg font-medium tracking-tight text-ink"
          >
            <BrandMark className="size-6 shrink-0" />
            <motion.span
              initial={false}
              animate={{
                gridTemplateColumns: collapsed ? "0fr" : "1fr",
                opacity: collapsed ? 0 : 1,
                marginLeft: collapsed ? 0 : 10,
              }}
              transition={{ duration: 0.32, ease: EASE }}
              className="grid min-w-0"
            >
              <span className="min-w-0 overflow-hidden whitespace-nowrap">
                {ru.studio.name}
              </span>
            </motion.span>
          </Link>
        </motion.div>

        <div className="mt-8 flex-1">
          <AdminSidebarNav collapsed={collapsed} />
        </div>

        <div className="mt-6 border-t border-line/70 pt-4">
          <AdminIdentity name={name} email={email} collapsed={collapsed} />
        </div>
      </motion.aside>
    </MotionConfig>
  );
}
