import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/admin/ReviewForm";

export const metadata: Metadata = {
  title: ru.admin.reviews.newTitle,
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
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {ru.admin.reviews.newTitle}
        </h1>
        <Button
          href="/admin/reviews"
          variant="ghost"
          size="sm"
          radius="rounded-xl"
          className="shrink-0"
        >
          ← {ru.admin.reviews.backToList}
        </Button>
      </header>

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
