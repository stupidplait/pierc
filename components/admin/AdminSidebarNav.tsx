"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavLinks, ru } from "@/lib/i18n/ru";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label={ru.admin.panel} className="flex flex-col gap-0.5">
      {adminNavLinks.map((link) => {
        const active = isActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-ink/10 text-ink"
                : "text-mute hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {/* Accent rail marker — the single magenta moment, lit only on the
                active route (a faint dot on the rest). */}
            <span
              aria-hidden
              className={`size-1.5 rounded-full transition-colors duration-150 ${
                active
                  ? "bg-accent"
                  : "bg-ink/20 group-hover:bg-ink/40"
              }`}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
