import { Resend } from "resend";

// Resend wrapper. Both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` must be set
// for emails to actually send. When either is missing we log a one-line
// warning and skip — bookings still succeed, just without the email.

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

let cachedClient: Resend | null = null;
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedClient;
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL,
  );
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  const from = process.env.RESEND_FROM_EMAIL;

  if (!client || !from) {
    console.warn(
      "[notifications] Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL); skipping email to",
      input.to,
    );
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (res.error) {
      console.error("[notifications] Resend send error:", res.error);
      return {
        ok: false,
        reason: "send_failed",
        error: res.error.message ?? "Unknown error",
      };
    }
    return { ok: true, id: res.data?.id ?? "" };
  } catch (err) {
    console.error("[notifications] Resend exception:", err);
    return {
      ok: false,
      reason: "send_failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
