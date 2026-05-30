import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/admin/ReviewForm";
import { ReviewPhotoUploadForm } from "@/components/admin/ReviewPhotoUploadForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { ReviewStatusBadge } from "@/components/admin/StatusBadges";
import { FeaturedChip, VerifiedChip } from "@/components/admin/reviews/chips";
import {
  SURFACE,
  SUCCESS_PILL,
  OUTLINE_PILL,
  DANGER_PILL,
} from "@/components/admin/reviews/ui";
import {
  deleteReview,
  removeReviewPhoto,
  transitionReview,
} from "@/lib/admin/review-actions";

interface AdminReviewEditPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AdminReviewEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const review = await prisma.review.findUnique({
    where: { id },
    select: { authorName: true },
  });
  return {
    title: `${review?.authorName ?? ru.admin.reviews.editTitle} — ${ru.admin.panel}`,
  };
}

export default async function AdminReviewEditPage({
  params,
}: AdminReviewEditPageProps) {
  const { id } = await params;

  const [review, jewelry] = await Promise.all([
    prisma.review.findUnique({
      where: { id },
      include: {
        jewelryItems: { select: { id: true } },
        appointment: { select: { id: true, status: true } },
      },
    }),
    prisma.jewelry.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  if (!review) notFound();

  const t = ru.admin.reviews;
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow={t.title} title={review.authorName} lead={t.editTitle}>
        <Button href="/admin/reviews" variant="ghost" size="sm" radius="rounded-xl">
          ← {t.backToList}
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-6">
        {/* ── Status overview + transition buttons ─────────────── */}
        <section className={`${SURFACE} p-7 sm:p-9`}>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <ReviewStatusBadge status={review.status} />
            {review.appointment ? <VerifiedChip /> : null}
            {review.featured ? <FeaturedChip /> : null}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {review.status !== "PUBLISHED" ? (
              <form>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="action" value="approve" />
                <button
                  type="submit"
                  formAction={transitionReview}
                  className={SUCCESS_PILL}
                >
                  {t.actions.approve}
                </button>
              </form>
            ) : null}
            {review.status !== "REJECTED" ? (
              <form>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="action" value="reject" />
                <ConfirmDeleteButton
                  formAction={transitionReview}
                  confirmText={t.actions.confirmReject}
                  confirmLabel={t.actions.reject}
                  className={OUTLINE_PILL}
                >
                  {t.actions.reject}
                </ConfirmDeleteButton>
              </form>
            ) : null}
            {review.status === "PUBLISHED" ? (
              <form>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="action" value="unpublish" />
                <ConfirmDeleteButton
                  formAction={transitionReview}
                  confirmText={t.actions.confirmUnpublish}
                  confirmLabel={t.actions.unpublish}
                  className={OUTLINE_PILL}
                >
                  {t.actions.unpublish}
                </ConfirmDeleteButton>
              </form>
            ) : null}
          </div>
        </section>

        <ReviewForm
          jewelry={jewelry.map((j) => ({
            id: j.id,
            name: j.name,
            categoryName: j.category.name,
          }))}
          initial={{
            id: review.id,
            rating: review.rating,
            text: review.text,
            authorName: review.authorName,
            appointmentId: review.appointmentId,
            status: review.status,
            featured: review.featured,
            moderatorNotes: review.moderatorNotes,
            jewelryIds: review.jewelryItems.map((j) => j.id),
          }}
        />

        {/* ── Photo ─────────────────────────────────────────────── */}
        <section className={`${SURFACE} p-7 sm:p-9`}>
          <div className="mb-7">
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              {t.photo.heading}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-mute">{t.photo.lead}</p>
          </div>

          {review.photoUrl ? (
            <div className="mb-6 flex flex-wrap items-start gap-4">
              <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-ink/3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={review.photoUrl}
                  alt={t.photo.heading}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={review.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-xl border border-line px-3.5 text-xs font-medium text-ink transition-colors hover:border-ink/30 hover:text-accent"
                >
                  {t.photo.viewExternal} ↗
                </a>
                <form>
                  <input type="hidden" name="id" value={review.id} />
                  <ConfirmDeleteButton
                    formAction={removeReviewPhoto}
                    confirmText={t.photo.confirmDelete}
                    className={`${DANGER_PILL} h-9 px-3.5 text-xs`}
                  >
                    {t.photo.delete}
                  </ConfirmDeleteButton>
                </form>
              </div>
            </div>
          ) : (
            <p className="mb-6 text-sm text-mute">{t.photo.none}</p>
          )}

          <div className="border-t border-line pt-6">
            <ReviewPhotoUploadForm
              reviewId={review.id}
              blobConfigured={blobConfigured}
            />
          </div>
        </section>

        {/* ── Danger zone ──────────────────────────────────────── */}
        <section className={`${SURFACE} p-7 sm:p-9`}>
          <div className="mb-5">
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              {t.sections.danger}
            </h2>
          </div>
          <form>
            <input type="hidden" name="id" value={review.id} />
            <ConfirmDeleteButton
              formAction={deleteReview}
              confirmText={t.actions.confirmDelete}
              className={DANGER_PILL}
            >
              {t.actions.delete}
            </ConfirmDeleteButton>
          </form>
        </section>
      </div>
    </div>
  );
}
