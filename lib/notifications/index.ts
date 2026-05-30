import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "./email";
import { sendTelegram, isTelegramConfigured } from "./telegram";
import {
  userConfirmationEmail,
  adminAlertEmail,
  adminTelegramMessage,
  userStatusChangeEmail,
  reviewRequestEmail,
  type BookingNotificationData,
} from "./templates";
import { signReviewToken } from "@/lib/reviews/token";
import { ru } from "@/lib/i18n/ru";

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
  userTelegram: "sent" | "skipped" | "failed";
  adminEmail: "sent" | "skipped" | "failed";
  adminTelegram: "sent" | "skipped" | "failed";
}> {
  const data = await assembleNotificationData(input);
  if (!data) {
    return {
      userEmail: "skipped",
      userTelegram: "skipped",
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

  const [userEmail, userTelegram, adminEmail, adminTelegram] =
    await Promise.all([
      sendUserEmail(data),
      sendUserTelegram(input.userId, data),
      sendAdminEmail(data, settings?.contactEmail ?? null, adminPanelUrl),
      sendAdminTelegram(data, settings?.telegramChatId ?? null, adminPanelUrl),
    ]);

  return { userEmail, userTelegram, adminEmail, adminTelegram };
}

// Confirmation to the customer's own Telegram, if they've linked it.
async function sendUserTelegram(
  userId: string,
  data: BookingNotificationData,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isTelegramConfigured()) return "skipped";
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  if (!u?.telegramChatId) return "skipped";

  const lines: string[] = ["✅ Заявка принята."];
  if (data.appointment?.slotStart) {
    lines.push(`Время: ${RU_DT.format(data.appointment.slotStart)}`);
  }
  if (data.bookings.length > 0) {
    lines.push(`Украшения: ${data.bookings.map((b) => b.jewelryName).join(", ")}`);
  }
  lines.push("Мастер свяжется для подтверждения.");

  const r = await sendTelegram({ chatId: u.telegramChatId, text: lines.join("\n") });
  return r.ok ? "sent" : "failed";
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
  if (args.kind === "booking") {
    const b = await prisma.jewelryBooking.findUnique({
      where: { id: args.id },
      include: {
        user: { select: { name: true, email: true, telegramChatId: true } },
        jewelry: { select: { name: true } },
      },
    });
    if (!b) return "skipped";

    if (isTelegramConfigured() && b.user.telegramChatId) {
      const label =
        ru.admin.statusLabels.booking[
          args.newStatus as keyof typeof ru.admin.statusLabels.booking
        ] ?? args.newStatus;
      await sendTelegram({
        chatId: b.user.telegramChatId,
        text: `Статус брони «${b.jewelry.name}»: ${label}`,
      });
    }

    if (!isEmailConfigured()) return "skipped";
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
      user: { select: { name: true, email: true, telegramChatId: true } },
      slot: true,
    },
  });
  if (!a) return "skipped";

  if (isTelegramConfigured() && a.user.telegramChatId) {
    const label =
      ru.admin.statusLabels.appointment[
        args.newStatus as keyof typeof ru.admin.statusLabels.appointment
      ] ?? args.newStatus;
    await sendTelegram({
      chatId: a.user.telegramChatId,
      text: `Статус записи: ${label}`,
    });
  }

  if (!isEmailConfigured()) return "skipped";
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
// Admin alert when a customer cancels their own reservation from /account.
// Fired after the cancellation commits (the entity is already CANCELLED).
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyAdminOfCancellation(args: {
  kind: "appointment" | "booking";
  id: string;
}): Promise<"sent" | "skipped" | "failed"> {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { contactEmail: true, telegramChatId: true },
  });

  let who = "";
  let what = "";
  if (args.kind === "appointment") {
    const a = await prisma.appointment.findUnique({
      where: { id: args.id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!a) return "skipped";
    who = `${a.user.name} (${a.user.email})`;
    what = "запись на услугу";
  } else {
    const b = await prisma.jewelryBooking.findUnique({
      where: { id: args.id },
      include: {
        user: { select: { name: true, email: true } },
        jewelry: { select: { name: true } },
      },
    });
    if (!b) return "skipped";
    who = `${b.user.name} (${b.user.email})`;
    what = `бронь украшения «${b.jewelry.name}»`;
  }

  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const url =
    args.kind === "appointment"
      ? `${base}/admin/appointments/${args.id}`
      : `${base}/admin/bookings/${args.id}`;
  const text = `❌ Клиент отменил ${what}. ${who}`;

  const results: Array<"sent" | "failed"> = [];

  if (isTelegramConfigured() && settings?.telegramChatId) {
    const r = await sendTelegram({
      chatId: settings.telegramChatId,
      text: `${text}\n${url}`,
    });
    results.push(r.ok ? "sent" : "failed");
  }
  if (isEmailConfigured() && settings?.contactEmail) {
    const r = await sendEmail({
      to: settings.contactEmail,
      subject: `Отмена — ${what}`,
      html: `<p>${text}</p><p><a href="${url}">${url}</a></p>`,
      text: `${text} ${url}`,
    });
    results.push(r.ok ? "sent" : "failed");
  }

  if (results.length === 0) return "skipped";
  return results.includes("sent") ? "sent" : "failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Review-request email (magic-link flow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send the "оставьте отзыв" email after an Appointment is COMPLETED.
 * Generates a fresh review token (60-day expiry by default) and embeds
 * the absolute URL in the email body.
 *
 * Returns "skipped" if email isn't configured or the appointment can't
 * be found / has already been reviewed. See docs/16-reviews.md.
 */
export async function sendReviewRequestEmail(args: {
  appointmentId: string;
}): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";

  const appointment = await prisma.appointment.findUnique({
    where: { id: args.appointmentId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!appointment) return "skipped";
  if (appointment.reviewedAt) return "skipped";
  if (!appointment.user.email) return "skipped";

  const token = await signReviewToken(appointment.id);
  const baseUrl = process.env.APP_URL ?? "";
  const reviewUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/review/${token}`
    : `/review/${token}`;

  const tpl = reviewRequestEmail({
    user: { name: appointment.user.name, email: appointment.user.email },
    reviewUrl,
  });

  const r = await sendEmail({
    to: appointment.user.email,
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
      subject: "Тестовое уведомление — PIERCERKZN",
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
      text: "✅ Тестовое уведомление от PIERCERKZN. Бот работает.",
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
