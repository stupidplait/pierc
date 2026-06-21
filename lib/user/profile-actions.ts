"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCachedPublicUser } from "@/lib/public/queries";
import { ru } from "@/lib/i18n/ru";
import { TELEGRAM_ENABLED } from "@/lib/flags";

export type ProfileState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().trim().min(1, ru.pages.signUp.errors.nameRequired),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(ru.pages.signUp.errors.emailInvalid),
  phone: z.string().trim().max(40).optional(),
  telegram: z.string().trim().max(64).optional(),
});

// Accept "@name", "name", or a full t.me link → store canonically as "@name".
function normalizeTelegram(v: string | undefined): string | null {
  if (!v) return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/t\.me\//i, "").replace(/^@+/, "");
  s = s.split(/[/?]/)[0].trim();
  return s ? `@${s}` : null;
}

export async function updateMyProfile(
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCachedPublicUser();
  if (!user) return { error: "Не авторизованы." };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    telegram: formData.get("telegram") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? ru.pages.signUp.errors.generic };
  }

  const { name, email } = parsed.data;
  const phone =
    parsed.data.phone && parsed.data.phone.length > 0 ? parsed.data.phone : null;

  // Email uniqueness (a different user must not already own it).
  if (email !== user.email) {
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) return { error: ru.pages.signUp.errors.emailTaken };
  }

  // The Telegram @username is locked once the bot is connected — the linked
  // chat is the source of truth, so we don't let the free-text field change it.
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { telegramChatId: true },
  });

  const data: Prisma.UserUpdateInput = { name, email, phone };
  // Only touch the Telegram handle when the feature is on AND the bot isn't the
  // source of truth. With Telegram disabled the edit form omits the field, so
  // writing `normalizeTelegram(undefined)` here would silently null a stored
  // handle on every profile save — guard against that.
  if (TELEGRAM_ENABLED && !current?.telegramChatId) {
    data.telegram = normalizeTelegram(parsed.data.telegram);
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: ru.pages.signUp.errors.emailTaken };
    }
    return { error: ru.pages.signUp.errors.generic };
  }

  revalidatePath("/account");
  return { ok: true };
}

// Unlink the Telegram bot connection (stops auto-notifications). Keeps the
// @username as a plain contact handle; only the chat link is cleared, so the
// user can reconnect later.
export async function disconnectTelegram(): Promise<void> {
  const user = await getCachedPublicUser();
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null },
  });
  revalidatePath("/account");
}

// DEV ONLY — fake the Telegram connection so the connected UI can be previewed
// without the real bot flow. No-ops in production.
export async function devToggleTelegram(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const user = await getCachedPublicUser();
  if (!user) return;
  const cur = await prisma.user.findUnique({
    where: { id: user.id },
    select: { telegramChatId: true },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: cur?.telegramChatId
      ? { telegramChatId: null }
      : { telegramChatId: `dev-${user.id}`, telegram: "@test_user" },
  });
  revalidatePath("/account");
}
