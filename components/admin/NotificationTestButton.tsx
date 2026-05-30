"use client";

import { useActionState } from "react";
import {
  runNotificationTest,
  type NotificationTestActionState,
} from "@/lib/admin/notification-test-action";
import { ru } from "@/lib/i18n/ru";

export function NotificationTestButton() {
  const [state, action, pending] = useActionState<
    NotificationTestActionState,
    FormData
  >(async (prev) => {
    return await runNotificationTest(prev);
  }, undefined);

  const t = ru.admin.settings;

  return (
    <form action={action} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-fit items-center justify-center rounded-xl border border-ink-line-strong px-5 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? t.testRunning : t.testButton}
      </button>

      {state ? (
        <ul className="flex flex-col gap-1 text-sm">
          <ResultLine
            label={t.testEmailLabel}
            ok={state.email.ok}
            reason={state.email.reason}
          />
          <ResultLine
            label={t.testTelegramLabel}
            ok={state.telegram.ok}
            reason={state.telegram.reason}
          />
        </ul>
      ) : null}
    </form>
  );
}

function ResultLine({
  label,
  ok,
  reason,
}: {
  label: string;
  ok: boolean;
  reason: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
          ok
            ? "bg-primary/15 text-primary"
            : "bg-mute/20 text-mute"
        }`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className="font-medium text-ink">{label}:</span>
      <span className={ok ? "text-mute" : "text-mute"}>{reason}</span>
    </li>
  );
}
