import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Badge (New York), re-themed to Steel Atelier. The `secondary`
 * variant backs the selected-value chips in the multi-select Combobox (stones,
 * anchors).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-bg",
        secondary: "border-ink/12 bg-ink/8 text-ink",
        accent: "border-accent/25 bg-accent/12 text-accent",
        outline: "border-ink/20 text-ink",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
