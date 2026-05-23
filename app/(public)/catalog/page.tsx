import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import type {
  AnchorWire,
  AnchorSide,
  BodyPlace,
  EquippedMap,
  JewelryWire,
  Vec3,
  CameraPreset,
} from "@/lib/catalog/types";
import { Showroom } from "@/components/catalog/Showroom";
import { CatalogGridFallback } from "@/components/catalog/CatalogGridFallback";
import { firstPhotoUrl } from "@/lib/jewelry/format";
import { parseEquippedFromUrl } from "@/lib/catalog/url-state";

export const metadata: Metadata = {
  title: `${ru.pages.catalog.title} — ${ru.studio.name}`,
};

interface CatalogPageProps {
  searchParams: Promise<{
    anchor?: string;
    eq?: string;
    view?: string;
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
  const [sp, anchorsDb, jewelryDb] = await Promise.all([
    searchParams,
    prisma.anchorPoint.findMany({
      orderBy: [{ place: "asc" }, { name: "asc" }],
    }),
    prisma.jewelry.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: { select: { name: true } },
        anchors: { select: { id: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  const anchors: AnchorWire[] = anchorsDb.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    place: a.place as BodyPlace,
    side: a.side as AnchorSide,
    position: asVec3(a.position),
    rotation: asVec3(a.rotation),
    cameraPresets: asCameraPresets(a.cameraPresets),
  }));

  const jewelry: JewelryWire[] = jewelryDb.map((j) => ({
    id: j.id,
    name: j.name,
    price: j.price.toString(),
    inStock: j.inStock,
    photo: firstPhotoUrl(j.photos),
    glbUrl: j.glbUrl,
    glbScale: j.glbScale ?? 1,
    categoryName: j.category.name,
    anchorIds: j.anchors.map((a) => a.id),
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
  const initialSelectedId = sp.anchor ? (slugToId.get(sp.anchor) ?? null) : null;
  const initialEquipped: EquippedMap = parseEquippedFromUrl(sp.eq, slugToId);

  return (
    <div className="lg:h-[calc(100vh-4.5rem)]">
      <Showroom
        anchors={anchors}
        jewelry={jewelry}
        initialSelectedId={initialSelectedId}
        initialEquipped={initialEquipped}
      />
    </div>
  );
}
