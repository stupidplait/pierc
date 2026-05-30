import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed middleware to proxy. Same functionality.
// The actual /admin/* gating logic lives in `authConfig.callbacks.authorized`
// and is consulted by NextAuth's middleware wrapper.

const { auth } = NextAuth(authConfig);

// Named `proxy` export per the Next 16 convention.
export const proxy = auth;
export default proxy;

// Match every /admin path including the bare /admin. Plus the shared public
// auth pages and /account (so the authorized callback can bounce already-
// signed-in visitors to their own home).
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
