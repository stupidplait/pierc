import { auth } from "@/lib/auth";

/**
 * Throws if the caller is not a signed-in admin.
 * Use as the first line of every admin server action.
 *
 * Returning a typed session lets callers reference session.user.id without
 * an extra null-check.
 */
export async function assertAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "admin") {
    throw new Error("Unauthorized: admin session required");
  }
  return session as typeof session & {
    user: { id: string; email: string; name: string; role: "admin" };
  };
}
