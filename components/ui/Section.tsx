import type { ReactNode } from "react";

// Standard outer wrapper for a page block.
// Centers content, applies max width and consistent vertical/horizontal padding.
//
// Use `<Section as="section">` (default) for top-level page blocks,
// `<Section as="div">` to nest one inside another without semantic <section>.

interface SectionProps {
  as?: "section" | "div" | "main" | "article";
  className?: string;
  children: ReactNode;
}

export function Section({
  as: Tag = "section",
  className = "",
  children,
}: SectionProps) {
  return (
    <Tag
      className={`mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-20 ${className}`}
    >
      {children}
    </Tag>
  );
}
