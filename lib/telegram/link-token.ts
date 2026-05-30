import { SignJWT, jwtVerify } from "jose";

// Short-lived signed token embedded in the bot deep-link
// (t.me/<bot>?start=<token>). The webhook verifies it on /start and links the
// sender's chat id to this user. Signed with AUTH_SECRET, like review tokens.

const ISSUER = "pierc/tg-link";
const TOKEN_TTL_MIN = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Cannot sign Telegram link tokens.");
  }
  return new TextEncoder().encode(secret);
}

export async function signTelegramLinkToken(
  userId: string,
  ttlMinutes: number = TOKEN_TTL_MIN,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes * 60}s`)
    .sign(getSecret());
}

/** Returns the userId on success, or null if invalid/expired. */
export async function verifyTelegramLinkToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    const sub = payload.sub;
    return typeof sub === "string" && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}
