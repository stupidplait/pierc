import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { ServiceForm } from "@/components/admin/ServiceForm";

export const metadata: Metadata = {
  title: `${ru.admin.content.tabs.services} — ${ru.admin.panel}`,
};

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-medium text-ink">
          {ru.admin.content.services.title}
        </h2>
        <p className="mt-1 text-sm text-mute">
          {ru.admin.content.services.lead}
        </p>
      </div>

      {services.length === 0 ? (
        <p className="text-mute">{ru.admin.content.services.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {services.map((s) => (
            <ServiceForm
              key={s.id}
              initial={{
                id: s.id,
                name: s.name,
                description: s.description,
                price: s.price.toString(),
                durationMin: s.durationMin,
                order: s.order,
                published: s.published,
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-2">
        <h3 className="mb-3 text-lg font-medium text-ink">
          {ru.admin.content.services.addHeading}
        </h3>
        <ServiceForm isNew />
      </div>
    </section>
  );
}
