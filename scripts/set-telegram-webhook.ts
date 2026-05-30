// Registers the Telegram bot webhook so /start deep-links reach the app.
// Run once after deploy (and whenever APP_URL changes):
//   npx tsx -r dotenv/config scripts/set-telegram-webhook.ts
//
// Requires: TELEGRAM_BOT_TOKEN, APP_URL. Optional: TELEGRAM_WEBHOOK_SECRET
// (recommended — Telegram echoes it back in a header the webhook checks).

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.APP_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (!appUrl) throw new Error("APP_URL is not set");

  const url = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret || undefined,
      allowed_updates: ["message"],
    }),
  });
  const data = await res.json();
  console.log("setWebhook →", url);
  console.log(data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
