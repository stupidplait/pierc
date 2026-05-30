#!/usr/bin/env tsx
/**
 * Seed a starter set of FAQ questions (ru) for a piercing studio, each tagged
 * with a category so the /faq Instrument Index rail + sections populate
 * immediately. `order` follows the reading sequence (prep → booking).
 *
 * Idempotent: rows use stable ids and are upserted, so re-running updates them
 * in place instead of creating duplicates.
 *
 * Run with:   npm run faq:seed
 * Undo with:  npm run faq:seed -- --remove
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Starter {
  id: string;
  category: string;
  question: string;
  answer: string;
}

// Category keys match FAQ_CATEGORIES in components/faq/faqData.ts.
const ITEMS: Starter[] = [
  {
    id: "seed-faq-prep-1",
    category: "prep",
    question: "Как подготовиться к проколу?",
    answer:
      "Выспитесь и обязательно поешьте за 1–2 часа до визита — это снижает риск головокружения. Не употребляйте алкоголь за сутки до процедуры и не приходите натощак.",
  },
  {
    id: "seed-faq-prep-2",
    category: "prep",
    question: "Есть ли противопоказания?",
    answer:
      "Прокол не делаем при обострении хронических заболеваний, простуде, в ряде случаев при беременности и при нарушениях свёртываемости крови. Если сомневаетесь — напишите нам заранее.",
  },
  {
    id: "seed-faq-prep-3",
    category: "prep",
    question: "С какого возраста можно делать пирсинг?",
    answer:
      "С 14 лет — в присутствии родителя или с его письменного согласия. До 14 лет прокол не выполняем.",
  },
  {
    id: "seed-faq-proc-1",
    category: "procedure",
    question: "Это больно?",
    answer:
      "Сам прокол занимает доли секунды. Большинство описывают ощущение как короткий резкий щипок. Мастер работает быстро и аккуратно, при желании используем местную анестезию.",
  },
  {
    id: "seed-faq-proc-2",
    category: "procedure",
    question: "Вы используете стерильные инструменты?",
    answer:
      "Да. Все иглы одноразовые и вскрываются при вас, украшения и инструменты проходят стерилизацию в автоклаве. Мастер работает в перчатках на обработанной поверхности.",
  },
  {
    id: "seed-faq-proc-3",
    category: "procedure",
    question: "Сколько длится сеанс?",
    answer:
      "Сама процедура — 10–15 минут. Вместе с консультацией, подбором украшения и разметкой закладывайте 30–40 минут.",
  },
  {
    id: "seed-faq-heal-1",
    category: "healing",
    question: "Сколько заживает прокол?",
    answer:
      "Зависит от зоны: мочка уха — 1–2 месяца, хрящ — от 4 до 9 месяцев, пупок — до полугода. Точные сроки мастер назовёт на консультации.",
  },
  {
    id: "seed-faq-heal-2",
    category: "healing",
    question: "Нормально ли, что есть отёк и покраснение?",
    answer:
      "Лёгкий отёк, покраснение и сукровица в первые дни — нормальная реакция. Если появляется сильная боль, гной или повышается температура — свяжитесь с нами.",
  },
  {
    id: "seed-faq-care-1",
    category: "care",
    question: "Как ухаживать за проколом?",
    answer:
      "Промывайте прокол солевым или специальным раствором 1–2 раза в день, не трогайте его грязными руками и не прокручивайте украшение. Полную памятку выдаём после процедуры.",
  },
  {
    id: "seed-faq-care-2",
    category: "care",
    question: "Можно ли купаться и заниматься спортом?",
    answer:
      "Первые 2–3 недели избегайте бассейнов, открытых водоёмов и саун. Лёгкие тренировки разрешены, но берегите зону прокола от трения и ударов.",
  },
  {
    id: "seed-faq-care-3",
    category: "care",
    question: "Когда можно менять украшение?",
    answer:
      "Только после полного заживления и лучше — с помощью мастера. Ранняя смена замедляет заживление и травмирует канал.",
  },
  {
    id: "seed-faq-mat-1",
    category: "materials",
    question: "Из какого металла украшения?",
    answer:
      "Используем имплант-титан (ASTM F-136) — гипоаллергенный и безопасный для первичного прокола. Также есть украшения из золота 585 и 750 пробы.",
  },
  {
    id: "seed-faq-mat-2",
    category: "materials",
    question: "У меня аллергия на металл — что делать?",
    answer:
      "Имплант-титан не содержит никеля и подходит большинству людей с чувствительной кожей. На консультации подберём безопасный для вас вариант.",
  },
  {
    id: "seed-faq-book-1",
    category: "booking",
    question: "Нужна ли предоплата?",
    answer:
      "Нет, предоплата не требуется. Оплата на месте после процедуры — наличными или картой.",
  },
  {
    id: "seed-faq-book-2",
    category: "booking",
    question: "Как записаться и можно ли перенести визит?",
    answer:
      "Записаться можно онлайн на сайте или по телефону. Перенести или отменить визит можно заранее, написав нам — подберём удобное время.",
  },
];

async function main() {
  if (process.argv.includes("--remove")) {
    const res = await prisma.fAQItem.deleteMany({
      where: { id: { in: ITEMS.map((i) => i.id) } },
    });
    console.log(`Удалено стартовых вопросов: ${res.count}`);
    return;
  }

  for (let i = 0; i < ITEMS.length; i += 1) {
    const item = ITEMS[i];
    const fields = {
      question: item.question,
      answer: item.answer,
      category: item.category,
      order: i,
      published: true,
    };
    await prisma.fAQItem.upsert({
      where: { id: item.id },
      update: fields,
      create: { id: item.id, ...fields },
    });
  }

  console.log(`Готово: добавлено/обновлено стартовых вопросов: ${ITEMS.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
