import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Hairline Separator — the `bg-line/60` rule used across the admin to divide
 * sections (replaces the hand-written `<div className="h-px bg-line/60" />`).
 * Implemented without `@radix-ui/react-separator` to avoid adding a dependency,
 * while keeping the same `orientation` / `decorative` API as the shadcn
 * primitive so it can be swapped 1:1 later if the package is added.
 */
interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-line/60",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
