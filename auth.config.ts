import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth configuration.
// Imported by both middleware (Edge Runtime) and lib/auth.ts (Node).
// Must NOT import anything that won't run on the Edge Runtime
// (no bcryptjs, no @prisma/client, no Node built-ins).

export const authConfig = {
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  providers: [
    // Concrete providers (with bcrypt, DB access) live in lib/auth.ts.
    // Middleware doesn't need them — it only verifies the JWT cookie.
  ],
  callbacks: {
    // Add `role` to the JWT and session so route protection / UI
    // can branch on admin vs. user without a DB lookup.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const incoming = (user as { role?: string }).role;
        token.role = incoming ?? token.role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    // Authorization rules consulted by Next.js middleware via NextAuth.
    // Returning `true` allows; `false` triggers a redirect to `pages.signIn`;
    // a Response/redirect bypasses default behavior.
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;

      // ── Admin ─────────────────────────────────────────────────────
      // /admin/login is public-but-special: signed-in admins go to dashboard.
      if (path === "/admin/login") {
        if (isLoggedIn && role === "admin") {
          return Response.redirect(new URL("/admin", nextUrl));
        }
        return true;
      }
      if (path === "/admin" || path.startsWith("/admin/")) {
        if (!isLoggedIn) return false; // -> redirect to pages.signIn (admin/login)
        return role === "admin";
      }

      // ── Public auth ───────────────────────────────────────────────
      // Already-signed-in users land on their account when visiting these.
      if (path === "/auth/sign-in" || path === "/auth/sign-up") {
        if (isLoggedIn && role === "user") {
          return Response.redirect(new URL("/account", nextUrl));
        }
        return true;
      }

      // ── /account requires a logged-in (non-admin) user ───────────
      if (path === "/account" || path.startsWith("/account/")) {
        if (!isLoggedIn) {
          const cb = encodeURIComponent(nextUrl.pathname + nextUrl.search);
          return Response.redirect(
            new URL(`/auth/sign-in?callbackUrl=${cb}`, nextUrl),
          );
        }
        return role === "user";
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
