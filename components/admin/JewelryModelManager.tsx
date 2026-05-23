import { ru } from "@/lib/i18n/ru";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { JewelryGlbUploadForm } from "@/components/admin/JewelryGlbUploadForm";
import { JewelryGenerationActions } from "@/components/admin/JewelryGenerationActions";
import { removeJewelryGlb } from "@/lib/admin/jewelry-actions";
import { getProviderStatus } from "@/lib/three-gen";

interface JewelryModelManagerProps {
  jewelryId: string;
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

/**
 * Server component orchestrating the 3D-model panel on the jewelry edit page:
 *
 *   • Header — current GLB state + "Открыть .glb" + "Удалить модель".
 *   • Auto generation — Tripo3D (when configured). Uses the
 *     `<JewelryGenerationActions>` client island for state-driven buttons.
 *   • Manual upload — admin uploads a .glb directly (always works).
 */
export function JewelryModelManager({
  jewelryId,
  glbUrl,
  hasPhotos,
  blobConfigured,
  latestJob,
}: JewelryModelManagerProps) {
  const t = ru.admin.jewelry.model;
  const providers = getProviderStatus();

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-line bg-card/40 p-6">
      <header>
        <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.heading}
        </h3>
        <p
          className={`mt-2 text-sm ${glbUrl ? "text-ink" : "text-mute"}`}
        >
          {glbUrl ? t.present : t.none}
        </p>
        {glbUrl ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={glbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
            >
              {t.viewExternal} ↗
            </a>
            <form>
              <input type="hidden" name="id" value={jewelryId} />
              <ConfirmDeleteButton
                formAction={removeJewelryGlb}
                confirmText={t.confirmRemove}
              >
                {t.remove}
              </ConfirmDeleteButton>
            </form>
          </div>
        ) : null}
      </header>

      {/* ── Auto generation ──────────────────────────────────────── */}
      <div className="border-t border-line pt-5">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute">
          {t.autoHeading}
        </h4>
        <JewelryGenerationActions
          jewelryId={jewelryId}
          latestJob={latestJob}
          autoAvailable={providers.autoAvailable}
          dryRun={providers.dryRun}
          hasPhotos={hasPhotos}
        />
      </div>

      {/* ── Manual upload — fallback path ────────────────────────── */}
      <div className="border-t border-line pt-5">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute">
          {t.manualHeading}
        </h4>
        <p className="mb-4 max-w-prose text-sm text-mute">{t.manualLead}</p>
        <JewelryGlbUploadForm
          jewelryId={jewelryId}
          blobConfigured={blobConfigured}
        />
      </div>
    </section>
  );
}
