import { ru } from "@/lib/i18n/ru";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { JewelrySpriteUploader } from "@/components/admin/JewelrySpriteUploader";
import { removeJewelrySprite } from "@/lib/admin/jewelry-actions";

interface JewelrySpriteManagerProps {
  jewelryId: string;
  spriteUrl: string | null;
  blobConfigured: boolean;
}

/**
 * Server component orchestrating the sprite panel on the jewelry edit page:
 *
 *   • Header — current sprite state + preview over a checker tile +
 *     "Открыть PNG" + "Удалить спрайт".
 *   • Uploader — Авто (in-browser bg-removal) / Вручную (PNG upload)
 *     segmented control inside <JewelrySpriteUploader>.
 *
 * See docs/15-lite-mode.md for the full feature spec.
 */
export function JewelrySpriteManager({
  jewelryId,
  spriteUrl,
  blobConfigured,
}: JewelrySpriteManagerProps) {
  const t = ru.admin.jewelry.sprite;

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-line bg-card p-6">
      <header>
        <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.heading}
        </h3>
        <p className="mt-2 max-w-prose text-sm text-mute">{t.lead}</p>
        <p
          className={`mt-3 text-sm ${spriteUrl ? "text-ink" : "text-mute"}`}
        >
          {spriteUrl ? t.present : t.none}
        </p>
        {spriteUrl ? (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {/* Preview rendered over a CSS-checker tile so transparent areas
                are visible. The checker pattern is composed via two layered
                gradients on a 16px grid. */}
            <div
              className="relative h-24 w-24 shrink-0 rounded-xl border border-line"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage:
                  "linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%), linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 8px 8px",
              }}
            >
              {/* Use a plain <img> rather than next/image — sprite blobs are
                  small, public, and we want zero next/image processing of
                  the transparent PNG (which can crush alpha). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spriteUrl}
                alt={t.heading}
                className="absolute inset-0 h-full w-full rounded-xl object-contain p-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={spriteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
              >
                {t.viewExternal} ↗
              </a>
              <form>
                <input type="hidden" name="id" value={jewelryId} />
                <ConfirmDeleteButton
                  formAction={removeJewelrySprite}
                  confirmText={t.confirmRemove}
                >
                  {t.remove}
                </ConfirmDeleteButton>
              </form>
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Uploader (Auto / Manual segmented control) ─────────── */}
      <div className="border-t border-line pt-5">
        <JewelrySpriteUploader
          jewelryId={jewelryId}
          blobConfigured={blobConfigured}
        />
      </div>
    </section>
  );
}
