import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { JewelryForm } from "@/components/admin/JewelryForm";
import { JewelryPhotoUploadForm } from "@/components/admin/JewelryPhotoUploadForm";
import { JewelryModelManager } from "@/components/admin/JewelryModelManager";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  deleteJewelry,
  removeJewelryPhoto,
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
  return {
    title: `${jewelry?.name ?? ru.admin.jewelry.editTitle} — ${ru.admin.panel}`,
  };
}

export default async function AdminJewelryEditPage({
  params,
}: AdminJewelryEditPageProps) {
  const { id } = await params;

  const [jewelry, categories, anchors] = await Promise.all([
    prisma.jewelry.findUnique({
      where: { id },
      include: {
        anchors: { select: { id: true } },
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={ru.admin.jewelry.title}
        title={jewelry.name}
        lead={ru.admin.jewelry.editTitle}
      >
        <Button href="/admin/jewelry" variant="ghost" size="sm">
          ← {ru.admin.jewelry.backToList}
        </Button>
      </PageHeader>

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
          glbUrl: jewelry.glbUrl,
          glbThumbUrl: jewelry.glbThumbUrl,
          status: jewelry.status,
          featured: jewelry.featured,
          anchorIds: jewelry.anchors.map((a) => a.id),
        }}
      />

      {/* ── Photos ─────────────────────────────────────────────── */}
      <section className="mt-12 flex flex-col gap-5">
        <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {ru.admin.jewelry.sections.photos}
        </h3>

        <JewelryPhotoUploadForm
          jewelryId={jewelry.id}
          blobConfigured={blobConfigured}
        />

        {photos.length === 0 ? (
          <p className="text-mute">{ru.admin.jewelry.photo.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li
                key={p.url}
                className="flex flex-col gap-2 rounded-2xl border border-line p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-card">
                  <Image
                    src={p.url}
                    alt={p.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <form>
                  <input type="hidden" name="id" value={jewelry.id} />
                  <input type="hidden" name="url" value={p.url} />
                  <ConfirmDeleteButton
                    formAction={removeJewelryPhoto}
                    confirmText={ru.admin.jewelry.photo.confirmDelete}
                  >
                    {ru.admin.jewelry.photo.delete}
                  </ConfirmDeleteButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3D model ───────────────────────────────────────────── */}
      <div className="mt-12">
        <JewelryModelManager
          jewelryId={jewelry.id}
          glbUrl={jewelry.glbUrl}
          hasPhotos={photos.length > 0}
          blobConfigured={blobConfigured}
          latestJob={latestJob}
        />
      </div>

      {/* ── Danger zone ────────────────────────────────────────── */}
      <section className="mt-16 border-t border-line pt-8">
        <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {ru.admin.jewelry.sections.danger}
        </h3>
        <form className="mt-4">
          <input type="hidden" name="id" value={jewelry.id} />
          <ConfirmDeleteButton
            formAction={deleteJewelry}
            confirmText={ru.admin.jewelry.confirmDelete}
          >
            {ru.admin.jewelry.delete}
          </ConfirmDeleteButton>
        </form>
      </section>
    </div>
  );
}
