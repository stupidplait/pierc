"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface JobAutoRefreshProps {
  /**
   * Poll cadence in ms. The external cron (see docs/21-free-cron.md) is what
   * actually advances the job; this only re-reads the page so the admin sees
   * the new state. ~5s feels live without hammering the server action.
   */
  intervalMs?: number;
}

/**
 * Read-only live-feedback ticker for an in-flight generation job.
 *
 * Mounted only while a job is PROCESSING (see JewelryGenerationActions). It
 * calls `router.refresh()` on a timer, which re-runs the `force-dynamic`
 * edit page's Prisma read on the server and patches the client tree — so the
 * PROCESSING panel flips to "ready" / "failed" on its own, no button, no
 * full reload.
 *
 * Deliberately does NOT mutate anything: the cron owns provider polling and
 * the QUEUED→…→SUCCEEDED transitions, so the tab can't race it into a double
 * rehost. When the job leaves PROCESSING the parent stops rendering this
 * component, which clears the interval via the effect cleanup.
 *
 * Lint note (react-hooks/set-state-in-effect): the effect only schedules a
 * timer and calls router.refresh() — no synchronous setState — so it's clean
 * under the project's strict React Compiler rules. Tab-visibility is read
 * imperatively inside the tick (document.hidden) instead of via effect-driven
 * state, for the same reason.
 */
export function JobAutoRefresh({ intervalMs = 5000 }: JobAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      // Skip work while the tab is backgrounded — no point refreshing a page
      // nobody's looking at, and it avoids piling up requests on wake.
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
