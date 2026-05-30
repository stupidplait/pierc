import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsTabs } from "@/components/admin/settings/SettingsTabs";

export const metadata: Metadata = {
  title: `${ru.admin.settings.title} — ${ru.admin.panel}`,
};

export default async function AdminSettingsPage() {
  // Singleton — `prisma/seed.ts` ensures the row exists.
  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={ru.admin.settings.title}
        lead={ru.admin.settings.lead}
      />
      <SettingsTabs
        initial={{
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone,
          contactAddress: settings.contactAddress,
          instagramUrl: settings.instagramUrl,
          telegramUrl: settings.telegramUrl,
          telegramChatId: settings.telegramChatId,
          workingHoursHint: settings.workingHoursHint,
        }}
      />
    </div>
  );
}
