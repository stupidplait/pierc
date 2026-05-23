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
    <nav aria-label={ru.admin.panel} className="flex flex-col gap-1">
      {adminNavLinks.map((link) => {
        const active = isActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-ink hover:bg-card hover:text-primary"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
