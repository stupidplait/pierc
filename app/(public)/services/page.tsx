import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: `${ru.pages.services.title} — ${ru.studio.name}`,
};

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <Section>
      <PageHeader
        title={ru.pages.services.title}
        lead={ru.pages.services.lead}
      />

      {services.length === 0 ? (
        <p className="text-mute">{ru.pages.services.stub}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-xl font-medium text-ink">
                    {s.name}
                  </h2>
                  <span className="shrink-0 text-base font-medium text-primary">
                    {priceFormatter.format(Number(s.price))}
                  </span>
                </div>
                {s.description ? (
                  <p className="text-mute">{s.description}</p>
                ) : null}
                <p className="mt-auto text-xs uppercase tracking-[0.2em] text-mute">
                  {s.durationMin} мин
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
