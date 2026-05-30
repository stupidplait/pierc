// Telegram bot wrapper. Direct fetch to the Bot API; no SDK.
//
// Setup (one-time, by the studio admin):
//   1. Talk to @BotFather on Telegram, run /newbot, save the token.
//   2. Put the token in .env: TELEGRAM_BOT_TOKEN=...
//   3. Talk to your new bot on Telegram (send /start).
//   4. Find your numeric chat_id by visiting:
//      https://api.telegram.org/bot<TOKEN>/getUpdates
//      Look for the most recent message → result[].message.chat.id
//   5. Save that chat_id under /admin/settings → Telegram chat ID.
//
// Why chat_id is in DB and token is in env:
//   - Token is a deploy-time secret (rotates only when compromised).
//   - chat_id is studio-specific operational config that the admin owns.
//
// In dev / when nothing is configured we silently skip — bookings still
// succeed, just without the alert.

export interface TelegramSendInput {
  chatId: string;
  text: string;
}

export type TelegramSendResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_configured" | "missing_chat_id" | "send_failed";
      error?: string;
    };

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

// Resolve the bot's @username (needed to build t.me deep-links). Prefers an
// explicit TELEGRAM_BOT_USERNAME env; otherwise asks the Bot API once and
// caches the result for the process lifetime.
let cachedBotUsername: string | null | undefined;

export async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername !== undefined) return cachedBotUsername;
  const explicit = process.env.TELEGRAM_BOT_USERNAME;
  if (explicit) {
    cachedBotUsername = explicit.replace(/^@/, "");
    return cachedBotUsername;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    cachedBotUsername = null;
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { result?: { username?: string } };
    cachedBotUsername = data.result?.username ?? null;
  } catch {
    cachedBotUsername = null;
  }
  return cachedBotUsername;
}

export async function sendTelegram(
  input: TelegramSendInput,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(
      "[notifications] Telegram not configured (TELEGRAM_BOT_TOKEN); skipping",
    );
    return { ok: false, reason: "not_configured" };
  }
  if (!input.chatId) {
    console.warn(
      "[notifications] No Telegram chat_id (Settings.telegramChatId); skipping",
    );
    return { ok: false, reason: "missing_chat_id" };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: input.text,
          // Plain text — Telegram's Markdown/MarkdownV2 escaping rules are
          // brittle; we render emoji and line breaks ourselves.
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        "[notifications] Telegram HTTP",
        res.status,
        detail.slice(0, 240),
      );
      return {
        ok: false,
        reason: "send_failed",
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notifications] Telegram exception:", err);
    return {
      ok: false,
      reason: "send_failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
