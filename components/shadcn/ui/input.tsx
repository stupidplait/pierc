import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Input, re-themed to the Steel Atelier vocabulary (hairline border
 * over a barely-there ink wash, accent focus ring) so it matches the Select /
 * Combobox triggers in the admin form family. Submits as a native form field.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors",
      "placeholder:text-mute/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/30",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
