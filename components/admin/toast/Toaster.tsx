"use client";

import { createPortal } from "react-dom";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Check, X } from "lucide-react";

const ICON_CHIP = "inline-flex size-5 items-center justify-center rounded-full";

export function Toaster(props: ToasterProps) {
  // Portal to <body> so the toaster lives in the ROOT stacking context — a
  // sibling of the Drawer's body portal — instead of being trapped inside the
  // admin layout's `relative z-10` wrapper (which as a whole sits below the
  // drawer's z-50, sinking toasts behind its backdrop blur regardless of their
  // own z-index). Combined with the [data-sonner-toaster] z rule in globals.css.
  if (typeof document === "undefined") return null;
  return createPortal(
    <Sonner
      position="bottom-center"
      offset={96}
      gap={8}
      duration={3600}
      // Above the booking/content Drawer (z-50) so a toast fired while a drawer
      // is open isn't sunk behind its backdrop blur.
      style={{ zIndex: 100 }}
      icons={{
        success: (
          <span className={`${ICON_CHIP} bg-success-soft text-success`}>
            <Check className="size-3.5" />
          </span>
        ),
        error: (
          <span className={`${ICON_CHIP} bg-error-soft text-error`}>
            <X className="size-3.5" />
          </span>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-line bg-card/90 py-2.5 pl-3 pr-3.5 text-sm shadow-elev backdrop-blur-xl",
          title: "font-medium text-ink",
          error: "[&_[data-title]]:text-error",
        },
      }}
      {...props}
    />,
    document.body,
  );
}
