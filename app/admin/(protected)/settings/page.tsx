import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { SettingsWorkspace } from "@/components/admin/settings/SettingsWorkspace";
import { SettingsHeader } from "@/components/admin/settings/SettingsHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ru.admin.settings.title,
};

export default async function AdminSettingsPage() {
  // Steady state is a single read; the upsert only runs the first time the
  // singleton is missing (race-safe), instead of writing on every page view.
  const settings =
    (await prisma.settings.findUnique({ where: { id: "default" } })) ??
    (await prisma.settings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <SettingsHeader />
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
