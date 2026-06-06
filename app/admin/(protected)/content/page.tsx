import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { loadContent } from "@/lib/admin/content-view-data";
import { ContentManager } from "@/components/admin/content/ContentManager";
import { ContentHeader } from "@/components/admin/content/ContentHeader";

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
      <ContentHeader />
      <ContentManager data={data} blobConfigured={blobConfigured} />
    </div>
  );
}
