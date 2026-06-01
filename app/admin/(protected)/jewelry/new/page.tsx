import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { JewelryForm, JEWELRY_FORM_ID } from "@/components/admin/JewelryForm";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import { CARD } from "@/components/admin/form/styles";

export const metadata: Metadata = {
  title: ru.admin.jewelry.newTitle,
};

// Lazy-create entry point. Unlike the old "create a blank DRAFT on click" flow,
// this page persists NOTHING until something is saved — with one exception: the
// photo dropzone is live here. Dropping a photo mints a draft and redirects to
// its edit page (see `createDraftAndUploadPhotos`), so the studio can start from
// either attributes or imagery. The 3D tab still needs a persisted id, so it
// shows a placeholder until the draft exists.
export default async function AdminJewelryNewPage() {
  const [categories, anchors] = await Promise.all([
    prisma.jewelryCategory.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.anchorPoint.findMany({
      orderBy: [{ place: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, place: true },
    }),
  ]);

  const t = ru.admin.jewelry;
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {categories.length === 0 ? (
        // The editor can't save without a category (schema requires one), so
        // route the admin to create one instead of showing an unusable form.
        // The title sits inside the form's top section; with no form to render
        // we add a minimal header so the page isn't headless.
        <>
          <header className="mb-10 pt-2 sm:pt-4">
            <h1 className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-5xl">
              {t.newTitle}
            </h1>
          </header>
          <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
            {t.editor.noCategories}
          </p>
        </>
      ) : (
        <JewelryForm
          categories={categories}
          anchors={anchors}
          title={t.newTitle}
          hasPhotos={false}
          hasGlb={false}
          photosSlot={
            <div className={`${CARD} flex flex-col gap-5 p-6 sm:p-8`}>
              <div>
                <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                  {t.sections.photos}
                </h2>
                <p className="mt-1 max-w-prose text-sm text-mute">
                  {t.editor.uploadCreatesDraft}
                </p>
              </div>

              {!blobConfigured ? (
                <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
                  {t.photo.blobNotConfigured}
                </p>
              ) : null}

              {/* No jewelryId yet — the first upload submits the editor form's
                  fields (via formId) so the created piece is populated, not
                  blank, then redirects to its edit page. */}
              <PhotoDropzone photos={[]} formId={JEWELRY_FORM_ID} />
            </div>
          }
          modelSlot={<MediaPlaceholder text={t.editor.modelBeforeDraft} />}
        />
      )}
    </div>
  );
}

/** Stand-in for the 3D panel until the piece has a persisted id. */
function MediaPlaceholder({ text }: { text: string }) {
  return (
    <div className={`${CARD} p-6 sm:p-8`}>
      <p className="max-w-prose text-sm text-mute">{text}</p>
    </div>
  );
}
