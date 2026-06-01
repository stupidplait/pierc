import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { AppHome } from "@/components/public/AppHome";

// App-shell home (Home tab in mobile/). Not part of the public site's IA — the
// browser landing lives at `/` — so keep it out of search indexes to avoid a
// duplicate home.
export const metadata: Metadata = {
  title: ru.studio.name,
  robots: { index: false, follow: false },
};

export default function AppHomePage() {
  return <AppHome />;
}
