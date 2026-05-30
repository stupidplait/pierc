import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { JewelryForm } from "@/components/admin/JewelryForm";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import { JewelryModelManager } from "@/components/admin/JewelryModelManager";
import { JewelryScaleAdjuster } from "@/components/admin/JewelryScaleAdjuster";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { CARD, GHOST } from "@/components/admin/form/styles";
import {
  deleteJewelry,
  removeJewelryPhoto,
  setJewelryCoverPhoto,
} from "@/lib/admin/jewelry-actions";
import { asPhotos } from "@/lib/jewelry/format";

interface AdminJewelryEditPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AdminJewelryEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { name: true },
  });
  // Blank name ⟺ a fresh draft from createDraftJewelry; null ⟺ not found.
  const title = jewelry
    ? jewelry.name.trim() || ru.admin.jewelry.newTitle
    : ru.admin.jewelry.editTitle;
  return { title };
}

export default async function AdminJewelryEditPage({
  params,
}: AdminJewelryEditPageProps) {
  const { id } = await params;

  const [jewelry, categories, anchors] = await Promise.all([
    prisma.jewelry.findUnique({
      where: { id },
      include: {
        anchorBindings: {
          select: { anchorId: true, order: true },
          orderBy: { order: "asc" },
        },
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.jewelryCategory.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.anchorPoint.findMany({
      orderBy: [{ place: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, place: true },
    }),
  ]);

  if (!jewelry) notFound();

  const photos = asPhotos(jewelry.photos);
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  const latestJob = jewelry.jobs[0]
    ? {
        id: jewelry.jobs[0].id,
        status: jewelry.jobs[0].status,
        resultGlbUrl: jewelry.jobs[0].resultGlbUrl,
        errorMessage: jewelry.jobs[0].errorMessage,
        createdAt: jewelry.jobs[0].createdAt,
      }
    : null;

  const t = ru.admin.jewelry;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex items-center justify-between gap-4 pt-2 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-5xl">
          {jewelry.name.trim() || t.newTitle}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <form>
            <input type="hidden" name="id" value={jewelry.id} />
            <ConfirmDeleteButton
              formAction={deleteJewelry}
              confirmText={t.confirmDelete}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-ink/15 text-mute transition-colors hover:border-error/50 hover:text-error active:scale-[0.98]"
              ariaLabel={t.delete}
            >
              <Trash2 className="size-5" aria-hidden />
            </ConfirmDeleteButton>
          </form>
          <Link href="/admin/jewelry" className={`${GHOST} gap-2`}>
            <ArrowLeft className="size-4" />
            {t.backToList}
          </Link>
        </div>
      </header>

      <JewelryForm
        categories={categories}
        anchors={anchors}
        initial={{
          id: jewelry.id,
          name: jewelry.name,
          description: jewelry.description,
          categoryId: jewelry.categoryId,
          material: jewelry.material,
          gauge: jewelry.gauge,
          size: jewelry.size,
          color: jewelry.color,
          stones: jewelry.stones,
          price: jewelry.price.toString(),
          inStock: jewelry.inStock,
          status: jewelry.status,
          featured: jewelry.featured,
          type: jewelry.type,
          // For STUD/RING: every binding is a compatibility option (all order=0).
          // For multi-anchor types: ordered endpoints. The form treats both as a
          // multi-select; the seed/server validates the count against the type.
          anchorIds: jewelry.anchorBindings.map((b) => b.anchorId),
        }}
        photosSlot={
          <>
            <div className={`${CARD} flex flex-col gap-5 p-6 sm:p-8`}>
              <div>
                <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                  {t.sections.photos}
                </h2>
                <p className="mt-1 max-w-prose text-sm text-mute">
                  {t.photo.lead}
                </p>
              </div>

              {!blobConfigured ? (
                <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
                  {t.photo.blobNotConfigured}
                </p>
              ) : null}

              <PhotoDropzone jewelryId={jewelry.id} />
            </div>

            {photos.length === 0 ? (
              <p className="text-sm text-mute">{t.photo.empty}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2.5">
                {photos.map((p, i) => (
                  <li
                    key={p.url}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-bg"
                  >
                    <Image
                      src={p.url}
                      alt={p.alt}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                    {/* The first photo is the catalog cover + the 3D auto-gen
                        source. Non-cover photos expose a "make cover" action on
                        hover so the studio can promote any shot to the front. */}
                    {i === 0 ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bg backdrop-blur-sm">
                        {t.photo.cover}
                      </span>
                    ) : (
                      <form className="absolute inset-x-0 bottom-0">
                        <input type="hidden" name="id" value={jewelry.id} />
                        <input type="hidden" name="url" value={p.url} />
                        <button
                          type="submit"
                          formAction={setJewelryCoverPhoto}
                          title={t.photo.setCover}
                          aria-label={
                            p.alt
                              ? `${t.photo.setCover}: ${p.alt}`
                              : t.photo.setCover
                          }
                          className="w-full bg-ink/75 py-1 text-[10px] font-medium uppercase tracking-wide text-bg opacity-0 backdrop-blur-sm transition-opacity hover:bg-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
                        >
                          {t.photo.cover}
                        </button>
                      </form>
                    )}
                    <form className="absolute right-1.5 top-1.5">
                      <input type="hidden" name="id" value={jewelry.id} />
                      <input type="hidden" name="url" value={p.url} />
                      <ConfirmDeleteButton
                        formAction={removeJewelryPhoto}
                        confirmText={t.photo.confirmDelete}
                        ariaLabel={p.alt ? `${t.photo.delete}: ${p.alt}` : t.photo.delete}
                        className="flex size-7 items-center justify-center rounded-full bg-bg/80 text-ink opacity-0 backdrop-blur-sm transition-opacity hover:bg-bg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Trash2 className="size-4" />
                      </ConfirmDeleteButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        modelSlot={
          <>
            <JewelryModelManager
              jewelryId={jewelry.id}
              jewelryType={jewelry.type}
              glbUrl={jewelry.glbUrl}
              hasPhotos={photos.length > 0}
              blobConfigured={blobConfigured}
              latestJob={latestJob}
            />
            <JewelryScaleAdjuster
              jewelryId={jewelry.id}
              currentScale={jewelry.glbScale}
              hasGlb={!!jewelry.glbUrl}
              gauge={jewelry.gauge}
              size={jewelry.size}
            />
          </>
        }
      />
    </div>
  );
}
