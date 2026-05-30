import { PrismaClient } from "@prisma/client";

// Idempotent: seeds a default set of piercing services only when the Service
// table is empty (Service has no natural unique key to upsert on). Safe to
// re-run — once any service exists it does nothing, so admin edits are kept.
//
// Run with:  npx tsx -r dotenv/config scripts/seed-services.ts

const prisma = new PrismaClient();

const SERVICES = [
  { name: "Прокол мочки уха", durationMin: 30, price: 2000, description: "Классический прокол мочки. Цена за одну мочку." },
  { name: "Прокол хеликса", durationMin: 40, price: 2800, description: "Прокол хряща уха (хеликс)." },
  { name: "Прокол носа (ноздря)", durationMin: 30, price: 2500, description: "Прокол крыла носа." },
  { name: "Прокол септума", durationMin: 40, price: 3200, description: "Прокол носовой перегородки." },
  { name: "Прокол брови", durationMin: 30, price: 2800, description: "Вертикальный или горизонтальный прокол брови." },
  { name: "Прокол губы (лабрет)", durationMin: 40, price: 2800, description: "Прокол губы — лабрет, медуза и др." },
  { name: "Прокол пупка", durationMin: 40, price: 3000, description: "Прокол пупка." },
  { name: "Консультация", durationMin: 20, price: 0, description: "Подбор места, украшения и ухода — без прокола." },
];

async function main() {
  const count = await prisma.service.count();
  if (count > 0) {
    console.log(`Services already present (${count}) — skipping.`);
    return;
  }
  for (let i = 0; i < SERVICES.length; i++) {
    const s = SERVICES[i];
    await prisma.service.create({
      data: {
        name: s.name,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
        order: i,
        published: true,
      },
    });
  }
  console.log(`✓ Created ${SERVICES.length} services.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
