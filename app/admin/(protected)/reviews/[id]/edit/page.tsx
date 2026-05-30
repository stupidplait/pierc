import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { ReviewForm } from "@/components/admin/ReviewForm";
import { ReviewPhotoUploadForm } from "@/components/admin/ReviewPhotoUploadForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { ReviewStatusBadge } from "@/components/admin/StatusBadges";
import { FeaturedChip, VerifiedChip } from "@/components/admin/reviews/chips";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/ui/card";
import { Button, buttonVariants } from "@/components/shadcn/ui/button";
import { Separator } from "@/components/shadcn/ui/separator";
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
    title: review?.authorName ?? ru.admin.reviews.editTitle,
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
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {review.authorName}
          </h1>
          <p className="mt-3 text-base text-mute">{t.editTitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/admin/reviews">← {t.backToList}</Link>
        </Button>
      </header>

      <div className="flex flex-col gap-6">
        {/* ── Status overview + transition buttons ─────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <ReviewStatusBadge status={review.status} />
              {review.appointment ? <VerifiedChip /> : null}
              {review.featured ? <FeaturedChip /> : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2.5">
            {review.status !== "PUBLISHED" ? (
              <form>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="action" value="approve" />
                <Button type="submit" formAction={transitionReview}>
                  {t.actions.approve}
                </Button>
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
                  className={cn(buttonVariants({ variant: "outline" }))}
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
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  {t.actions.unpublish}
                </ConfirmDeleteButton>
              </form>
            ) : null}
          </CardContent>
        </Card>

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
        <Card>
          <CardHeader>
            <CardTitle>{t.photo.heading}</CardTitle>
            <CardDescription>{t.photo.lead}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {review.photoUrl ? (
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-ink/3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={review.photoUrl}
                    alt={t.photo.heading}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={review.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.photo.viewExternal} ↗
                    </a>
                  </Button>
                  <form>
                    <input type="hidden" name="id" value={review.id} />
                    <ConfirmDeleteButton
                      formAction={removeReviewPhoto}
                      confirmText={t.photo.confirmDelete}
                      className={cn(
                        buttonVariants({ variant: "destructive", size: "sm" }),
                      )}
                    >
                      {t.photo.delete}
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </div>
            ) : (
              <p className="text-sm text-mute">{t.photo.none}</p>
            )}

            <Separator />

            <ReviewPhotoUploadForm
              reviewId={review.id}
              blobConfigured={blobConfigured}
            />
          </CardContent>
        </Card>

        {/* ── Danger zone ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t.sections.danger}</CardTitle>
          </CardHeader>
          <CardContent>
            <form>
              <input type="hidden" name="id" value={review.id} />
              <ConfirmDeleteButton
                formAction={deleteReview}
                confirmText={t.actions.confirmDelete}
                className={cn(buttonVariants({ variant: "destructive" }))}
              >
                {t.actions.delete}
              </ConfirmDeleteButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
