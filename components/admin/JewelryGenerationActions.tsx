"use client";

import { useActionState, useState } from "react";
import { Download, Check, X } from "lucide-react";
import {
  startJewelryGeneration,
  approveJewelryJob,
  rejectJewelryJob,
  type ActionState,
} from "@/lib/admin/jewelry-generation-actions";
import { ru } from "@/lib/i18n/ru";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlbPreview, type GlbStats } from "@/components/admin/GlbPreview";
import { GlbInspector } from "@/components/admin/GlbInspector";
import { ScaleField } from "@/components/admin/ScaleField";
import { JobAutoRefresh } from "@/components/admin/JobAutoRefresh";
import { GHOST, GHOST_DELETE } from "@/components/admin/form/styles";
import { candidateGlbSrc, adminGlbSrc } from "@/lib/jewelry/glb-proxy";

interface JewelryGenerationActionsProps {
  jewelryId: string;
  /** The most recent generation job for this jewelry (null when none exists). */
  latestJob: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
    resultGlbUrl: string | null;
    errorMessage: string | null;
    createdAt: Date;
  } | null;
  /** The currently published model URL, if any — used to tell an unapproved
   *  candidate apart from an already-approved job (whose result == glbUrl). */
  currentGlbUrl: string | null;
  /** Per-piece render scale (Jewelry.glbScale) — shown + edited in the
   *  candidate-review preview, same as the published-model inspector. */
  glbScale: number;
  /** Whether any auto-generation provider is configured. */
  autoAvailable: boolean;
  /** When true, real API calls are stubbed out — clicks are free. */
  dryRun: boolean;
  /** Whether the jewelry has at least one photo (auto-gen requires it). */
  hasPhotos: boolean;
}

