"use client";

// Root error boundary. Next.js renders it INSIDE the root layout only: an
// error.js is wrapped by *parent* layouts but NOT by its own/sibling segment
// layout, and this file sits above the (public) route group — so it does NOT
// get the public Header/Footer or the admin sidebar. Segment-scoped boundaries
// keep their own chrome (app/admin/(protected)/error.tsx wraps in the sidebar).

import { useEffect } from "react";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { reportClientError } from "@/lib/observability/report-client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { boundary: "root" });
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
