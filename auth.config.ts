import type { NextAuthConfig } from "next-auth";

// Lean NextAuth configuration shared by proxy.ts and lib/auth.ts.
//
// NOTE (Next 16): proxy.ts (the former `middleware`) runs on the Node.js
// runtime — the Edge runtime is no longer supported there and cannot be
// configured. So this split is no longer required for Edge-safety; it's kept
// only to stay lean (faster cold starts; no bcryptjs/@prisma/client pulled into
// the proxy). The concrete Credentials provider + DB access live in lib/auth.ts.

export const authConfig = {
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/sign-in",
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
      if (path === "/admin" || path.startsWith("/admin/")) {
        if (!isLoggedIn) return false; // -> redirect to pages.signIn (/auth/sign-in)
        return role === "admin";
      }

      // ── Public auth ───────────────────────────────────────────────
      // Already-signed-in visitors are bounced to their own home: admins to
      // the dashboard, customers to their account.
      if (path === "/auth/sign-in" || path === "/auth/sign-up") {
        if (isLoggedIn && role === "admin") {
          return Response.redirect(new URL("/admin", nextUrl));
        }
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
