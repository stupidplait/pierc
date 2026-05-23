import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { JewelryForm } from "@/components/admin/JewelryForm";

export const metadata: Metadata = {
  title: `${ru.admin.jewelry.newTitle} — ${ru.admin.panel}`,
};

export default async function AdminJewelryNewPage() {
  const [categories, anchors] = await Promise.all([
    prisma.jewelryCategory.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.anchorPoint.findMany({
      orderBy: [{ place: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, place: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={ru.admin.jewelry.title}
        title={ru.admin.jewelry.newTitle}
      >
        <Button href="/admin/jewelry" variant="ghost" size="sm">
          ← {ru.admin.jewelry.backToList}
        </Button>
      </PageHeader>
      <JewelryForm categories={categories} anchors={anchors} isNew />
    </div>
  );
}
