import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { SettingsWorkspace } from "@/components/admin/settings/SettingsWorkspace";

export const metadata: Metadata = {
  title: ru.admin.settings.title,
};

const t = ru.admin.settings;

export default async function AdminSettingsPage() {
  // Singleton — `prisma/seed.ts` ensures the row exists.
  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-3 max-w-prose text-base text-mute">{t.lead}</p>
      </header>
      <SettingsWorkspace
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
