import type { Metadata } from "next";
import { seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Header } from "@/components/landing/Header";
import { LandingShell } from "@/components/landing/LandingShell";
import { getCachedPublicUser, getCachedPublicAdmin } from "@/lib/public/queries";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.home.title,
  description: seoStrings.home.description,
  path: "/",
});

export default async function HomePage() {
  // Mirror the (public) layout so the landing's header reflects the signed-in
  // user or admin. This route is outside the (public) group, so it must fetch
  // its own.
  const [user, admin] = await Promise.all([
    getCachedPublicUser(),
    getCachedPublicAdmin(),
  ]);

  return (
    <>
      <Header user={user} admin={admin} />

      <main id="main">
        <LandingShell />
      </main>
    </>
  );
}
