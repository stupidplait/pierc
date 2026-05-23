"use server";

import { assertAdmin } from "@/lib/admin/auth-helpers";
import { sendTestNotification } from "@/lib/notifications";

export interface NotificationTestState {
  email: { ok: boolean; reason: string };
  telegram: { ok: boolean; reason: string };
}

export type NotificationTestActionState = NotificationTestState | undefined;

export async function runNotificationTest(
  _prev: NotificationTestActionState,
): Promise<NotificationTestActionState> {
  await assertAdmin();
  return await sendTestNotification();
}
