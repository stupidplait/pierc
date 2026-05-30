"use server";

import { signOut } from "@/lib/auth";

// Admin sign-out — lands on the shared login page (/auth/sign-in) rather than
// the marketing home. Safe to pass as a prop into client components (e.g. the
// dashboard's status board), where it runs as a <form action>.
export async function signOutAdminAction(): Promise<void> {
  await signOut({ redirectTo: "/auth/sign-in" });
}
