import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "./email";
import { sendTelegram, isTelegramConfigured } from "./telegram";
import {
  userConfirmationEmail,
  adminAlertEmail,
  adminTelegramMessage,
  userStatusChangeEmail,
  type BookingNotificationData,
} from "./templates";

export interface BookingNotificationInput {
  /** Booking row ids created in this transaction. */
  bookingIds: string[];
  /** Appointment id, if a slot was booked. */
  appointmentId: string | null;
  /** Owning user — used for the "to" email address. */
  userId: string;
}

/**
 * Send all notifications for a freshly-created booking. Designed to be
 * called inside Next's `after()` callback so it doesn't block the
 * /book/success redirect. Each leg (user email / admin email / telegram)
 * is independent — failure of one doesn't block the others.
 *
 * Returns a per-leg status report. The caller is expected to log it.
 */
export async function sendBookingNotifications(
  input: BookingNotificationInput,
): Promise<{
  userEmail: "sent" | "skipped" | "failed";
  adminEmail: "sent" | "skipped" | "failed";
  adminTelegram: "sent" | "skipped" | "failed";
}> {
  const data = await assembleNotificationData(input);
  if (!data) {
    return {
      userEmail: "skipped",
      adminEmail: "skipped",
      adminTelegram: "skipped",
    };
  }

  // Read studio-level config (admin email, telegram chat id).
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { contactEmail: true, telegramChatId: true },
  });

  const adminPanelUrl = adminUrlFor(input);

  const [userEmail, adminEmail, adminTelegram] = await Promise.all([
    sendUserEmail(data),
    sendAdminEmail(data, settings?.contactEmail ?? null, adminPanelUrl),
    sendAdminTelegram(data, settings?.telegramChatId ?? null, adminPanelUrl),
  ]);

  return { userEmail, adminEmail, adminTelegram };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function adminUrlFor({
  appointmentId,
  bookingIds,
}: BookingNotificationInput): string {
  // Prefer linking to appointment when available; otherwise the first booking.
  // Both routes land in Task 14 (admin dashboards). For now they 404, but
  // the URLs are stable so links don't break once Task 14 ships.
  const base = process.env.APP_URL ?? "";
  if (appointmentId) return `${base}/admin/appointments/${appointmentId}`;
  if (bookingIds[0]) return `${base}/admin/bookings/${bookingIds[0]}`;
  return `${base}/admin`;
}

async function assembleNotificationData(
  input: BookingNotificationInput,
): Promise<BookingNotificationData | null> {
  const [user, bookings, appointment] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true, phone: true },
    }),
    input.bookingIds.length > 0
      ? prisma.jewelryBooking.findMany({
          where: { id: { in: input.bookingIds } },
          include: { jewelry: { select: { name: true, price: true } } },
        })
      : Promise.resolve([]),
    input.appointmentId
      ? prisma.appointment.findUnique({
          where: { id: input.appointmentId },
          include: { slot: true },
        })
      : Promise.resolve(null),
  ]);

  if (!user) return null;

  return {
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
    },
    bookings: bookings.map((b) => ({
      id: b.id,
      jewelryName: b.jewelry.name,
      price: b.jewelry.price.toString(),
    })),
    appointment: appointment
      ? {
          id: appointment.id,
          slotStart: appointment.slot?.startsAt ?? null,
          slotEnd: appointment.slot?.endsAt ?? null,
          notes: appointment.notes,
        }
      : null,
  };
}

