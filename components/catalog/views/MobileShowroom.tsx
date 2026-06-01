"use client";

import Link from "next/link";
import { Grid3x3 } from "lucide-react";
import { ShowroomScene } from "./LazyScene";
import { CatalogSidebar } from "../CatalogSidebar";
import { Button } from "@/components/shadcn/ui/button";
import { ct, type CatalogViewProps } from "./parts";
import { catalogStrings } from "@/lib/i18n/ru";

/**
 * Shared mobile (< lg) fallback for every catalog variant. The four desktop
 * layouts diverge wildly, but on a phone they all collapse to the same stacked
 * shape — a 60vh scene over the original `CatalogSidebar` controls — so this
 * lives once instead of four times. Each view renders it inside `lg:hidden`.
 *
 * `mountScene` gates the WebGL canvas: the parent mounts exactly one scene
 * (mobile OR desktop, per the live breakpoint) so there's only ever a single
 * WebGL context. When false we render a same-size placeholder to hold layout.
 */
export function MobileShowroom(
  props: CatalogViewProps & { mountScene: boolean },
) {
  const {
    anchors,
    jewelry,
    selectedAnchorId,
    equipped,
    hideGridLink,
    onSelectAnchor,
    mountScene,
  } = props;

  return (
    <div className="flex flex-col lg:hidden">
      <div className="relative h-[60vh] bg-page">
        {mountScene ? (
          <ShowroomScene
            anchors={anchors}
            jewelry={jewelry}
            selectedId={selectedAnchorId}
            equipped={equipped}
            onSelectAnchor={onSelectAnchor}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-mute">
            {catalogStrings.showroom.sceneLoading}
          </div>
        )}
        {!hideGridLink ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="absolute right-3 top-3 gap-2 rounded-full border border-line bg-page/80 backdrop-blur"
          >
            <Link href="/catalog?view=grid">
              <Grid3x3 className="size-4" />
              {ct.gridLink}
            </Link>
          </Button>
        ) : null}
      </div>
      <CatalogSidebar {...props} />
    </div>
  );
}
