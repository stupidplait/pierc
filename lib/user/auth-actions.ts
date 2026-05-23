"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";

// ─────────────────────────────────────────────────────────────────────────────
// Sign-up — also handles the guest-upgrade case.
// ─────────────────────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  name: z.string().trim().min(1, ru.pages.signUp.errors.nameRequired),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(ru.pages.signUp.errors.emailInvalid),
  password: z.string().min(8, ru.pages.signUp.errors.passwordTooShort),
});

export type SignUpState = { error?: string } | undefined;

export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? ru.pages.signUp.errors.generic };
  }
  const { name, email, password } = parsed.data;

  // Reject if a real (non-guest) account with this email already exists.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.isGuest) {
    return { error: ru.pages.signUp.errors.emailTaken };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing && existing.isGuest) {
    // ── Guest upgrade ─── preserves all bookings/appointments owned by this
    // User (same row id), just flips the auth shape.
    await prisma.user.update({
      where: { email },
      data: { name, passwordHash, isGuest: false },
    });
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash, isGuest: false },
    });
  }

  // Sign them in immediately. signIn() throws NEXT_REDIRECT on success;
  // let it bubble. Unrecoverable AuthError is unlikely here (we just made
  // the account) but we surface it as a generic message if it happens.
  try {
    await signIn("user-credentials", {
      email,
      password,
      redirectTo: "/account",
    });
  } catch (err) {
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
      return { error: ru.pages.signUp.errors.generic };
    }
    throw err;
  }
  // Unreachable — signIn redirects.
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign-out (public users) — distinct from admin sign-out so the redirect
// target makes sense for either scope.
// ─────────────────────────────────────────────────────────────────────────────

export async function signOutPublicAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