async function sendUserEmail(
  data: BookingNotificationData,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";
  const tpl = userConfirmationEmail(data);
  const result = await sendEmail({
    to: data.user.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  return result.ok ? "sent" : "failed";
}

async function sendAdminEmail(
  data: BookingNotificationData,
  adminEmail: string | null,
  adminPanelUrl: string,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";
  if (!adminEmail) return "skipped";
  const tpl = adminAlertEmail(data, adminPanelUrl);
  const result = await sendEmail({
    to: adminEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: data.user.email,
  });
  return result.ok ? "sent" : "failed";
}

async function sendAdminTelegram(
  data: BookingNotificationData,
  chatId: string | null,
  adminPanelUrl: string,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isTelegramConfigured()) return "skipped";
  if (!chatId) return "skipped";
  const result = await sendTelegram({
    chatId,
    text: adminTelegramMessage(data, adminPanelUrl),
  });
  return result.ok ? "sent" : "failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Status-change notification — sent when admin transitions a booking or
// appointment. Email-only; admin Telegram is for *new* bookings (avoids
// noise from every status flip).
// ─────────────────────────────────────────────────────────────────────────────

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export async function sendStatusChangeNotification(args: {
  kind: "booking" | "appointment";
  id: string;
  newStatus: string;
}): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";

  if (args.kind === "booking") {
    const b = await prisma.jewelryBooking.findUnique({
      where: { id: args.id },
      include: {
        user: { select: { name: true, email: true } },
        jewelry: { select: { name: true } },
      },
    });
    if (!b) return "skipped";
    const tpl = userStatusChangeEmail({
      kind: "booking",
      user: { name: b.user.name, email: b.user.email },
      newStatus: args.newStatus as
        | "RESERVED"
        | "CONFIRMED"
        | "FULFILLED"
        | "CANCELLED",
      context: `Украшение: ${b.jewelry.name}`,
    });
    const r = await sendEmail({
      to: b.user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    return r.ok ? "sent" : "failed";
  }

  // appointment
  const a = await prisma.appointment.findUnique({
    where: { id: args.id },
    include: {
      user: { select: { name: true, email: true } },
      slot: true,
    },
  });
  if (!a) return "skipped";
  const slotLine = a.slot
    ? `Время: ${RU_DT.format(a.slot.startsAt)}`
    : null;
  const tpl = userStatusChangeEmail({
    kind: "appointment",
    user: { name: a.user.name, email: a.user.email },
    newStatus: args.newStatus as
      | "PENDING"
      | "CONFIRMED"
      | "COMPLETED"
      | "CANCELLED"
      | "NO_SHOW",
    context: slotLine,
  });
  const r = await sendEmail({
    to: a.user.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  return r.ok ? "sent" : "failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Test ping — used by the "Тестовое уведомление" button in /admin/settings
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTestNotification(): Promise<{
  email: { ok: boolean; reason: string };
  telegram: { ok: boolean; reason: string };
}> {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { contactEmail: true, telegramChatId: true },
  });

  // ── Email ──
  let emailReason = "ok";
  let emailOk = false;
  if (!isEmailConfigured()) {
    emailReason =
      "Resend не настроен. Установите RESEND_API_KEY и RESEND_FROM_EMAIL в .env.";
  } else if (!settings?.contactEmail) {
    emailReason = "Контактный email студии не указан в Настройках.";
  } else {
    const r = await sendEmail({
      to: settings.contactEmail,
      subject: "Тестовое уведомление — Pierc Studio",
      html: `<p>Это тестовое письмо. Resend и адрес студии настроены корректно.</p><p style="color:#666;font-size:12px">${new Date().toISOString()}</p>`,
      text: "Это тестовое письмо. Resend и адрес студии настроены корректно.",
    });
    emailOk = r.ok;
    if (!r.ok) emailReason = r.error ?? r.reason;
    else emailReason = "Письмо отправлено.";
  }

  // ── Telegram ──
  let tgReason = "ok";
  let tgOk = false;
  if (!isTelegramConfigured()) {
    tgReason = "Telegram-бот не настроен. Установите TELEGRAM_BOT_TOKEN в .env.";
  } else if (!settings?.telegramChatId) {
    tgReason = "Chat id не указан в Настройках. Получите его через @BotFather + /getUpdates.";
  } else {
    const r = await sendTelegram({
      chatId: settings.telegramChatId,
      text: "✅ Тестовое уведомление от Pierc Studio. Бот работает.",
    });
    tgOk = r.ok;
    if (!r.ok) tgReason = r.error ?? r.reason;
    else tgReason = "Сообщение отправлено.";
  }

  return {
    email: { ok: emailOk, reason: emailReason },
    telegram: { ok: tgOk, reason: tgReason },
  };
}
