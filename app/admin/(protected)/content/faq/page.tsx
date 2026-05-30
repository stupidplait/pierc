import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { FaqItem } from "@/components/admin/content/FaqItem";
import { AddFaq } from "@/components/admin/content/AddFaq";

export const metadata: Metadata = {
  title: ru.admin.content.tabs.faq,
};

// Admin page — auth-walled and reads FAQItem rows on every request.
export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const items = await prisma.fAQItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-sm text-mute">{ru.admin.content.faq.empty}</p>
      ) : (
        items.map((q, i) => (
          <FaqItem
            key={q.id}
            delay={Math.min(i, 6) * 0.05}
            initial={{
              id: q.id,
              question: q.question,
              answer: q.answer,
              category: q.category,
              order: q.order,
              published: q.published,
            }}
          />
        ))
      )}

      <AddFaq />
    </section>
  );
}
