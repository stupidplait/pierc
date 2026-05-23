"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ru } from "@/lib/i18n/ru";

const tabs = [
  { href: "/admin/content/about", label: ru.admin.content.tabs.about },
  { href: "/admin/content/services", label: ru.admin.content.tabs.services },
  { href: "/admin/content/faq", label: ru.admin.content.tabs.faq },
  { href: "/admin/content/gallery", label: ru.admin.content.tabs.gallery },
];

export function ContentTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={ru.admin.content.title}
      className="-mx-1 flex flex-wrap gap-1 border-b border-line"
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
