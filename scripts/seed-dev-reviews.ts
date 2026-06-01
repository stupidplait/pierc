// THROWAWAY dev seeder — populates varied reviews so the four admin review
// views can be visually verified. Remove rows with:
//   npx tsx scripts/seed-dev-reviews.ts --clean
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TAG = "[dev-seed]"; // moderatorNotes marker for easy cleanup

const SEED = [
  { rating: 5, status: "PENDING", featured: false, authorName: "Анна П.",
    text: "Прекрасная работа, очень тонкая огранка и внимание к каждой детали. Мастер выслушал все пожелания и предложил решение лучше, чем я представляла." },
  { rating: 5, status: "PUBLISHED", featured: true, authorName: "Игорь В.",
    text: "Отличный сервис, всё сделали в срок. Рекомендую этот ателье знакомым — атмосфера спокойная, результат превзошёл ожидания.", verified: true },
  { rating: 4, status: "PUBLISHED", featured: false, authorName: "Лена",
    text: "Очень довольна серьгами, спасибо большое!" },
  { rating: 5, status: "PENDING", featured: false, authorName: "Дмитрий К.",
    text: "Заказывал кольцо на годовщину. Сделали идеально, жена в восторге. Отдельное спасибо за упаковку — мелочь, а приятно.", verified: true },
  { rating: 3, status: "REJECTED", featured: false, authorName: "Гость",
    text: "Не очень подошло по размеру, пришлось переделывать. В итоге всё ок, но сроки сдвинулись." },
  { rating: 5, status: "PUBLISHED", featured: true, authorName: "Мария С.",
    text: "Это уже третий мой заказ здесь. Качество стабильно высокое, а главное — честный подход. Спасибо команде за прекрасную работу и терпение к моим бесконечным правкам по эскизу." },
  { rating: 4, status: "PENDING", featured: false, authorName: "Пётр",
    text: "Всё понравилось, вернусь ещё." },
  { rating: 5, status: "PUBLISHED", featured: false, authorName: "Ольга Н.",
    text: "Тонкая ручная работа, видно что с душой. Браслет получился именно таким, как на референсе." },
  { rating: 2, status: "REJECTED", featured: false, authorName: "Аноним",
    text: "Долго ждал ответа на сообщение. Сам результат нормальный." },
] as const;

async function main() {
  if (process.argv.includes("--clean")) {
    const r = await prisma.review.deleteMany({ where: { moderatorNotes: TAG } });
    console.log(`Removed ${r.count} dev-seed reviews.`);
    return;
  }

  const appt = await prisma.appointment.findFirst({ select: { id: true } });
  const jewelry = await prisma.jewelry.findMany({ select: { id: true, name: true }, take: 3 });

  let made = 0;
  for (const [i, s] of SEED.entries()) {
    const linkJewelry =
      i % 3 === 0 && jewelry.length > 0
        ? { connect: jewelry.slice(0, (i % 2) + 1).map((j) => ({ id: j.id })) }
        : undefined;
    await prisma.review.create({
      data: {
        rating: s.rating,
        text: s.text,
        authorName: s.authorName,
        status: s.status as any,
        featured: s.featured,
        moderatorNotes: TAG,
        appointmentId: "verified" in s && s.verified && appt ? appt.id : null,
        jewelryItems: linkJewelry,
        publishedAt: s.status === "PUBLISHED" ? new Date() : null,
      },
    });
    made++;
  }
  console.log(`Created ${made} dev-seed reviews (appt=${appt?.id ?? "none"}, jewelry=${jewelry.length}).`);
}

main().finally(() => prisma.$disconnect());
