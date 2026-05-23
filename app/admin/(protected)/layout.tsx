import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defense in depth: proxy.ts already redirects unauth visitors,
  // but server components must verify the session themselves before
  // showing or computing anything sensitive.
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-page text-ink">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-card/40 p-5 md:flex">
        <Link
          href="/admin"
          className="font-display text-lg font-medium tracking-tight text-ink"
        >
          {ru.admin.panel}
        </Link>
        <p className="mt-1 truncate text-xs text-mute">{session.user.email}</p>

        <div className="mt-8 flex-1">
          <AdminSidebarNav />
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-page px-6 py-4 md:hidden">
          <Link
            href="/admin"
            className="font-display text-lg font-medium text-ink"
          >
            {ru.admin.panel}
          </Link>
          <SignOutButton />
        </header>

        <main className="flex-1 px-6 py-8 sm:px-10 sm:py-12">{children}</main>
      </div>
    </div>
  );
}
