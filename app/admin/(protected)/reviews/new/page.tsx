import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/admin/ReviewForm";

export const metadata: Metadata = {
  title: `${ru.admin.reviews.newTitle} — ${ru.admin.panel}`,
};

export default async function AdminReviewNewPage() {
  const jewelry = await prisma.jewelry.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      category: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={ru.admin.reviews.title}
        title={ru.admin.reviews.newTitle}
      >
        <Button href="/admin/reviews" variant="ghost" size="sm" radius="rounded-xl">
          ← {ru.admin.reviews.backToList}
        </Button>
      </PageHeader>

      <ReviewForm
        isNew
        jewelry={jewelry.map((j) => ({
          id: j.id,
          name: j.name,
          categoryName: j.category.name,
        }))}
      />
    </div>
  );
}
