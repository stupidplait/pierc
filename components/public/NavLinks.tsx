"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavLinks } from "@/lib/i18n/ru";

interface NavLinksProps {
  className?: string;
  itemClassName?: string;
  onNavigate?: () => void;
}

// True when the current pathname matches the link, including descendants.
// `/` only matches exactly. Other links match the segment + any descendants
// so e.g. `/catalog/abc` lights up the "Каталог" tab.
function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  className = "",
  itemClassName = "",
  onNavigate,
}: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className={className} aria-label="Основная навигация">
      {publicNavLinks.map((link) => {
        const active = isActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${itemClassName} ${active ? "text-primary" : "text-ink hover:text-primary"} transition-colors`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
