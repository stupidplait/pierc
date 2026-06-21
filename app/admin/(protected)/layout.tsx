import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { ContentBackdrop } from "@/components/backdrop/ContentBackdrop";
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
      <ContentBackdrop />

      <AdminSidebar name={name} email={email} />

      {/* min-w-0: as a flex item in the SidebarProvider row, the content column
          must be allowed to shrink below its content's intrinsic width — without
          it a wide descendant (e.g. a nowrap row) forces the whole page wider
          than the viewport (horizontal overflow at < lg). */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line/70 bg-card/60 px-4 py-3 backdrop-blur-xl sm:px-6 md:hidden">
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

        {/* Single, mobile-first content region — `SidebarInset` is the only
            <main> in the tree (no nested landmark). Padding scales UP from a
            320px-safe base so admin pages never collapse on the narrowest phones. */}
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
