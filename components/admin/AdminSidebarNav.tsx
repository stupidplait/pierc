"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavLinks, ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/shadcn/ui/sidebar";
import { NavIcon } from "./nav-icons";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin rail navigation, on shadcn's `SidebarMenu`. Each route is a
 * `SidebarMenuButton` wrapping a `<Link>` (`asChild`), carrying its per-route
 * glyph ({@link NavIcon}) and label. The active route gets the `bg-ink/10`
 * highlight with the single magenta glyph; collapsed to icons, the label clips
 * away and the button's tooltip surfaces the name. On mobile the rail lives in a
 * Sheet, so a tap both routes and dismisses it.
 */
export function AdminSidebarNav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup className="p-0">
      <SidebarMenu aria-label={ru.admin.panel}>
        {adminNavLinks.map((link) => {
          const active = isActive(link.href, pathname);
          return (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton asChild isActive={active} tooltip={link.label}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-colors duration-150",
                      active
                        ? "text-accent"
                        : "text-mute group-hover/menu-button:text-ink",
                    )}
                  >
                    <NavIcon href={link.href} />
                  </span>
                  <SidebarLabel>{link.label}</SidebarLabel>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
