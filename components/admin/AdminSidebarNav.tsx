"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { adminNavLinks, ru } from "@/lib/i18n/ru";
import { REVEAL_EASE } from "@/components/services/entrance/config";
import { NavIcon } from "./nav-icons";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The rows cascade in once on mount (the layout subtree persists across
// client navigations, so it plays per full load, not per route change).
const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: REVEAL_EASE },
  },
};

export function AdminSidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  /** Called when a link is tapped — lets the mobile drawer close on navigate. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <motion.nav
      aria-label={ru.admin.panel}
      variants={list}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-0.5"
    >
      {adminNavLinks.map((link) => {
        const active = isActive(link.href, pathname);
        return (
          <motion.div key={link.href} variants={row}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? link.label : undefined}
              className={`group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                active
                  ? "bg-ink/10 text-ink"
                  : "text-mute hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {/* Route glyph — the single magenta moment, lit only on the active
                  route; muted otherwise and brightening on hover. */}
              <span
                aria-hidden
                className={`shrink-0 transition-colors duration-150 ${
                  active ? "text-accent" : "text-mute group-hover:text-ink"
                }`}
              >
                <NavIcon href={link.href} />
              </span>
              {/* Label stays mounted and wipes open/shut in step with the rail.
                  A grid `0fr → 1fr` column collapses to a true zero width (the
                  inner span's `min-w-0 overflow-hidden` lets the track reach 0),
                  so there's no 1px glyph sliver and opacity can fade in with the
                  wipe rather than popping at full width. It stays in the a11y
                  tree (clipped, not removed), keeping the link's accessible name
                  when collapsed. */}
              <motion.span
                initial={false}
                animate={{
                  gridTemplateColumns: collapsed ? "0fr" : "1fr",
                  opacity: collapsed ? 0 : 1,
                  marginLeft: collapsed ? 0 : 10,
                }}
                transition={{ duration: 0.3, ease: REVEAL_EASE }}
                className="grid min-w-0"
              >
                <span className="min-w-0 overflow-hidden whitespace-nowrap">
                  {link.label}
                </span>
              </motion.span>
            </Link>
          </motion.div>
        );
      })}
    </motion.nav>
  );
}
