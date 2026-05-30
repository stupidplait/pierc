import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { JewelryForm } from "@/components/admin/JewelryForm";
import { JewelryPhotoUploadForm } from "@/components/admin/JewelryPhotoUploadForm";
import { JewelryModelManager } from "@/components/admin/JewelryModelManager";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
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
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow={t.title} title={jewelry.name} lead={t.editTitle}>
        <Button
          href="/admin/jewelry"
          variant="secondary"
          size="sm"
          radius="rounded-xl"
        >
          ← {t.backToList}
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
          type: jewelry.type,
          // For STUD/RING: every binding is a compatibility option (all order=0).
          // For multi-anchor types: ordered endpoints. The form treats both as a
          // multi-select; the seed/server validates the count against the type.
          anchorIds: jewelry.anchorBindings.map((b) => b.anchorId),
        }}
      />

      {/* ── Photos ─────────────────────────────────────────────── */}
      <section className="mt-12 flex flex-col gap-5">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink">
          {t.sections.photos}
        </h2>

        <JewelryPhotoUploadForm
          jewelryId={jewelry.id}
          blobConfigured={blobConfigured}
        />

        {photos.length === 0 ? (
          <p className="text-sm text-mute">{t.photo.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li
                key={p.url}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-bg">
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
                    confirmText={t.photo.confirmDelete}
                    className={`${GHOST_DELETE} h-9 w-full px-3 text-xs`}
                  >
                    {t.photo.delete}
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
          jewelryType={jewelry.type}
          glbUrl={jewelry.glbUrl}
          hasPhotos={photos.length > 0}
          blobConfigured={blobConfigured}
          latestJob={latestJob}
        />
      </div>

      {/* ── Danger zone ────────────────────────────────────────── */}
      <section className={`${CARD} mt-12 p-6 sm:p-8`}>
        <div className="mb-5">
          <h2 className="font-display text-xl font-medium tracking-tight text-ink">
            {t.sections.danger}
          </h2>
        </div>
        <form>
          <input type="hidden" name="id" value={jewelry.id} />
          <ConfirmDeleteButton
            formAction={deleteJewelry}
            confirmText={t.confirmDelete}
            className={GHOST_DELETE}
          >
            {t.delete}
          </ConfirmDeleteButton>
        </form>
      </section>
    </div>
  );
}
