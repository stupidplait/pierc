"use client";

// Route-segment error boundary. Caught by Next.js for any RSC/component
// throw inside a public page. Has the public Header/Footer because the
// (public) layout is the parent of this file when the error is in that
// segment; for admin segment errors, Next.js falls back to global-error.

import { useEffect } from "react";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; production hooks (Sentry, etc.) go here later.
    // eslint-disable-next-line no-console
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <Section>
      <PageHeader
        eyebrow={ru.studio.name}
        title={ru.common.error}
        lead="Попробуйте обновить страницу. Если ошибка повторяется — напишите нам."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="text-sm text-mute transition-colors hover:text-primary"
          >
            На главную →
          </Link>
        </div>
      </PageHeader>

      {error.digest ? (
        <p className="text-xs tabular-nums text-mute">
          Код ошибки: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </Section>
  );
}
