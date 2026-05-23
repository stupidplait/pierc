"use client";

import { useActionState } from "react";
import {
  startJewelryGeneration,
  pollJewelryJob,
  approveJewelryJob,
  rejectJewelryJob,
  type ActionState,
} from "@/lib/admin/jewelry-generation-actions";
import { ru } from "@/lib/i18n/ru";

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
  autoAvailable,
  dryRun,
  hasPhotos,
}: JewelryGenerationActionsProps) {
  const t = ru.admin.jewelry.model;

  const [startState, startAction, startPending] = useActionState<
    ActionState,
    FormData
  >(startJewelryGeneration, undefined);

  const [pollState, pollAction, pollPending] = useActionState<
    ActionState,
    FormData
  >(pollJewelryJob, undefined);

  const [approveState, approveAction, approvePending] = useActionState<
    ActionState,
    FormData
  >(approveJewelryJob, undefined);

  const [rejectState, rejectAction, rejectPending] = useActionState<
    ActionState,
    FormData
  >(rejectJewelryJob, undefined);

  if (!autoAvailable) {
    return (
      <p className="rounded-lg border border-line bg-page/60 px-4 py-3 text-sm text-mute">
        {t.autoUnavailable}
      </p>
    );
  }

  const dryRunBanner = dryRun ? (
    <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
      {t.autoDryRun}
    </p>
  ) : null;

  // ── Active in-flight job: show "processing" badge + Refresh button. ─────
  if (latestJob && latestJob.status === "PROCESSING") {
    return (
      <div className="flex flex-col gap-3">
        {dryRunBanner}
        <Badge tone="info">{t.autoStatusProcessing}</Badge>
        <form action={pollAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={jewelryId} />
          <SubmitButton variant="secondary" pending={pollPending}>
            {t.autoPoll}
          </SubmitButton>
          <FeedbackLine state={pollState} />
        </form>
      </div>
    );
  }

  // ── Job succeeded but admin hasn't approved yet: show preview + actions. ─
  if (latestJob && latestJob.status === "SUCCEEDED" && latestJob.resultGlbUrl) {
    return (
      <div className="flex flex-col gap-3">
        <Badge tone="success">{t.autoStatusReady}</Badge>
        <a
          href={latestJob.resultGlbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-fit items-center rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
        >
          {t.autoPreview} ↗
        </a>
        <div className="flex flex-wrap gap-2">
          <form action={approveAction}>
            <input type="hidden" name="jobId" value={latestJob.id} />
            <SubmitButton variant="primary" pending={approvePending}>
              {t.autoApprove}
            </SubmitButton>
          </form>
          <form
            action={rejectAction}
            onSubmit={(e) => {
              if (!confirm(t.autoConfirmReject)) e.preventDefault();
            }}
          >
            <input type="hidden" name="jobId" value={latestJob.id} />
            <SubmitButton variant="ghost" pending={rejectPending}>
              {t.autoReject}
            </SubmitButton>
          </form>
        </div>
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

function Badge({
  tone,
  children,
}: {
  tone: "info" | "success" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-primary/40 bg-primary/10 text-primary"
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
  children,
}: {
  variant: "primary" | "secondary" | "ghost";
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const tone =
    variant === "primary"
      ? "bg-primary text-on-primary hover:bg-primary-soft"
      : variant === "secondary"
        ? "border border-line text-ink hover:border-primary"
        : "text-mute hover:text-primary";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${base} ${tone}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
