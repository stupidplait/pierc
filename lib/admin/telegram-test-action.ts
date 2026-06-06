"use server";

import { assertAdmin } from "@/lib/admin/auth-helpers";
import { sendTelegramTest } from "@/lib/notifications";

/**
 * Ping the supplied Telegram chat id with the configured bot. Used by the
 * inline "Проверить" link next to the Telegram chat id field in /admin/settings,
 * so the admin can verify the chat id they've typed actually receives messages.
 */
export async function runTelegramTest(
  chatId: string,
): Promise<{ ok: boolean; reason: string }> {
  await assertAdmin();
  return await sendTelegramTest(chatId);
}
