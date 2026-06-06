"use client";

import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarLabel,
  useSidebar,
} from "@/components/shadcn/ui/sidebar";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { AdminIdentity } from "./AdminIdentity";
import { ChevronToggle } from "./toggle-icons";

/**
 * Desktop admin rail, on shadcn's `Sidebar` (collapsible to an icon strip). The
 * header carries the logo, the content the nav, the footer the identity. The
 * collapse control is the Notion/Supabase-style rounded-square handle floating on
 * the rail's right divider, so nothing competes for space in the narrow strip.
 * Below `md` the same children render inside the Sidebar's mobile Sheet (opened
 * by the layout's `SidebarTrigger`); the handle is desktop-only.
 */
export function AdminSidebar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <Sidebar collapsible="icon">
        <CollapseHandle />

        <SidebarHeader>
          <Link
            href="/"
            aria-label={ru.studio.name}
            className="flex w-full items-center font-display text-lg font-medium tracking-tight text-ink group-data-[collapsible=icon]:justify-center"
          >
            <BrandMark className="size-6 shrink-0" />
            <SidebarLabel>{ru.studio.name}</SidebarLabel>
          </Link>
        </SidebarHeader>

        <SidebarContent className="mt-4 px-2">
          <AdminSidebarNav />
        </SidebarContent>

        <SidebarFooter className="border-t border-line/70">
          <AdminIdentity name={name} email={email} />
        </SidebarFooter>
      </Sidebar>
    </MotionConfig>
  );
}

/** The floating collapse handle on the rail's right divider (desktop only). */
function CollapseHandle() {
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === "collapsed";
  const label = collapsed ? ru.admin.nav.expand : ru.admin.nav.collapse;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      title={label}
      className="absolute right-0 top-8 z-30 hidden size-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-lg border border-line bg-card text-mute shadow-[0_1px_3px_var(--shadow-1)] transition-colors duration-150 hover:border-ink/40 hover:text-ink active:scale-[0.97] md:inline-flex"
    >
      <ChevronToggle collapsed={collapsed} />
    </button>
  );
}
