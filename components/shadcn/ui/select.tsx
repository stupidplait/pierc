"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Select (New York), re-themed to the Steel Atelier vocabulary so it
 * reads as part of the same admin form family: hairline trigger over a
 * barely-there ink wash, elevated `bg-card` panel, ink/5 item hover, accent
 * focus ring. The Radix Root accepts `name`/`defaultValue`, so it submits as a
 * native form field without extra hidden inputs.
 *
 * Close animation — why this isn't stock shadcn. Radix's `Select.Content` (v2)
 * unmounts the moment `open` flips false (it returns a detached fragment, with
 * no `Presence`/`forceMount` layer like Popover/Tooltip have), so the CSS
 * `data-[state=closed]` exit classes never get a frame to play — the panel just
 * vanishes. We fix it once, here, for every Select in the app: the `Select`
 * wrapper holds the open state and *defers* the real close, keeping Radix's
 * content mounted while an inner `motion.div` animates out; that panel reports
 * back when its exit finishes and we let Radix close (returning focus to the
 * trigger as usual). Animating the inner panel — not the Popper-positioned
 * Content element — keeps framer's scale transform clear of Popper's translate.
 */

interface SelectMotionContextValue {
  /** True while the panel is animating out (drives the inner panel's variant). */
  closing: boolean;
  /** Called by the panel once its exit animation has finished. */
  finishClose: () => void;
}

const SelectMotionContext =
  React.createContext<SelectMotionContextValue | null>(null);

/**
 * Root wrapper that defers the close so the panel can animate out. Uncontrolled
 * usage (the app-wide case: `defaultValue` + `onValueChange`) flows through the
 * deferral; a consumer that controls `open` itself is passed straight through
 * untouched, so this never fights an external open state.
 */
function Select({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const controlled = open !== undefined;

  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const [closing, setClosing] = React.useState(false);
  // Fallback so a Select can never get stuck open if the panel's
  // onAnimationComplete is missed (e.g. it never mounted a motion node).
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const finishClose = React.useCallback(() => {
    clearCloseTimer();
    setClosing(false);
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [clearCloseTimer, onOpenChange]);

  // Clear any pending fallback timer on unmount.
  React.useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const motionValue = React.useMemo<SelectMotionContextValue>(
    () => ({ closing, finishClose }),
    [closing, finishClose],
  );

  if (controlled) {
    return (
      <SelectPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        {...props}
      >
        {children}
      </SelectPrimitive.Root>
    );
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // (Re)opening — cancel any in-flight close and show immediately.
      clearCloseTimer();
      setClosing(false);
      setInternalOpen(true);
      onOpenChange?.(true);
    } else {
      // Radix wants to close: keep its content mounted (open stays true) so the
      // panel can animate out; `finishClose` flips it shut once that's done.
      setClosing(true);
      clearCloseTimer();
      closeTimer.current = setTimeout(finishClose, 260);
    }
  };

  return (
    <SelectMotionContext.Provider value={motionValue}>
      <SelectPrimitive.Root
        open={internalOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectMotionContext.Provider>
  );
}
Select.displayName = "Select";

const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors",
      "data-[placeholder]:text-mute/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
      "disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      "aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/30",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-mute" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-mute", className)}
    {...props}
  >
    <ChevronUp className="size-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-mute", className)}
    {...props}
  >
    <ChevronDown className="size-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

/** Visual chrome of the dropdown — moved off the Content (Popper-positioned)
 *  element onto an inner panel so framer's scale transform can't collide with
 *  Popper's translate. */
const SELECT_PANEL =
  "flex flex-col max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-card text-ink shadow-elev";

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const ctx = React.useContext(SelectMotionContext);
  const closing = ctx?.closing ?? false;
  const reduce = useReducedMotion();

  return (
    <SelectPrimitive.Portal>
      {/* Content stays the Popper-positioned element (its translate lives on an
          outer wrapper); we keep only z-index + the side nudge here. */}
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          "z-50",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        )}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={
            closing ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }
          }
          transition={{
            duration: reduce ? 0 : closing ? 0.12 : 0.16,
            ease: [0.16, 1, 0.3, 1],
          }}
          onAnimationComplete={() => {
            if (closing) ctx?.finishClose();
          }}
          style={{
            transformOrigin: "var(--radix-select-content-transform-origin)",
          }}
          className={cn(SELECT_PANEL, className)}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              "p-1.5",
              position === "popper" &&
                "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </motion.div>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-mute", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm text-ink outline-none transition-colors",
      "focus:bg-ink/5 data-[state=checked]:bg-ink/5 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute right-2.5 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-accent" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-line", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
