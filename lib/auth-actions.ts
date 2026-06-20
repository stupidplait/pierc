"use server";

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/auth/auth-schema";
import type { AuthFormState } from "@/components/auth/AuthForm";

// ─────────────────────────────────────────────────────────────────────────────
// Shared login — one form for both admins and customers.
//
// The two scopes still live in separate tables (AdminUser vs User) behind two
// NextAuth Credentials providers. NextAuth v5's signIn() THROWS the redirect on
// success, so we must pick the destination *before* calling it: a cheap
// existence lookup against AdminUser decides which provider + redirect to use.
// The real password check still happens inside each provider's authorize().
//
// If the same email exists in BOTH tables, admin wins. Staff use distinct
// emails, so this is acceptable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the shared login flow. `callbackUrl` is the post-login destination for a
 * *customer* (already sanitised by the caller); admins always go to /admin.
 */
export async function runLogin(
  callbackUrl: string,
  formData: FormData,
): Promise<AuthFormState> {
  // Throttle by IP to blunt credential-stuffing and bcrypt-DoS before any work.
  const ip = await clientIp();
  const throttle = await rateLimit(`login:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!throttle.ok) {
    return {
      error: "Слишком много попыток входа. Подождите минуту и попробуйте снова.",
    };
  }

  // Validate email format + password presence up front (shared schema). Any
  // failure collapses into the generic invalid message — we never reveal which
  // field was wrong on the login path.
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: ru.pages.signIn.invalid };
  }
  const { email, password } = parsed.data;

  // Existence-only check (no bcrypt) to route to the right provider.
  const isAdmin = !!(await prisma.adminUser.findUnique({ where: { email } }));

  try {
    if (isAdmin) {
      await signIn("admin-credentials", {
        email,
        password,
        redirectTo: "/admin",
      });
    } else {
      await signIn("user-credentials", {
        email,
        password,
        redirectTo: callbackUrl,
      });
    }
    return undefined;
  } catch (err) {
    // NextAuth always rethrows the framework redirect error; let it through.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      ((err as { digest: string }).digest as string).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: ru.pages.signIn.invalid };
      }
      return { error: ru.pages.signIn.generic };
    }
    throw err;
  }
}
