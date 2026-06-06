"use client";

import { useTransition } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { runTelegramTest } from "@/lib/admin/telegram-test-action";
import { ru } from "@/lib/i18n/ru";

const t = ru.admin.settings;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Small link-styled action next to the Telegram chat id label: pings the chat
 * id currently typed into the field (not the last-saved one) and reports the
 * result via toast, so the admin can verify the bot reaches that chat before
 * committing the change.
 *
 * Mirrors the Save button's caption transition — the idle (Send) and pending
 * (spinner) captions cross-fade in place via `AnimatePresence`, and
 * `layout="size"` tweens the box width around them so the state change reads as
 * one smooth motion rather than a swap.
 */
export function TelegramTestLink({ chatId }: { chatId: string }) {
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await runTelegramTest(chatId);
      if (result.ok) toast.success(result.reason);
      else toast.error(result.reason);
    });
  };

  return (
    <m.button
      layout="size"
      type="button"
      onClick={run}
      disabled={pending}
      title="Отправить тестовое сообщение в этот чат"
      transition={{ layout: { duration: 0.3, ease: EASE } }}
      className="relative inline-flex items-center overflow-hidden text-xs font-medium text-accent transition-colors hover:text-accent/80 disabled:opacity-50"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={pending ? "pending" : "idle"}
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: 0.2, ease: EASE }}
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t.testLinkRunning}
            </>
          ) : (
            <>
              <Send className="size-3.5" aria-hidden />
              {t.testLink}
            </>
          )}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}
