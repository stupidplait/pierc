import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — the shadcn class-merge helper. `clsx` resolves conditional class
 * lists, `tailwind-merge` then dedupes conflicting Tailwind utilities so the
 * last one wins (e.g. `cn("px-2", "px-4")` → `"px-4"`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
