import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { ServiceItem } from "@/components/admin/content/ServiceItem";
import { AddService } from "@/components/admin/content/AddService";

export const metadata: Metadata = {
  title: ru.admin.content.tabs.services,
};

// Admin page — auth-walled and reads Service rows on every request.
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="flex flex-col gap-3">
      {services.length === 0 ? (
        <p className="text-sm text-mute">{ru.admin.content.services.empty}</p>
      ) : (
        services.map((s, i) => (
          <ServiceItem
            key={s.id}
            delay={Math.min(i, 6) * 0.05}
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
        ))
      )}

      <AddService />
    </section>
  );
}
