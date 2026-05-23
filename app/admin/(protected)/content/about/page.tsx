import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { AboutEditorForm } from "@/components/admin/AboutEditorForm";

export const metadata: Metadata = {
  title: `${ru.admin.content.tabs.about} — ${ru.admin.panel}`,
};

interface AboutContent {
  body?: string;
}

export default async function AdminAboutPage() {
  const row = await prisma.siteContent.findUnique({ where: { key: "about" } });
  const body = (row?.content as AboutContent | null)?.body ?? "";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-medium text-ink">
          {ru.admin.content.about.title}
        </h2>
        <p className="mt-1 text-sm text-mute">{ru.admin.content.about.lead}</p>
      </div>
      <AboutEditorForm initialBody={body} />
    </section>
  );
}
