import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notifications/telegram";
import { verifyTelegramLinkToken } from "@/lib/telegram/link-token";

// Telegram Bot webhook. Handles the account-linking deep-link:
//   user opens t.me/<bot>?start=<token> → Telegram sends us /start <token> →
//   we verify the (signed, short-lived) token, store the sender's chat id on
//   that user, and confirm. After that the user gets booking notifications.
//
// Setup: run `npx tsx -r dotenv/config scripts/set-telegram-webhook.ts` once
// (registers this URL + the secret with Telegram). Auth is the secret header
// Telegram echoes back (X-Telegram-Bot-Api-Secret-Token).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TgUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string };
  };
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = (await request.json().catch(() => null)) as TgUpdate | null;
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;
  const username = update?.message?.from?.username;

  if (text && chatId != null && text.startsWith("/start")) {
    const param = text.slice("/start".length).trim();
    const chat = String(chatId);

    if (!param) {
      await sendTelegram({
        chatId: chat,
        text: "Привет! Откройте «Профиль» на сайте и нажмите «Подключить Telegram», чтобы получать подтверждения записей.",
      });
    } else {
      const userId = await verifyTelegramLinkToken(param);
      if (userId) {
        try {
          await prisma.user.update({
            where: { id: userId },
            // Capture their @username too so /account shows the real handle
            // next to the "connected" marker.
            data: {
              telegramChatId: chat,
              ...(username ? { telegram: `@${username}` } : {}),
            },
          });
          await sendTelegram({
            chatId: chat,
            text: "✅ Telegram подключён. Будем присылать подтверждения и статусы ваших записей.",
          });
        } catch (err) {
          console.error("[tg webhook] link failed:", err);
        }
      } else {
        await sendTelegram({
          chatId: chat,
          text: "Ссылка устарела. Откройте «Профиль» и нажмите «Подключить Telegram» ещё раз.",
        });
      }
    }
  }

  // Telegram expects a prompt 200.
  return NextResponse.json({ ok: true });
}
