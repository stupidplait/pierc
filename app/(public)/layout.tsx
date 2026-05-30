import type { ReactNode } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/public/Footer";
import { SmoothScroll } from "@/components/public/SmoothScroll";
import { getCachedPublicUser, getCachedPublicAdmin } from "@/lib/public/queries";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, admin] = await Promise.all([
    getCachedPublicUser(),
    getCachedPublicAdmin(),
  ]);

  return (
    <>
      {/* Buttery momentum scrolling across the public site (reduced-motion
          aware). The landing lives at the app root, outside this layout, so it
          keeps its own native scroll choreography. */}
      <SmoothScroll />
      <Header user={user} admin={admin} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
