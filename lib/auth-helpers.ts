import { auth } from "@/lib/auth";

export interface PublicSessionUser {
  id: string;
  email: string;
  name: string;
  role: "user";
}

/**
 * Returns the currently signed-in **public** user, or null. Filters out
 * admin sessions — admins use a separate scope and shouldn't appear in
 * /account or pre-filled booking forms.
 *
 * Usage:
 *   const user = await getCurrentPublicUser();
 *   if (!user) redirect("/auth/sign-in");
 */
export async function getCurrentPublicUser(): Promise<PublicSessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role;
  if (role !== "user") return null;
  return {
    id: session.user.id ?? "",
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: "user",
  };
}
