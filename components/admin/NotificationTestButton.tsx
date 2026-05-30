"use client";

import { useActionState } from "react";
import {
  runNotificationTest,
  type NotificationTestActionState,
} from "@/lib/admin/notification-test-action";
import { Button } from "@/components/shadcn/ui/button";
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
    <form action={action} className="flex flex-col gap-4">
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? t.testRunning : t.testButton}
      </Button>

      {state ? (
        <ul className="flex flex-col divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-ink/3">
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
    <li className="flex flex-wrap items-center gap-2.5 px-4 py-3 text-sm">
      <span
        aria-hidden
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          ok ? "bg-success-soft text-success" : "bg-ink/10 text-mute"
        }`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className="font-medium text-ink">{label}</span>
      <span className="text-mute">— {reason}</span>
    </li>
  );
}
