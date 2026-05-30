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
      className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-card p-1"
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-bg" : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
