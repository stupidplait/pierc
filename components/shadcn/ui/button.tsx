import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button (New York), re-themed to Steel Atelier. Scoped to
 * `components/shadcn` so it does not collide with the project's own
 * `components/ui/Button` (different API). Primarily used here as the
 * `outline` Combobox trigger inside the catalog editor.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-bg hover:bg-ink/90",
        outline:
          "border border-ink/15 bg-ink/3 text-ink hover:border-ink/35 data-[placeholder=true]:text-mute/60",
        ghost: "text-mute hover:bg-ink/5 hover:text-ink",
        destructive:
          "border border-error/30 bg-error/10 text-error hover:bg-error/15 hover:border-error/50",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
