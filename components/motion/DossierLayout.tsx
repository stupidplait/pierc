import type { ReactNode } from "react";
import { StickyTocRail, type TocItem } from "@/components/motion/StickyTocRail";

/**
 * The "Instrument Dossier" two-column shell shared by /about and /faq: a narrow
 * sticky table-of-contents rail on the left (lg+ only) driven by `toc`, and a
 * wide content column on the right. StickyTocRail owns the scroll-spy + smooth
 * in-page scroll; this just positions it.
 *
 * No "use client" — it's pure layout composing a client rail leaf, so it renders
 * from both the server tree (AboutContent) and a client tree (FaqContent).
 * Keeping the grid template + sticky offset here means the two dossier pages
 * can't drift apart.
 */
export function DossierLayout({
  toc,
  children,
}: {
  toc: TocItem[];
  children: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <StickyTocRail items={toc} />
        </div>
      </div>
      <div className="space-y-16 sm:space-y-24">{children}</div>
    </div>
  );
}
