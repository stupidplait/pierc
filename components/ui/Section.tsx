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
    // `app-section` is a styling hook for app mode (see html[data-app] in
    // globals.css): inside the native shell it collapses the header-reserved top
    // padding and adds bottom safe-area. Inert in a normal browser.
    <Tag
      className={`app-section mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-20 ${className}`}
    >
      {children}
    </Tag>
  );
}
