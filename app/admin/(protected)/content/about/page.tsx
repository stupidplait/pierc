import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { AboutEditorForm } from "@/components/admin/AboutEditorForm";

export const metadata: Metadata = {
  title: ru.admin.content.tabs.about,
};

// Admin page — auth-walled and reads SiteContent on every request.
export const dynamic = "force-dynamic";

interface AboutContent {
  body?: string;
}

export default async function AdminAboutPage() {
  const row = await prisma.siteContent.findUnique({ where: { key: "about" } });
  const body = (row?.content as AboutContent | null)?.body ?? "";

  return <AboutEditorForm initialBody={body} />;
}
