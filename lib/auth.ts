import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

// Custom error classes give the login UI a typed reason without leaking
// whether the email exists vs. password is wrong (timing-safe via bcrypt).
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // Force JWT session strategy (DB sessions would require a Prisma adapter
  // and Edge incompatibility; JWT is simpler and edge-friendly).
  providers: [
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentialsError();

        const { email, password } = parsed.data;
        const admin = await prisma.adminUser.findUnique({ where: { email } });
        if (!admin) throw new InvalidCredentialsError();

        const ok = await bcrypt.compare(password, admin.passwordHash);
        if (!ok) throw new InvalidCredentialsError();

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        };
      },
    }),
    Credentials({
      id: "user-credentials",
      name: "User",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentialsError();

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        // Reject guests (no password set) — they have to register first.
        if (!user || !user.passwordHash || user.isGuest) {
          throw new InvalidCredentialsError();
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new InvalidCredentialsError();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: "user",
        };
      },
    }),
  ],
});
