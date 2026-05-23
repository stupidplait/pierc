"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "./auth-helpers";

export type StockAdjustState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

const schema = z.object({
  id: z.string().min(1),
  delta: z.coerce.number().int().refine((v) => v === 1 || v === -1, {
    message: "Delta must be ±1",
  }),
});

export async function adjustJewelryStock(
  _prev: StockAdjustState,
  formData: FormData,
): Promise<StockAdjustState> {
  await assertAdmin();
  const parsed = schema.safeParse({
    id: formData.get("id"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) return { ok: false, error: "Ошибка" };

  const { id, delta } = parsed.data;

  if (delta < 0) {
    // Don't go below zero.
    const updated = await prisma.jewelry.updateMany({
      where: { id, inStock: { gt: 0 } },
      data: { inStock: { decrement: 1 } },
    });
    if (updated.count === 0) {
      return { ok: false, error: "Остаток уже 0" };
    }
  } else {
    await prisma.jewelry.update({
      where: { id },
      data: { inStock: { increment: 1 } },
    });
  }

  revalidatePath("/admin/jewelry");
  revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${id}`);
  revalidatePath("/admin"); // low-stock card

  return { ok: true };
}
