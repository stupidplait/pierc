import type { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

// Surface container with theme-aware background, border, rounding, and padding.
// Use for catalog cards, info panels, callout boxes.
export function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