export function JewelryGenerationActions({
  jewelryId,
  latestJob,
  currentGlbUrl,
  glbScale,
  autoAvailable,
  dryRun,
  hasPhotos,
}: JewelryGenerationActionsProps) {
  const t = ru.admin.jewelry.model;

  const [startState, startAction, startPending] = useActionState<
    ActionState,
    FormData
  >(startJewelryGeneration, undefined);

  const [approveState, approveAction, approvePending] = useActionState<
    ActionState,
    FormData
  >(approveJewelryJob, undefined);

  const [rejectState, rejectAction, rejectPending] = useActionState<
    ActionState,
    FormData
  >(rejectJewelryJob, undefined);

  const [rejectOpen, setRejectOpen] = useState(false);

  if (!autoAvailable) {
    return (
      <p className="rounded-xl border border-line bg-ink/3 px-4 py-3 text-sm text-mute">
        {t.autoUnavailable}
      </p>
    );
  }

  const dryRunBanner = dryRun ? (
    <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
      {t.autoDryRun}
    </p>
  ) : null;

  // ── Active in-flight job: show "processing" badge + live auto-refresh. ──
  // The external cron (docs/21-free-cron.md) advances the job server-side and
  // JobAutoRefresh re-reads this page on a timer, so the panel flips to
  // "ready"/"failed" on its own — no manual "refresh status" button.
  if (latestJob && latestJob.status === "PROCESSING") {
    return (
      <div className="flex flex-col gap-3">
        {dryRunBanner}
        <JobAutoRefresh />
        <Badge tone="info">{t.autoStatusProcessing}</Badge>
        <p className="text-xs text-mute">{t.autoLiveHint}</p>
      </div>
    );
  }

  // ── Job succeeded but admin hasn't approved yet: compare + actions. ──────
  // A result that already equals the published model is an approved (or
  // rejected→null) job — not a pending candidate — so it falls through to the
  // generate state below instead of lingering as a review prompt.
  if (
    latestJob &&
    latestJob.status === "SUCCEEDED" &&
    latestJob.resultGlbUrl &&
    latestJob.resultGlbUrl !== currentGlbUrl
  ) {
    // Load the candidate through the admin-only same-origin proxy — the raw
    // blob URL (latestJob.resultGlbUrl) is blocked cross-origin in the browser.
    const candidateUrl = candidateGlbSrc(latestJob.id);

    // Open + approve + reject — shared between the single-candidate inspector
    // (right column) and the compare layout (a row beneath the two tiles).
    const reviewActions = (
      <>
        <a href={candidateUrl} download="model.glb" className={`${GHOST} gap-2`}>
          <Download className="size-4" aria-hidden />
          {t.autoPreview}
        </a>
        <form action={approveAction}>
          <input type="hidden" name="jobId" value={latestJob.id} />
          <SubmitButton
            variant="primary"
            pending={approvePending}
            icon={<Check className="size-4" aria-hidden />}
          >
            {t.autoApprove}
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={rejectPending}
          className={`${GHOST_DELETE} gap-2 disabled:pointer-events-none disabled:opacity-50`}
        >
          <X className="size-4" aria-hidden />
          {rejectPending ? "…" : t.autoReject}
        </button>
      </>
    );

    return (
      <div className="flex flex-col gap-3">
        <Badge tone="success">{t.autoStatusReady}</Badge>

        {/* When a piece already has a model, show current vs. candidate side by
            side (actions beneath). Otherwise the candidate gets the full
            inspector — preview + facts + actions filling the width. The header
            preview is suppressed while this surface is up, so it's never twice. */}
        {currentGlbUrl ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewCard
                label={t.autoCompareCurrent}
                url={adminGlbSrc(jewelryId, currentGlbUrl)}
              />
              <PreviewCard
                label={t.autoCompareNew}
                url={candidateUrl}
                highlight
              />
            </div>
            {/* Scale control for the candidate — the compare tiles have no facts
                column, so it sits under them. "Авто" measures THIS candidate. */}
            <ScaleField
              jewelryId={jewelryId}
              currentScale={glbScale}
              candidateJobId={latestJob.id}
            />
            <div className="flex flex-wrap items-center gap-3">
              {reviewActions}
            </div>
          </>
        ) : (
          <GlbInspector
            url={candidateUrl}
            label={t.autoReviewSingle}
            highlight
            scale={glbScale}
            scaleJewelryId={jewelryId}
            candidateJobId={latestJob.id}
            actions={reviewActions}
          />
        )}

        <ConfirmDialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          onConfirm={() => {
            const fd = new FormData();
            fd.append("jobId", latestJob.id);
            rejectAction(fd);
            setRejectOpen(false);
          }}
          title={t.autoConfirmReject}
          confirmLabel={t.autoReject}
          cancelLabel={ru.admin.common.cancel}
          pending={rejectPending}
          tone="danger"
        />
        <FeedbackLine state={approveState} />
        <FeedbackLine state={rejectState} />
      </div>
    );
  }

  // ── FAILED or no job yet: show "Generate" button. ──────────────────────
  return (
    <div className="flex flex-col gap-3">
      {dryRunBanner}
      {latestJob && latestJob.status === "FAILED" ? (
        <Badge tone="error">
          {t.autoStatusFailed}
          {latestJob.errorMessage ? ` — ${latestJob.errorMessage}` : ""}
        </Badge>
      ) : null}      <form action={startAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={jewelryId} />
        <SubmitButton variant="primary" pending={startPending} disabled={!hasPhotos}>
          {t.autoStart}
        </SubmitButton>
        <p className="text-xs text-mute">
          {hasPhotos ? t.autoStartHint : t.autoNoPhoto}
        </p>
        <FeedbackLine state={startState} />
      </form>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────

/** Labelled GLB viewer tile. `highlight` rings the candidate in accent so the
 *  new model reads as the thing under review in the compare grid. A compact
 *  polycount caption appears under the tile once the GLB loads, so the two
 *  models can be compared on weight at a glance. */
function PreviewCard({
  label,
  url,
  highlight,
  className = "",
}: {
  label: string;
  url: string;
  highlight?: boolean;
  className?: string;
}) {
  const [stats, setStats] = useState<GlbStats | null>(null);
  return (
    <figure className={`flex flex-col gap-1.5 ${className}`}>
      <figcaption
        className={`text-xs font-medium ${highlight ? "text-accent" : "text-mute"}`}
      >
        {label}
      </figcaption>
      <GlbPreview
        url={url}
        onStats={setStats}
        className={highlight ? "ring-1 ring-accent/40" : ""}
      />
      {stats ? (
        <figcaption className="text-xs tabular-nums text-mute">
          {ru.admin.jewelry.model.statTriangles}:{" "}
          {stats.triangles.toLocaleString("ru-RU")}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "info" | "success" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-success/40 bg-success-soft text-success"
      : tone === "error"
        ? "border-error/40 bg-error-soft text-error"
        : "border-line bg-card text-ink";
  return (
    <p
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </p>
  );
}

function FeedbackLine({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p
      className={`text-xs ${state.ok ? "text-mute" : "text-error"}`}
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitButton({
  variant,
  pending,
  disabled,
  icon,
  children,
}: {
  variant: "primary" | "secondary" | "ghost";
  pending: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const tone =
    variant === "primary"
      ? "bg-ink text-bg hover:bg-ink/90"
      : variant === "secondary"
        ? "border border-ink/15 text-ink hover:border-ink/40"
        : "text-mute hover:text-ink";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${base} ${tone}`}
    >
      {pending ? (
        "…"
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
