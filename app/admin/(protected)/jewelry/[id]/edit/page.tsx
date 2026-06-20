import type { Metadata } from "next";
import { cache } from "react";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { JewelryForm } from "@/components/admin/JewelryForm";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import { JewelryModelManager } from "@/components/admin/JewelryModelManager";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
import { deleteJewelry } from "@/lib/admin/jewelry-actions";
import { asPhotos } from "@/lib/jewelry/format";

interface AdminJewelryEditPageProps {
  params: Promise<{ id: string }>;
}

// Dedup the row read across generateMetadata + the page body within one request.
const getJewelry = cache((id: string) =>
  prisma.jewelry.findUnique({
    where: { id },
    include: {
      anchorBindings: {
        select: { anchorId: true, order: true, rotationOffset: true },
        orderBy: { order: "asc" },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  }),
);

export async function generateMetadata({
  params,
}: AdminJewelryEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const jewelry = await getJewelry(id);
  // Blank name ⟺ an abandoned legacy draft (pre-lazy-create); null ⟺ not found.
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
    getJewelry(id),
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

  // Layer 3 ring-orientation tuner data: for a RING, each compatible anchor with
  // its current per-binding rotationOffset (radians → degrees for the UI).
  const R2D = 180 / Math.PI;
  const anchorNameById = new Map(anchors.map((a) => [a.id, a.name]));
  const ringAnchors =
    jewelry.type === "RING"
      ? jewelry.anchorBindings.map((b) => {
          const off = b.rotationOffset as {
            x?: number;
            y?: number;
            z?: number;
          } | null;
          return {
            anchorId: b.anchorId,
            name: anchorNameById.get(b.anchorId) ?? b.anchorId,
            yawDeg: off?.y ? off.y * R2D : 0,
            rollDeg: off?.z ? off.z * R2D : 0,
          };
        })
      : [];

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Title + Back + Delete all live inside the form now (top section +
          command bar), so the page shell is just the form. */}
      <JewelryForm
        categories={categories}
        anchors={anchors}
        title={jewelry.name.trim() || t.newTitle}
        backHref="/admin/jewelry"
        deleteSlot={
          <form>
            <input type="hidden" name="id" value={jewelry.id} />
            <ConfirmDeleteButton
              formAction={deleteJewelry}
              confirmText={t.confirmDelete}
              className={`${GHOST_DELETE} gap-2`}
              ariaLabel={t.delete}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="hidden sm:inline">{ru.admin.common.delete}</span>
            </ConfirmDeleteButton>
          </form>
        }
        hasPhotos={photos.length > 0}
        hasGlb={!!jewelry.glbUrl}
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

            {/* The dropzone owns the whole photo surface now: drop area +
                already-uploaded shots (with cover/delete) + fresh picks. */}
            <PhotoDropzone jewelryId={jewelry.id} photos={photos} />
          </div>
        }
        modelSlot={
          <JewelryModelManager
            jewelryId={jewelry.id}
            jewelryType={jewelry.type}
            glbUrl={jewelry.glbUrl}
            glbScale={jewelry.glbScale}
            hasPhotos={photos.length > 0}
            blobConfigured={blobConfigured}
            latestJob={latestJob}
            ringAnchors={ringAnchors}
          />
        }
      />
    </div>
  );
}
