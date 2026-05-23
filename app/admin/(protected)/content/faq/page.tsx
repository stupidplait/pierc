import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { FaqForm } from "@/components/admin/FaqForm";

export const metadata: Metadata = {
  title: `${ru.admin.content.tabs.faq} — ${ru.admin.panel}`,
};

export default async function AdminFaqPage() {
  const items = await prisma.fAQItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-medium text-ink">
          {ru.admin.content.faq.title}
        </h2>
        <p className="mt-1 text-sm text-mute">{ru.admin.content.faq.lead}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-mute">{ru.admin.content.faq.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((q) => (
            <FaqForm
              key={q.id}
              initial={{
                id: q.id,
                question: q.question,
                answer: q.answer,
                order: q.order,
                published: q.published,
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-2">
        <h3 className="mb-3 text-lg font-medium text-ink">
          {ru.admin.content.faq.addHeading}
        </h3>
        <FaqForm isNew />
      </div>
    </section>
  );
}
