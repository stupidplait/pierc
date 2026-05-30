import type { ReactNode } from "react";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentTabs } from "@/components/admin/ContentTabs";

export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={ru.admin.content.title}
        lead={ru.admin.content.lead}
      />
      <ContentTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
