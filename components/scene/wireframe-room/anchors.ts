// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
export type Ch2Anchor = {
    slug: string;
    name: string; // Russian display name shown on hover
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
};

export const CH2_VISIBLE_ANCHORS: Ch2Anchor[] = [
    // Ear anchors — kept in sync with prisma/seed-data/anchors.json.
    // The ear cartilage on body.glb sits at glTF Y 1.555..1.605, Z -0.020..-0.045
    // (i.e. behind the cheek plane). See scripts/anchors/fix-ear-positions.mjs.
    { slug: "left-ear-lobe",   name: "Левая мочка",    position: { x: 0.0711, y: 1.5479, z: -0.0164 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-helix",      name: "Хеликс",         position: { x: 0.0852, y: 1.5858, z: -0.0417 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-tragus",     name: "Трагус",         position: { x: 0.0718, y: 1.5677, z: -0.0135 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-conch",      name: "Конха",          position: { x: 0.0756, y: 1.5682, z: -0.0307 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-rook",       name: "Рок",            position: { x: 0.0788, y: 1.587, z: -0.0272 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-daith",      name: "Дайт",           position: { x: 0.0707, y: 1.5731, z: -0.0217 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-industrial", name: "Индастриал",     position: { x: 0.0768, y: 1.5936, z: -0.0223 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "septum",          name: "Септум",         position: { x: 0, y: 1.5479, z: 0.0905 },        rotation: { x: 0, y: 0, z: 0 } },
    { slug: "left-nostril",    name: "Ноздря",         position: { x: 0.0303, y: 1.5552, z: 0.0715 },    rotation: { x: 0, y: 0, z: 0 } },
    { slug: "left-eyebrow",    name: "Бровь",          position: { x: 0.03, y: 1.598, z: 0.071 },      rotation: { x: 0, y: 0, z: 0 } },
    { slug: "lip-medusa",      name: "Медуза",         position: { x: 0, y: 1.5319, z: 0.0827 },        rotation: { x: 0, y: 0, z: 0 } },
    { slug: "lip-labret",      name: "Лабрет",         position: { x: 0, y: 1.5037, z: 0.0706 },        rotation: { x: 0, y: 0, z: 0 } },
];

export const CH2_DEFAULT_LOBE: Ch2Anchor | null =
    CH2_VISIBLE_ANCHORS.find((a) => a.slug === "left-ear-lobe") ?? null;
