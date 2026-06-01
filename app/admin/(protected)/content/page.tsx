import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { loadContent } from "@/lib/admin/content-view-data";
import { ContentManager } from "@/components/admin/content/ContentManager";

export const metadata: Metadata = {
  title: ru.admin.content.title,
};

// Admin page — auth-walled by the (protected) layout; reads CMS rows per request.
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const data = await loadContent();
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {ru.admin.content.title}
        </h1>
        <p className="mt-3 text-base text-mute">{ru.admin.content.lead}</p>
      </header>

      <ContentManager data={data} blobConfigured={blobConfigured} />
    </div>
  );
}
