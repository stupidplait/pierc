"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  /** Where to land when there's no in-app history to pop (direct load / refresh). */
  fallbackHref: string;
  label: string;
  className?: string;
}

/**
 * "Back" action that returns the studio to wherever they actually came from —
 * the filtered catalog, a category view, a search result — instead of always
 * dumping them on the bare list.
 *
 * Rendered as a real <Link> to `fallbackHref` so it works without JS and keeps
 * modifier-click (open in new tab) behaviour. A plain left-click with in-app
 * history instead pops the history stack via `router.back()`, restoring the
 * previous page's filters and scroll. Only on a fresh load (no entry to pop)
 * does the link fall through to the fallback.
 */
export function BackButton({ fallbackHref, label, className }: BackButtonProps) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      className={className}
      onClick={(e) => {
        // Leave modifier / non-primary clicks to the browser (new tab/window),
        // and bail if something already handled the event.
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        // history.length > 1 ⟺ there's an entry to pop. Reading it in the
        // handler (never during render) keeps clear of SSR + the strict
        // set-state-in-effect lint.
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
