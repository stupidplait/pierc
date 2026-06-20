// Shared authorization for Vercel Cron route handlers.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on every
// scheduled invocation, so production requires the secret to match. The only
// relaxation is local dev convenience: when the secret is *unset* we allow the
// route so a developer can hit it with curl.
//
// IMPORTANT: this fails CLOSED in production. A deploy that forgot to set
// CRON_SECRET previously exposed destructive sweeps (mass draft+blob deletion,
// reservation cancellation) to anonymous callers — now those routes 401 instead.
export function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // No secret configured. Allow only outside production (local dev / curl).
    // In production, refuse so an unconfigured deploy can't be swept by anyone.
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}
