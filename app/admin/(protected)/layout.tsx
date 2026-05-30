import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { signOutAdminAction } from "@/lib/admin/auth-actions";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { BrandMark } from "@/components/ui/BrandMark";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";
import { ExitIcon } from "@/components/admin/dashboard/icons";

// Avatar initials from the admin's name, falling back to the email local-part.
function initials(name: string, email: string): string {
  const src = name.trim() || email.split("@")[0] || "";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Auth state pinned to the bottom of the sidebar — mirrors the public header's
// account chip (avatar + identity) with a plain exit button instead of a
// dropdown. Shared by the desktop rail and the mobile header.
function AdminIdentity({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-bg"
      >
        {initials(name, email)}
      </span>
      <span className="min-w-0 flex-1">
        {name ? (
          <span className="block truncate text-sm font-medium text-ink">
            {name}
          </span>
        ) : null}
        <span className="block truncate text-xs text-mute">{email}</span>
      </span>
      <form action={signOutAdminAction}>
        <button
          type="submit"
          aria-label={ru.admin.nav.signOut}
          title={ru.admin.nav.signOut}
          className="inline-flex size-8 items-center justify-center rounded-lg text-mute transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
        >
          <ExitIcon />
        </button>
      </form>
    </div>
  );
}

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

      <aside className="sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-line/70 bg-card/60 p-5 backdrop-blur-xl md:flex">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 font-display text-lg font-medium tracking-tight text-ink"
        >
          <BrandMark className="size-6" />
          {ru.admin.panel}
        </Link>

        <div className="mt-8 flex-1">
          <AdminSidebarNav />
        </div>

        <div className="mt-6 border-t border-line/70 pt-4">
          <AdminIdentity name={name} email={email} />
        </div>
      </aside>

      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line/70 bg-card/60 px-6 py-3 backdrop-blur-xl md:hidden">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-display text-lg font-medium text-ink"
          >
            <BrandMark className="size-5" />
            {ru.admin.panel}
          </Link>
          <AdminIdentity name={name} email={email} />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10 sm:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
