import { SignJWT, jwtVerify } from "jose";

/**
 * Token helpers for the review magic-link flow. See docs/16-reviews.md.
 *
 * Tokens are JWT-signed with `AUTH_SECRET` (same secret NextAuth uses),
 * encode the `appointmentId` in the `sub` claim, and expire after 60
 * days. Once a customer submits a review, the appointment's
 * `reviewedAt` is set and the token becomes single-use (the form
 * server-side checks reviewedAt before accepting submissions).
 */

const ISSUER = "pierc/reviews";
const TOKEN_TTL_DAYS = 60;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Cannot sign or verify review tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Build a signed JWT with the given appointment id as subject. The
 * default expiry is 60 days from now.
 */
export async function signReviewToken(
  appointmentId: string,
  ttlDays: number = TOKEN_TTL_DAYS,
): Promise<string> {
  const ttlSeconds = ttlDays * 24 * 60 * 60;
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(appointmentId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export type ReviewTokenVerification =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "invalid" | "expired" | "missing" };

/**
 * Verify a tokenized review URL. Returns the appointmentId on success,
 * or a tagged failure reason callers can surface to the user.
 */
export async function verifyReviewToken(
  token: string | undefined,
): Promise<ReviewTokenVerification> {
  if (!token) return { ok: false, reason: "missing" };

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
    });
    const sub = payload.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, appointmentId: sub };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "JWTExpired" || err.message.includes("exp"))
    ) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}
