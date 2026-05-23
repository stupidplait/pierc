import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  className?: string;
}

// Standard page header used at the top of most public pages.
// Renders an optional eyebrow (small uppercase label), the page title in
// the display font, and an optional lead paragraph.
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`mb-12 sm:mb-16 ${className}`}>
      {eyebrow ? (
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-6xl">
        {title}
      </h1>
      {lead ? (
        <p className="mt-5 max-w-2xl text-lg text-mute text-balance sm:mt-6">
          {lead}
        </p>
      ) : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </header>
  );
}
