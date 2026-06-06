"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { signOutAdminAction } from "@/lib/admin/auth-actions";
import { ExitIcon } from "@/components/admin/dashboard/icons";
import { useSidebar } from "@/components/shadcn/ui/sidebar";
import { useTheme } from "@/lib/theme/theme-provider";

const EASE = [0.16, 1, 0.3, 1] as const;

// Avatar initials from the admin's name, falling back to the email local-part.
function initials(name: string, email: string): string {
  const src = name.trim() || email.split("@")[0] || "";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR =
  "flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-bg";

/**
 * Auth identity in the sidebar footer. Expanded, it's a single row — avatar, the
 * name/email, and the sign-out button inline at the end. Collapsed, the name/email
 * wipes out and the row restructures into a centred column (avatar over sign-out);
 * framer's `layout` morphs the reflow so the sign-out glides from the row's end
 * down beneath the avatar rather than jumping. Always a row on mobile, where the
 * rail can't collapse.
 */
export function AdminIdentity({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const { state, isMobile } = useSidebar();
  const { theme, toggleTheme, ready } = useTheme();
  const collapsed = state === "collapsed" && !isMobile;
  const label = initials(name, email);

  return (
    <motion.div
      layout
      className={cn(
        "flex w-full gap-2.5",
        collapsed ? "flex-col items-center" : "flex-row items-center",
      )}
    >
      <motion.span layout aria-hidden className={AVATAR}>
        {label}
      </motion.span>

      <AnimatePresence initial={false} mode="popLayout">
        {!collapsed && (
          <motion.span
            key="meta"
            layout
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.22, ease: EASE }}
            className="grid min-w-0 flex-1"
          >
            {name ? (
              <span className="truncate text-sm font-medium leading-tight text-ink">
                {name}
              </span>
            ) : null}
            <span className="truncate text-xs leading-tight text-mute">
              {email}
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div layout className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark"
              ? "Переключить на светлую тему"
              : "Переключить на тёмную тему"
          }
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          className="inline-flex size-9 items-center justify-center rounded-lg text-mute outline-none transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.97]"
        >
          {/* Until the persisted choice is read, render the Sun so server +
              first client paint agree (avoids a hydration mismatch). */}
          {ready && theme === "light" ? (
            <Moon className="size-4.5" aria-hidden="true" />
          ) : (
            <Sun className="size-4.5" aria-hidden="true" />
          )}
        </button>
        <form action={signOutAdminAction}>
          <button
            type="submit"
            aria-label={ru.admin.nav.signOut}
            title={ru.admin.nav.signOut}
            className="inline-flex size-9 items-center justify-center rounded-lg text-mute outline-none transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.97]"
          >
            <ExitIcon />
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
