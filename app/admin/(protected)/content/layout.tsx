import type { ReactNode } from "react";
import { ru } from "@/lib/i18n/ru";
import { ContentTabs } from "@/components/admin/ContentTabs";

export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 pt-2 sm:mb-12 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {ru.admin.content.title}
        </h1>
        <p className="mt-3 text-base text-mute">{ru.admin.content.lead}</p>
      </header>
      <ContentTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
