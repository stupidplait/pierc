import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: `${ru.pages.faq.title} — ${ru.studio.name}`,
};

export default async function FaqPage() {
  const items = await prisma.fAQItem.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <Section>
      <PageHeader title={ru.pages.faq.title} lead={ru.pages.faq.lead} />

      {items.length === 0 ? (
        <p className="text-mute">{ru.pages.faq.stub}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((q) => (
            <li key={q.id}>
              <details className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-ink list-none [&::-webkit-details-marker]:hidden">
                  <span>{q.question}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-mute transition-transform group-open:rotate-45"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 4v12M4 10h12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-mute">{q.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
