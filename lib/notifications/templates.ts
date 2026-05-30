import { formatPrice } from "@/lib/jewelry/format";
import { formatRuPhone } from "@/lib/phone";

export interface BookingNotificationData {
  user: {
    name: string;
    email: string;
    phone: string;
  };
  bookings: Array<{
    id: string;
    jewelryName: string;
    /** Decimal stringified */
    price: string;
  }>;
  appointment: {
    id: string;
    /** Slot start time, or null when jewelry-only. */
    slotStart: Date | null;
    slotEnd: Date | null;
    notes: string | null;
  } | null;
}

const RU_DATETIME = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function totalPrice(data: BookingNotificationData): string {
  const sum = data.bookings.reduce((acc, b) => acc + Number(b.price), 0);
  return formatPrice(sum);
}

function slotLine(data: BookingNotificationData): string {
  if (!data.appointment?.slotStart) return "";
  if (!data.appointment.slotEnd) {
    return RU_DATETIME.format(data.appointment.slotStart);
  }
  // "Понедельник, 12 мая 2026 г., 14:00 — 14:45"
  return `${RU_DATETIME.format(data.appointment.slotStart)} — ${RU_TIME.format(data.appointment.slotEnd)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// User confirmation email — sent right after a successful booking
// ─────────────────────────────────────────────────────────────────────────────

export function userConfirmationEmail(data: BookingNotificationData) {
  const subject = "Заявка получена — Pierc Studio";

  const items =
    data.bookings.length > 0
      ? `<h3 style="margin:0 0 12px;font-family:sans-serif;font-size:16px;color:#1a1a1a">Украшения</h3>
         <ul style="margin:0 0 24px;padding-left:20px;font-family:sans-serif;color:#1a1a1a">
           ${data.bookings
             .map(
               (b) =>
                 `<li style="margin-bottom:6px">${escape(b.jewelryName)} — ${escape(formatPrice(b.price))}</li>`,
             )
             .join("")}
         </ul>`
      : "";

  const slot = data.appointment?.slotStart
    ? `<h3 style="margin:0 0 12px;font-family:sans-serif;font-size:16px;color:#1a1a1a">Время</h3>
       <p style="margin:0 0 24px;font-family:sans-serif;color:#1a1a1a">${escape(slotLine(data))}</p>`
    : "";

  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:32px 16px;background:#f6f6f8;font-family:sans-serif">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:16px">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:24px;color:#1a1a1a">Здравствуйте, ${escape(data.user.name)}!</h1>
      <p style="margin:0 0 24px;color:#5a5a5a">Спасибо за заявку. Мастер свяжется с вами в ближайшее время для подтверждения.</p>
      ${items}
      ${slot}
      <p style="margin:24px 0 0;color:#5a5a5a;font-size:14px">Если что-то нужно изменить — просто ответьте на это письмо.</p>
      <p style="margin:32px 0 0;color:#5a5a5a;font-size:13px">— Pierc Studio</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Здравствуйте, ${data.user.name}!`,
    "",
    "Спасибо за заявку. Мастер свяжется с вами в ближайшее время для подтверждения.",
    "",
    data.bookings.length > 0
      ? `Украшения:\n${data.bookings.map((b) => `  • ${b.jewelryName} — ${formatPrice(b.price)}`).join("\n")}`
      : null,
    data.appointment?.slotStart ? `Время: ${slotLine(data)}` : null,
    "",
    "— Pierc Studio",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin alert email — same data, addressed to the studio
// ─────────────────────────────────────────────────────────────────────────────

export function adminAlertEmail(
  data: BookingNotificationData,
  adminPanelUrl: string,
) {
  const subject = `Новая бронь от ${data.user.name}`;

  const items =
    data.bookings.length > 0
      ? `<h3 style="margin:0 0 12px;font-family:sans-serif;font-size:16px">Украшения</h3>
         <ul style="margin:0 0 16px;padding-left:20px;font-family:sans-serif">
           ${data.bookings
             .map(
               (b) =>
                 `<li>${escape(b.jewelryName)} — ${escape(formatPrice(b.price))}</li>`,
             )
             .join("")}
         </ul>
         <p style="margin:0 0 24px;font-family:sans-serif">Итого: <strong>${escape(totalPrice(data))}</strong></p>`
      : "";

  const slot = data.appointment?.slotStart
    ? `<p style="margin:0 0 16px;font-family:sans-serif"><strong>Время:</strong> ${escape(slotLine(data))}</p>`
    : `<p style="margin:0 0 16px;font-family:sans-serif"><em>Без записи на услугу — только бронь украшений.</em></p>`;

  const notes = data.appointment?.notes
    ? `<p style="margin:0 0 16px;font-family:sans-serif"><strong>Комментарий:</strong> ${escape(data.appointment.notes)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:32px 16px;background:#f6f6f8;font-family:sans-serif">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:16px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Новая бронь</h1>
      <p style="margin:0 0 16px"><strong>${escape(data.user.name)}</strong> · ${escape(data.user.email)} · ${escape(formatRuPhone(data.user.phone))}</p>
      ${slot}
      ${items}
      ${notes}
      <p style="margin:24px 0 0">
        <a href="${escape(adminPanelUrl)}" style="display:inline-block;padding:10px 20px;background:#fe017e;color:#ffffff;text-decoration:none;border-radius:999px">Открыть в админке</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Новая бронь`,
    `${data.user.name} · ${data.user.email} · ${formatRuPhone(data.user.phone)}`,
    data.appointment?.slotStart
      ? `Время: ${slotLine(data)}`
      : "Без записи на услугу.",
    data.bookings.length > 0
      ? `Украшения:\n${data.bookings.map((b) => `  • ${b.jewelryName} — ${formatPrice(b.price)}`).join("\n")}\nИтого: ${totalPrice(data)}`
      : "Без украшений.",
    data.appointment?.notes ? `Комментарий: ${data.appointment.notes}` : null,
    "",
    `Открыть: ${adminPanelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram message — short, plain Markdown (Telegram MarkdownV2 is finicky;
// stick to plain text + line breaks for predictability)
// ─────────────────────────────────────────────────────────────────────────────

export function adminTelegramMessage(
  data: BookingNotificationData,
  adminPanelUrl: string,
): string {
  const lines = [
    "🔔 Новая бронь",
    "",
    `👤 ${data.user.name}`,
    `📧 ${data.user.email}`,
    `📱 ${formatRuPhone(data.user.phone)}`,
  ];

  if (data.appointment?.slotStart) {
    lines.push("", `🕐 ${slotLine(data)}`);
  }

  if (data.bookings.length > 0) {
    lines.push("", "💎 Украшения:");
    for (const b of data.bookings) {
      lines.push(`  • ${b.jewelryName} — ${formatPrice(b.price)}`);
    }
    lines.push(`Итого: ${totalPrice(data)}`);
  }

  if (data.appointment?.notes) {
    lines.push("", `💬 ${data.appointment.notes}`);
  }

  lines.push("", `🔗 ${adminPanelUrl}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Status-change emails — sent when admin transitions a booking/appointment.
// One template, parameterized by status; each status gets its own subject +
// intro line, body reuses the shared booking summary.
// ─────────────────────────────────────────────────────────────────────────────

type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

const BOOKING_STATUS_COPY: Record<BookingStatus, { subject: string; intro: string }> = {
  RESERVED: {
    subject: "Бронь украшения зарегистрирована",
    intro: "Ваша бронь зарегистрирована. Мы свяжемся с вами для подтверждения.",
  },
  CONFIRMED: {
    subject: "Бронь украшения подтверждена",
    intro: "Ваша бронь подтверждена.",
  },
  FULFILLED: {
    subject: "Бронь украшения выполнена",
    intro: "Бронь украшения отмечена как выполненная. Спасибо!",
  },
  CANCELLED: {
    subject: "Бронь украшения отменена",
    intro: "Ваша бронь украшения отменена. Если это ошибка — ответьте на письмо.",
  },
};

const APPT_STATUS_COPY: Record<AppointmentStatus, { subject: string; intro: string }> = {
  PENDING: {
    subject: "Запись принята",
    intro: "Ваша запись принята. Мы свяжемся с вами для подтверждения.",
  },
  CONFIRMED: {
    subject: "Запись подтверждена",
    intro: "Ваша запись подтверждена. До встречи!",
  },
  COMPLETED: {
    subject: "Спасибо, что были у нас",
    intro: "Запись завершена. Мы будем рады видеть вас снова.",
  },
  CANCELLED: {
    subject: "Запись отменена",
    intro: "Ваша запись отменена. Если это ошибка — ответьте на письмо.",
  },
  NO_SHOW: {
    subject: "Вы не пришли на запись",
    intro:
      "Жаль, что не получилось встретиться. Если хотите перенести — ответьте на это письмо.",
  },
};

interface StatusChangeUserData {
  kind: "booking" | "appointment";
  user: { name: string; email: string };
  newStatus: BookingStatus | AppointmentStatus;
  /** Optional context (jewelry name, slot time) shown under the intro. */
  context: string | null;
}

export function userStatusChangeEmail(data: StatusChangeUserData) {
  const copy =
    data.kind === "booking"
      ? BOOKING_STATUS_COPY[data.newStatus as BookingStatus]
      : APPT_STATUS_COPY[data.newStatus as AppointmentStatus];

  const subject = copy.subject;
  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:32px 16px;background:#f6f6f8;font-family:sans-serif">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:16px">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a">Здравствуйте, ${escape(data.user.name)}!</h1>
      <p style="margin:0 0 16px;color:#1a1a1a">${escape(copy.intro)}</p>
      ${
        data.context
          ? `<p style="margin:0 0 24px;color:#5a5a5a">${escape(data.context)}</p>`
          : ""
      }
      <p style="margin:32px 0 0;color:#5a5a5a;font-size:13px">— Pierc Studio</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Здравствуйте, ${data.user.name}!`,
    "",
    copy.intro,
    data.context ? "" : null,
    data.context,
    "",
    "— Pierc Studio",
  ]
    .filter((s) => s !== null)
    .join("\n");

  return { subject, html, text };
}

// Tiny HTML escape for the email bodies. Resend accepts `html` as-is,
// so anything user-provided must be escaped to prevent injection.
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReviewRequestData {
  user: { name: string; email: string };
  /** Absolute URL to /review/[token]. */
  reviewUrl: string;
}

/**
 * Magic-link review request email — sent automatically when an
 * Appointment transitions to COMPLETED. See docs/16-reviews.md.
 */
export function reviewRequestEmail(data: ReviewRequestData) {
  const subject = "Поделитесь впечатлением о визите — Pierc Studio";

  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:32px 16px;background:#f6f6f8;font-family:sans-serif">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:16px">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a">Здравствуйте, ${escape(data.user.name)}!</h1>
      <p style="margin:0 0 16px;color:#1a1a1a">Спасибо, что были у нас. Если есть пара минут — расскажите, как всё прошло. Ваш отзыв увидят будущие гости студии.</p>
      <p style="margin:24px 0">
        <a href="${escape(data.reviewUrl)}" style="display:inline-block;padding:12px 24px;background:#fe017e;color:#ffffff;border-radius:9999px;font-weight:500;text-decoration:none">Оставить отзыв</a>
      </p>
      <p style="margin:24px 0 0;color:#5a5a5a;font-size:13px">Ссылка действительна 60 дней. Отзыв публикуется только после нашей проверки.</p>
      <p style="margin:32px 0 0;color:#5a5a5a;font-size:13px">— Pierc Studio</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Здравствуйте, ${data.user.name}!`,
    "",
    "Спасибо, что были у нас. Если есть пара минут — расскажите, как всё прошло.",
    "Ваш отзыв увидят будущие гости студии.",
    "",
    "Оставить отзыв:",
    data.reviewUrl,
    "",
    "Ссылка действительна 60 дней. Отзыв публикуется только после проверки.",
    "",
    "— Pierc Studio",
  ].join("\n");

  return { subject, html, text };
}
