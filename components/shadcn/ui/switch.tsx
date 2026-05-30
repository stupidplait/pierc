"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Switch, re-themed to the Steel Atelier pill switch the admin form
 * kit's old `<Toggle>` used: ink track that warms to accent when on, ink thumb
 * that flips to the page tone. Radix submits a hidden checkbox, so
 * `<Switch name="featured" />` posts `featured=on` when checked — exactly what
 * the jewelry server action's `v === "on"` preprocess expects.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none",
      "bg-ink/15 data-[state=checked]:bg-accent",
      "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-ink shadow-sm transition-transform duration-150",
        "data-[state=checked]:translate-x-5 data-[state=checked]:bg-bg",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
