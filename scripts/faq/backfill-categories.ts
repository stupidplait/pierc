#!/usr/bin/env tsx
/**
 * Backfill `FAQItem.category` for rows that don't have one yet, using the
 * keyword classifier (suggestCategoryKey). Only assigns a category when the
 * classifier is confident enough to land on a real bucket — rows that would
 * fall through to "other" are left null so an admin can pick deliberately
 * (the public page still groups them under «Другое» at render time).
 *
 * Idempotent: only touches rows where category IS NULL.
 *
 * Run after `npx prisma db push`, with:  npm run faq:backfill
 */

import { PrismaClient } from "@prisma/client";
import { suggestCategoryKey } from "../../components/faq/faqData";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.fAQItem.findMany({
    where: { category: null },
    select: { id: true, question: true, answer: true },
  });

  if (rows.length === 0) {
    console.log("Нет вопросов без раздела — backfill не требуется.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = suggestCategoryKey(row);
    if (key === "other") {
      skipped += 1;
      continue;
    }
    await prisma.fAQItem.update({
      where: { id: row.id },
      data: { category: key },
    });
    updated += 1;
    console.log(`  ${key.padEnd(10)} ← ${row.question}`);
  }

  console.log(
    `\nГотово: проставлено ${updated}, оставлено без раздела ${skipped} (из ${rows.length}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
