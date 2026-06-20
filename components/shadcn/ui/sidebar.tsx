"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shadcn/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";

/**
 * shadcn/ui Sidebar composite, hand-authored and re-themed to the Steel Atelier
 * vocabulary (translucent `bg-card/60 backdrop-blur-xl` rail over the shared
 * ContentBackdrop, hairline `border-line/70` divider, `bg-ink/10` active row, magenta
 * is left to the per-route glyph). It deliberately does NOT introduce the stock
 * `--sidebar-*` design tokens — those collide with the project's Steel Atelier
 * token names — so the surfaces are styled with the existing project classes.
 *
 * What we keep from upstream shadcn: the CSS-driven icon-collapse, the mobile
 * `Sheet` presentation, collapsed-icon tooltips, the ⌘/Ctrl-B shortcut, and the
 * `sidebar_state` cookie so the rail's open/closed choice survives reloads with
 * no hydration flash (the layout reads the cookie server-side for `defaultOpen`).
 *
 * What we change: `useIsMobile` is implemented with `useSyncExternalStore` (not
 * `useEffect` + `setState`) to satisfy the project's `react-hooks` lint rules.
 */

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "5rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const MOBILE_BREAKPOINT = 768;

// ── useIsMobile (lint-safe: no set-state-in-effect) ──────────────────────────
function mobileQuery(): MediaQueryList {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

function subscribeMobile(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = mobileQuery();
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return mobileQuery().matches;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );
}

// ── Context ──────────────────────────────────────────────────────────────────
type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // Internal open state; `open` prop (if passed) makes this controlled.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;

    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }
        // Persist the preference (written in the callback, not an effect).
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open],
    );

    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((o) => !o) : setOpen((o) => !o);
    }, [isMobile, setOpen]);

    // ⌘/Ctrl-B toggles the rail. Only attaches a listener — no state in the effect.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? "expanded" : "collapsed";

    const contextValue = React.useMemo<SidebarContextValue>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, toggleSidebar],
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            ref={ref}
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full text-ink",
              className,
            )}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (collapsible === "none") {
      return (
        <div
          ref={ref}
          className={cn(
            "flex h-full w-(--sidebar-width) flex-col bg-card text-ink",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            side={side}
            className="w-(--sidebar-width) gap-0 border-line/70 bg-card/95 p-0 backdrop-blur-xl [&>button]:top-5"
            style={
              { "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties
            }
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{ru.admin.panel}</SheetTitle>
              <SheetDescription>{ru.admin.panel}</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <div
        ref={ref}
        className="group peer hidden text-ink md:block"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
      >
        {/* In-flow spacer: this is what actually reserves the rail's width in the
            layout; the visible rail below is `fixed` and overlays it. */}
        <div
          className={cn(
            "relative h-svh w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          )}
        />
        <div
          className={cn(
            "fixed inset-y-0 z-20 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
            side === "left" ? "border-r border-line/70" : "border-l border-line/70",
            className,
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="relative flex h-full w-full flex-col bg-card/60 backdrop-blur-xl"
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ru.admin.nav.expand}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      className={cn(
        "-ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-mute outline-none transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.97]",
        className,
      )}
      {...props}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M2.75 5h12.5M2.75 9h12.5M2.75 13h12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{ru.admin.panel}</span>
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ru.admin.nav.collapse}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={ru.admin.nav.collapse}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-colors ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-px hover:after:bg-line group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        className,
      )}
      {...props}
    />
  );
});
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn(
      "relative z-10 flex min-h-svh flex-1 flex-col bg-transparent",
      className,
    )}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="header"
    className={cn("flex flex-col gap-2 p-4", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="footer"
    className={cn("flex flex-col gap-2 p-3", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="content"
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-2 overflow-auto overscroll-contain group-data-[collapsible=icon]:overflow-hidden",
      className,
    )}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group"
    className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

/**
 * Animated text label for a rail button / the header wordmark — wipes open and
 * shut in step with the collapse via a CSS-grid `1fr↔0fr` column. The track
 * shrink-wraps to the text, so the easing maps to the *visible* width and the
 * label neither hangs nor snaps the way a `max-width` tween does; the inner
 * `min-w-0 overflow-hidden` lets the track reach a true zero. framer drives the
 * fr interpolation (smooth cross-browser) and the icon↔label gap (animated
 * `marginLeft`) so the button stays padding-stable and the glyph glides to the
 * rail centre via `justify-center`. Obeys the rail's `MotionConfig
 * reducedMotion`; on mobile (always expanded) it stays open.
 */
function SidebarLabel({ children }: { children: React.ReactNode }) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  return (
    <motion.span
      initial={false}
      animate={{
        gridTemplateColumns: collapsed ? "0fr" : "1fr",
        opacity: collapsed ? 0 : 1,
        marginLeft: collapsed ? 0 : 10,
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="grid min-w-0"
    >
      <span className="min-w-0 overflow-hidden whitespace-nowrap">{children}</span>
    </motion.span>
  );
}

const sidebarMenuButtonVariants = cva(
  "group/menu-button peer/menu-button flex w-full items-center overflow-hidden rounded-lg px-3 text-left text-sm font-medium text-mute outline-none ring-accent/30 transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-ink/10 data-[active=true]:text-ink group-data-[collapsible=icon]:justify-center [&>svg]:size-[18px] [&>svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-10",
        sm: "h-9 text-xs",
        lg: "h-12",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    { asChild = false, isActive = false, size = "default", tooltip, className, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const { isMobile, state } = useSidebar();

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ size }), className)}
        {...props}
      />
    );

    if (!tooltip) return button;

    const tooltipProps =
      typeof tooltip === "string" ? { children: tooltip } : tooltip;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltipProps}
        />
      </Tooltip>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
};
