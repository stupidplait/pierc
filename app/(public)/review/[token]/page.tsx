import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { reviewsStrings, ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { ReviewSubmitForm } from "@/components/public/ReviewSubmitForm";
import { verifyReviewToken } from "@/lib/reviews/token";

interface ReviewTokenPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: `${reviewsStrings.form.title} — ${ru.studio.name}`,
  // Tokenized, customer-specific URL — never index (robots.txt also disallows it).
  robots: { index: false },
};

export default async function ReviewTokenPage({
  params,
}: ReviewTokenPageProps) {
  const { token } = await params;
  const verification = await verifyReviewToken(token);

  if (!verification.ok) {
    return <ErrorState reason={verification.reason} />;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: verification.appointmentId },
    include: {
      user: { select: { name: true } },
      bookings: {
        include: {
          jewelry: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!appointment) {
    return <ErrorState reason="invalid" />;
  }

  if (appointment.reviewedAt) {
    return <AlreadySubmittedState />;
  }

  const jewelryOptions = appointment.bookings
    .map((b) => b.jewelry)
    .filter((j): j is { id: string; name: string } => !!j);
  const defaultSelectedIds = jewelryOptions.map((j) => j.id);

  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
            {reviewsStrings.form.title}
          </h1>
          <p className="mt-3 max-w-prose text-mute">
            {reviewsStrings.form.lead}
          </p>
        </header>

        <ReviewSubmitForm
          token={token}
          defaultAuthorName={appointment.user.name}
          jewelryOptions={jewelryOptions}
          defaultSelectedIds={defaultSelectedIds}
        />
      </div>
    </Section>
  );
}

function ErrorState({ reason }: { reason: "invalid" | "expired" | "missing" }) {
  const t = reviewsStrings.tokenError;
  const title = reason === "expired" ? t.expiredTitle : t.invalidTitle;
  const body = reason === "expired" ? t.expiredBody : t.invalidBody;
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-mute">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full border border-line px-6 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
        >
          {reviewsStrings.thanks.backToHome}
        </Link>
      </div>
    </Section>
  );
}

function AlreadySubmittedState() {
  const t = reviewsStrings.tokenError;
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
          {t.alreadyTitle}
        </h1>
        <p className="mt-3 text-mute">{t.alreadyBody}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full border border-line px-6 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
        >
          {reviewsStrings.thanks.backToHome}
        </Link>
      </div>
    </Section>
  );
}
