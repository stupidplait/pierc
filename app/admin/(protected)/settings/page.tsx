import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { NotificationTestButton } from "@/components/admin/NotificationTestButton";

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
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={ru.admin.settings.title}
        lead={ru.admin.settings.lead}
      />
      <SettingsForm initial={settings} />

      <section className="mt-12">
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-mute">
            {ru.admin.settings.notificationsHeading}
          </h2>
          <p className="mb-4 max-w-prose text-sm text-mute">
            {ru.admin.settings.notificationsLead}
          </p>
          <NotificationTestButton />
        </Card>
      </section>
    </div>
  );
}
