import type { ReactNode } from "react";

interface CardProps {
  className?: string;
  // Border-radius utility, overridable so callers can match a neighbouring
  // surface vocabulary (e.g. the auth/profile `rounded-xl`). Defaults to the
  // historical `rounded-2xl`.
  radius?: string;
  children: ReactNode;
}

// Surface container with theme-aware background, border, rounding, and padding.
// Use for catalog cards, info panels, callout boxes.
export function Card({ className = "", radius = "rounded-2xl", children }: CardProps) {
  return (
    <div
      className={`${radius} border border-line bg-card p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
