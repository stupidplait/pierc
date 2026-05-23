import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed middleware to proxy. Same functionality.
// The actual /admin/* gating logic lives in `authConfig.callbacks.authorized`
// and is consulted by NextAuth's middleware wrapper.

const { auth } = NextAuth(authConfig);

// Named `proxy` export per the Next 16 convention.
export const proxy = auth;
export default proxy;

// Match every /admin path including the bare /admin, plus /admin/login
// (so the authorized callback can redirect already-signed-in admins away
// from the login page). Plus public auth pages and /account.
export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/account",
    "/account/:path*",
    "/auth/sign-in",
    "/auth/sign-up",
  ],
};
