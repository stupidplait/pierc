import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Card (New York), re-themed to the Steel Atelier vocabulary — the
 * elevated panel (rounded-2xl hairline border over `bg-card` with the layered
 * shadow) shared with the admin settings cards and the /account drawer. The base
 * mirrors the `CARD` class string in `components/admin/form/styles.ts`, which
 * Server Components still import directly; this component is for call sites that
 * want the composable header/content/footer parts.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-line bg-card text-ink shadow-elev",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "font-display text-xl font-medium tracking-tight text-ink",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-mute", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

/**
 * Quiet small-caps sub-header used by the admin "dossier" panels (the
 * appointments detail cards). A lighter alternative to `CardTitle` for the
 * stacked label-over-value panels.
 */
const CardEyebrow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-xs font-medium uppercase tracking-[0.2em] text-mute",
      className,
    )}
    {...props}
  />
));
CardEyebrow.displayName = "CardEyebrow";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardEyebrow,
  CardContent,
  CardFooter,
};
