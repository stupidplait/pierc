import { ru } from "@/lib/i18n/ru";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { JewelryGlbUploadForm } from "@/components/admin/JewelryGlbUploadForm";
import { JewelryGenerationActions } from "@/components/admin/JewelryGenerationActions";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
import { removeJewelryGlb } from "@/lib/admin/jewelry-actions";
import { getProviderStatus } from "@/lib/three-gen";
import { isSingleAnchorType, type JewelryType } from "@/lib/catalog/types";

interface JewelryModelManagerProps {
  jewelryId: string;
  jewelryType: JewelryType;
  glbUrl: string | null;
  hasPhotos: boolean;
  blobConfigured: boolean;
  latestJob: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
    resultGlbUrl: string | null;
    errorMessage: string | null;
    createdAt: Date;
  } | null;
}

// Hairline chip shared by the "open .glb" link — neutral by default, firms its
// border + ink on hover, matching the Steel Atelier secondary vocabulary.
const CHIP =
  "inline-flex h-9 w-fit items-center rounded-lg border border-ink/15 px-3 text-xs font-medium text-ink transition-colors hover:border-ink/40";

/**
 * Server component orchestrating the 3D-model panel on the jewelry edit page:
 *
 *   • Header — current GLB state + "Открыть .glb" + "Удалить модель".
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
  hasPhotos,
  blobConfigured,
  latestJob,
}: JewelryModelManagerProps) {
  const t = ru.admin.jewelry.model;
  const providers = getProviderStatus();
  const aiAllowed = isSingleAnchorType(jewelryType);

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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={glbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={CHIP}
            >
              {t.viewExternal} ↗
            </a>
            <form>
              <input type="hidden" name="id" value={jewelryId} />
              <ConfirmDeleteButton
                formAction={removeJewelryGlb}
                confirmText={t.confirmRemove}
                className={`${GHOST_DELETE} h-9 px-4 text-xs`}
              >
                {t.remove}
              </ConfirmDeleteButton>
            </form>
          </div>
        ) : null}
      </header>

      {/* ── Auto generation ──────────────────────────────────────── */}
      <div className="border-t border-line pt-6">
        <h3 className="mb-3 text-sm font-medium text-ink">{t.autoHeading}</h3>
        {aiAllowed ? (
          <JewelryGenerationActions
            jewelryId={jewelryId}
            latestJob={latestJob}
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

      {/* ── Manual upload — fallback path ────────────────────────── */}
      <div className="border-t border-line pt-6">
        <h3 className="mb-3 text-sm font-medium text-ink">{t.manualHeading}</h3>
        <p className="mb-4 max-w-prose text-sm text-mute">{t.manualLead}</p>
        <JewelryGlbUploadForm
          jewelryId={jewelryId}
          blobConfigured={blobConfigured}
        />
      </div>
    </section>
  );
}
