import { Download, Trash2 } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { GlbDropzone } from "@/components/admin/GlbDropzone";
import { JewelryGenerationActions } from "@/components/admin/JewelryGenerationActions";
import { GlbInspector } from "@/components/admin/GlbInspector";
import {
  RingOrientationTuner,
  type RingAnchorTune,
} from "@/components/admin/RingOrientationTuner";
import { CARD, GHOST, GHOST_DELETE } from "@/components/admin/form/styles";
import { removeJewelryGlb } from "@/lib/admin/jewelry-actions";
import { getProviderStatus } from "@/lib/three-gen";
import { isSingleAnchorType, type JewelryType } from "@/lib/catalog/types";
import { adminGlbSrc } from "@/lib/jewelry/glb-proxy";

interface JewelryModelManagerProps {
  jewelryId: string;
  jewelryType: JewelryType;
  glbUrl: string | null;
  /** Per-piece render scale (Jewelry.glbScale) — shown + edited in the inspector. */
  glbScale: number;
  hasPhotos: boolean;
  blobConfigured: boolean;
  latestJob: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
    resultGlbUrl: string | null;
    errorMessage: string | null;
    createdAt: Date;
  } | null;
  /** RING-only: per-anchor orientation tuner rows (Layer 3). Empty otherwise. */
  ringAnchors?: RingAnchorTune[];
}

/**
 * Server component orchestrating the 3D-model panel on the jewelry edit page:
 *
 *   • Header — current GLB state + "Скачать .glb" + "Удалить модель".
 *   • Auto generation — Replicate / Tripo3D (when configured) — RESTRICTED to
 *     single-anchor types (STUD, RING). Multi-anchor types (BARBELL,
 *     CIRCULAR_BARBELL, ORBITAL, CHAIN_LADDER) require precise endpoint
 *     placement which AI generation can't reliably produce, so we surface
 *     a hint and route the admin to the parametric pipeline instead.
 *     See docs/18-replicate-3d.md and docs/20-multi-anchor-jewelry.md.
 *   • Manual upload — admin uploads a .glb directly (always works).
 */
export function JewelryModelManager({
  jewelryId,
  jewelryType,
  glbUrl,
  glbScale,
  hasPhotos,
  blobConfigured,
  latestJob,
  ringAnchors = [],
}: JewelryModelManagerProps) {
  const t = ru.admin.jewelry.model;
  const providers = getProviderStatus();
  const aiAllowed = isSingleAnchorType(jewelryType);

  // A generated model awaiting approval (result differs from the published one)
  // owns its own compare/review preview in the generation panel below, so the
  // header's lone preview is suppressed to avoid showing the model twice.
  const pendingReview =
    !!latestJob &&
    latestJob.status === "SUCCEEDED" &&
    !!latestJob.resultGlbUrl &&
    latestJob.resultGlbUrl !== glbUrl;

  // "Скачать .glb" + "Удалить модель" — rendered in the inspector's actions
  // column beside the model facts, or on their own while a candidate review
  // owns the preview below. (glbUrl narrows to string inside this branch.)
  const modelActions = glbUrl ? (
    <>
      <a
        href={adminGlbSrc(jewelryId, glbUrl)}
        download="model.glb"
        className={`${GHOST} gap-2`}
      >
        <Download className="size-4" aria-hidden />
        {t.viewExternal}
      </a>
      <form>
        <input type="hidden" name="id" value={jewelryId} />
        <ConfirmDeleteButton
          formAction={removeJewelryGlb}
          confirmText={t.confirmRemove}
          className={`${GHOST_DELETE} gap-2`}
        >
          <Trash2 className="size-4" aria-hidden />
          {t.remove}
        </ConfirmDeleteButton>
      </form>
    </>
  ) : null;

  return (
    <section className={`${CARD} flex flex-col gap-6 p-6 sm:p-8`}>
      <header>
        <h2 className="font-display text-xl font-medium tracking-tight text-ink">
          {t.heading}
        </h2>
        <p className={`mt-1 text-sm ${glbUrl ? "text-ink" : "text-mute"}`}>
          {glbUrl ? t.present : t.none}
        </p>
        {glbUrl ? (
          pendingReview ? (
            // Candidate under review owns the preview in the panel below; here
            // keep only the current model's actions so it can still be removed.
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {modelActions}
            </div>
          ) : (
            <div className="mt-4">
              {/* key by glbUrl so a re-saved (nudged) model remounts the inspector
                  and resets its local rotation state to the freshly-baked pose. */}
              <GlbInspector
                key={glbUrl}
                url={adminGlbSrc(jewelryId, glbUrl)}
                jewelryId={jewelryId}
                scale={glbScale}
                scaleJewelryId={jewelryId}
                actions={modelActions}
              />
            </div>
          )
        ) : null}
      </header>

      {/* ── Auto generation ──────────────────────────────────────── */}
      <div className="border-t border-line pt-6">
        <h3 className="mb-3 text-sm font-medium text-ink">{t.autoHeading}</h3>
        {aiAllowed ? (
          <JewelryGenerationActions
            jewelryId={jewelryId}
            latestJob={latestJob}
            currentGlbUrl={glbUrl}
            glbScale={glbScale}
            autoAvailable={providers.autoAvailable}
            dryRun={providers.dryRun}
            hasPhotos={hasPhotos}
          />
        ) : (
          <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
            {t.autoMultiAnchorBlocked}
          </p>
        )}
      </div>

      {/* ── Ring orientation tuner (RING only) — Layer 3 escape hatch ── */}
      {ringAnchors.length > 0 ? (
        <RingOrientationTuner jewelryId={jewelryId} anchors={ringAnchors} />
      ) : null}

      {/* ── Manual upload — fallback path ────────────────────────── */}
      <div className="border-t border-line pt-6">
        <h3 className="mb-3 text-sm font-medium text-ink">{t.manualHeading}</h3>
        <p className="mb-4 max-w-prose text-sm text-mute">{t.manualLead}</p>
        <GlbDropzone
          jewelryId={jewelryId}
          blobConfigured={blobConfigured}
          currentGlbUrl={glbUrl}
        />
      </div>
    </section>
  );
}
