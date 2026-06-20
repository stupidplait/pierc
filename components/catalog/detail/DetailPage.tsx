import Image from "next/image";
import {
  type DetailViewProps,
  BackLink,
  TitleBlock,
  CtaRow,
  Description,
  SpecLedger,
  AnchorChips,
  PhotoEmpty,
} from "./parts";
import { CatalogGlbViewer } from "./CatalogGlbViewer";
import { catalogStrings } from "@/lib/i18n/ru";

/**
 * DetailPage — the standalone /catalog/[id] view. The piece's interactive 3D
 * model is the hero, orbitable front-and-center on a dark stage, with a compact
 * detail column beside it and a thumbnail strip of photos below the model. When
 * the piece has no GLB, the hero falls back to the first photo so the layout
 * still reads.
 */
export function DetailPage({ piece, user }: DetailViewProps) {
  const heroPhoto = piece.photos[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-16">
      <BackLink className="mb-6" />

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* Stage */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-bg">
            {piece.glbUrl ? (
              <CatalogGlbViewer url={piece.glbUrl} className="h-full w-full" />
            ) : heroPhoto ? (
              <Image
                src={heroPhoto.url}
                alt={heroPhoto.alt || piece.name}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority
              />
            ) : (
              <PhotoEmpty className="h-full w-full rounded-none border-0" />
            )}
            {piece.glbUrl ? (
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/70 px-3 py-1 font-mono text-[11px] text-mute backdrop-blur">
                {catalogStrings.showroom.rotateHint}
              </span>
            ) : null}
          </div>

          {/* Photo thumbs under the model (when there's a model + photos) */}
          {piece.glbUrl && piece.photos.length > 0 ? (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {piece.photos.slice(0, 5).map((p) => (
                <li
                  key={p.url}
                  className="relative aspect-square overflow-hidden rounded-lg border border-line bg-card"
                >
                  <Image
                    src={p.url}
                    alt={p.alt}
                    fill
                    sizes="12vw"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Detail column */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <TitleBlock piece={piece} />
          <Description piece={piece} className="mt-5" />
          <CtaRow piece={piece} user={user} className="mt-8" />

          <div className="mt-8 rounded-2xl border border-line bg-card p-6">
            <SpecLedger piece={piece} />
            {piece.anchorChips.length > 0 ? (
              <AnchorChips
                piece={piece}
                className="mt-5 border-t border-line pt-5"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
