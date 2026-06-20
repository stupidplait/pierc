import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import type {
  AnchorWire,
  AnchorSide,
  BodyPlace,
  EquippedMap,
  Vec3,
  CameraPreset,
} from "@/lib/catalog/types";
import { Showroom } from "@/components/catalog/Showroom";
import { CatalogGridFallback } from "@/components/catalog/CatalogGridFallback";
import { parseEquippedFromUrl } from "@/lib/catalog/url-state";
import {
  getBookingPrefillUser,
  getPublishedJewelry,
} from "@/lib/public/queries";

export const metadata: Metadata = {
  title: `${ru.pages.catalog.title} — ${ru.studio.name}`,
};

interface CatalogPageProps {
  searchParams: Promise<{
    anchor?: string;
    eq?: string;
    view?: string;
    inspect?: string;
  }>;
}

// Coerce the JSON columns into our wire shape. Each Prisma JSON value is
// `Prisma.JsonValue` (unknown-ish), so we narrow defensively.
function asVec3(v: unknown): Vec3 {
  if (v && typeof v === "object" && "x" in v && "y" in v && "z" in v) {
    const o = v as Record<string, unknown>;
    return {
      x: Number(o.x) || 0,
      y: Number(o.y) || 0,
      z: Number(o.z) || 0,
    };
  }
  return { x: 0, y: 0, z: 0 };
}

function asCameraPresets(v: unknown): CameraPreset[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
    )
    .map((p) => ({
      name: typeof p.name === "string" ? p.name : "",
      position: asVec3(p.position),
      target: asVec3(p.target),
      fov: Number(p.fov) || 35,
    }));
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [sp, anchorsDb, jewelry, user] = await Promise.all([
    searchParams,
    prisma.anchorPoint.findMany({
      orderBy: [{ place: "asc" }, { name: "asc" }],
    }),
    // Cross-request cached + tag-busted (see getPublishedJewelry). Returns the
    // full published set already mapped to JewelryWire — the showroom needs all
    // of it, so it isn't paginated.
    getPublishedJewelry(),
    getBookingPrefillUser(),
  ]);

  const anchors: AnchorWire[] = anchorsDb.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    place: a.place as BodyPlace,
    side: a.side as AnchorSide,
    position: asVec3(a.position),
    rotation: asVec3(a.rotation),
    ringRotation: a.ringRotation == null ? null : asVec3(a.ringRotation),
    cameraPresets: asCameraPresets(a.cameraPresets),
  }));

  // Fallback path: explicit ?view=grid
  if (sp.view === "grid") {
    return (
      <CatalogGridFallback
        jewelry={jewelry}
        reason="explicit"
        showroomHref="/catalog"
      />
    );
  }

  // Resolve initial selected anchor + equipped map from the URL.
  const slugToId = new Map(anchors.map((a) => [a.slug, a.id]));

  // Default the focus to an ear anchor so the catalog lands looking at an ear —
  // the studio's signature spot — rather than the full-body shot. Falls back to
  // any EAR anchor if the preferred slug isn't seeded.
  const DEFAULT_ANCHOR_SLUG = "left-ear-lobe";
  const defaultAnchorId =
    slugToId.get(DEFAULT_ANCHOR_SLUG) ??
    anchors.find((a) => a.place === "EAR")?.id ??
    null;
  const initialSelectedId = sp.anchor
    ? (slugToId.get(sp.anchor) ?? null)
    : defaultAnchorId;

  const initialEquipped: EquippedMap = parseEquippedFromUrl(sp.eq, slugToId);

  // Deep-linked inspect overlay: honour ?inspect= only when it points at a piece
  // in the published set, so a stale link can't open an empty overlay.
  const initialInspectId =
    sp.inspect && jewelry.some((j) => j.id === sp.inspect) ? sp.inspect : null;

  return (
    <div className="h-svh">
      <Showroom
        anchors={anchors}
        jewelry={jewelry}
        initialSelectedId={initialSelectedId}
        initialEquipped={initialEquipped}
        initialInspectId={initialInspectId}
        user={user}
      />
    </div>
  );
}
