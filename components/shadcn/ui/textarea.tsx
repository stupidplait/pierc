import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Textarea, re-themed to the Steel Atelier vocabulary so it reads as
 * part of the same admin form family as the Input / Select controls.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors",
      "placeholder:text-mute/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/30",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
