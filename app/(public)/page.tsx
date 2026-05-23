import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  type AnchorWire,
  type AnchorSide,
  type BodyPlace,
  type CameraPreset,
  type EquippedMap,
  type JewelryWire,
  type Vec3,
} from "@/lib/catalog/types";
import { firstPhotoUrl } from "@/lib/jewelry/format";
import { parseEquippedFromUrl } from "@/lib/catalog/url-state";
import { ru } from "@/lib/i18n/ru";
import { StoryHero } from "@/components/landing/StoryHero";
import { StoryChapter1 } from "@/components/landing/StoryChapter1";
import { StoryChapter2 } from "@/components/landing/StoryChapter2";
import { StoryChapter3 } from "@/components/landing/StoryChapter3";

export const metadata: Metadata = {
  title: ru.studio.name,
  description: ru.pages.home.hero.lead,
};

interface HomePageProps {
  searchParams: Promise<{ eq?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
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
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
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

  // Featured items, single pass (max 6).
  const featuredIds = new Set(
    jewelryDb.filter((j) => j.featured).map((j) => j.id),
  );
  const featured = jewelry.filter((j) => featuredIds.has(j.id)).slice(0, 6);

  // Parse current equip state from URL — shared across all three chapters.
  const slugToId = new Map(anchors.map((a) => [a.slug, a.id]));
  const initialEquipped: EquippedMap = parseEquippedFromUrl(sp.eq, slugToId);

  return (
    <>
      <StoryHero />
      <StoryChapter1
        featured={featured}
        anchors={anchors}
        initialEquipped={initialEquipped}
      />
      <StoryChapter2
        anchors={anchors}
        jewelry={jewelry}
        initialEquipped={initialEquipped}
      />
      <StoryChapter3 jewelry={jewelry} equipped={initialEquipped} />
    </>
  );
}

// JSON-narrowing helpers (same shape as in /catalog/page.tsx).
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
