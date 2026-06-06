import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/shadcn/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

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

  // Read the rail's persisted open/closed choice server-side so it renders in the
  // right state on the first paint (no expand→collapse flash after hydration).
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* Shared drifting-grid + floating-dot backdrop, fixed behind everything
          (z-0), so the admin reads as part of the same Steel Atelier family as
          the public content pages. The rail (z-20) and content (z-10) ride above. */}
      <AuthBackdrop />

      <AdminSidebar name={name} email={email} />

      <SidebarInset>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line/70 bg-card/60 px-6 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 font-display text-lg font-medium text-ink"
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="truncate">{ru.studio.name}</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10 sm:py-12">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
