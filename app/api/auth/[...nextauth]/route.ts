// NextAuth route handlers — exposes /api/auth/* endpoints
// (callback, csrf, providers, signin, signout, session).
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
