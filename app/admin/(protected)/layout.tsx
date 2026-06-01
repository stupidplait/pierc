import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { BrandMark } from "@/components/ui/BrandMark";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminIdentity } from "@/components/admin/AdminIdentity";

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
    redirect("/auth/sign-in");
  }

  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  return (
    <div className="relative flex min-h-screen text-ink">
      {/* Shared drifting-grid + floating-dot backdrop, fixed behind everything,
          so the admin reads as part of the same Steel Atelier family as the
          public content pages. Content rides above it at z-10. */}
      <AuthBackdrop />

      <AdminSidebar name={name} email={email} />

      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line/70 bg-card/60 px-6 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <AdminMobileNav name={name} email={email} />
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 font-display text-lg font-medium text-ink"
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="truncate">{ru.studio.name}</span>
            </Link>
          </div>
          <AdminIdentity name={name} email={email} />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10 sm:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
