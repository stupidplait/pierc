import type { ReactNode } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/public/Footer";
import { SmoothScroll } from "@/components/public/SmoothScroll";
import { getCachedPublicUser, getCachedPublicAdmin } from "@/lib/public/queries";
import { ru } from "@/lib/i18n/ru";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, admin] = await Promise.all([
    getCachedPublicUser(),
    getCachedPublicAdmin(),
  ]);

  return (
    <>
      {/* Skip link — first focusable element so keyboard/SR users can jump past
          the fixed header straight to content. Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:border focus-visible:border-line focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-ink focus-visible:shadow-elev focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {ru.common.skipToContent}
      </a>
      {/* Buttery momentum scrolling across the public site (reduced-motion
          aware). The landing lives at the app root, outside this layout, so it
          keeps its own native scroll choreography. */}
      <SmoothScroll />
      <Header user={user} admin={admin} />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </>
  );
}
