"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Group } from "three";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";

interface EquippedPiecesProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  equipped: EquippedMap;
}

/**
 * For each equipped anchor:
 *  - If the jewelry has a `glbUrl`, load and render it (lazy + suspense).
 *  - Otherwise render a small pink placeholder torus.
 *
 * One Suspense boundary per piece, so a slow-loading model on one anchor
 * doesn't blank the entire scene.
 */
export function EquippedPieces({
  anchors,
  jewelry,
  equipped,
}: EquippedPiecesProps) {
  const jewelryById = useMemo(() => {
    const m = new Map<string, JewelryWire>();
    for (const j of jewelry) m.set(j.id, j);
    return m;
  }, [jewelry]);

  return (
    <group>
      {anchors.map((a) => {
        const jewelryId = equipped[a.id];
        if (!jewelryId) return null;
        const j = jewelryById.get(jewelryId);
        if (!j) return null;

        const transformProps = {
          position: [a.position.x, a.position.y, a.position.z] as [
            number,
            number,
            number,
          ],
          rotation: [a.rotation.x, a.rotation.y, a.rotation.z] as [
            number,
            number,
            number,
          ],
        };

        return (
          <Suspense
            key={a.id}
            fallback={<PlaceholderRing {...transformProps} />}
          >
            {j.glbUrl ? (
              <JewelryGLB
                url={j.glbUrl}
                scale={j.glbScale ?? 1}
                {...transformProps}
              />
            ) : (
              <PlaceholderRing {...transformProps} />
            )}
          </Suspense>
        );
      })}
    </group>
  );
}

// ─── Placeholder used while a GLB loads or when no GLB exists yet. ─────────

function PlaceholderRing({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <torusGeometry args={[0.013, 0.0035, 12, 32]} />
        <meshStandardMaterial
          color="#fe017e"
          metalness={0.85}
          roughness={0.18}
          emissive="#fe017e"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <sphereGeometry args={[0.005, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ─── GLB loader. Each instance clones the cached scene so multiple anchors
//     equipping the same jewelry don't share/move a single mesh. ──────────────

function JewelryGLB({
  url,
  scale,
  position,
  rotation,
}: {
  url: string;
  /**
   * Per-piece scale multiplier. The parametric Blender pipeline exports
   * models in real-world meters (matching `body.glb`'s 1.7 m height) so
   * `1.0` is correct for those pieces. Tripo3D-generated models arrive
   * at unknown scale — historically `0.025` was the sensible default
   * here; that lives on `Jewelry.glbScale` now.
   */
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const gltf = useGLTF(url) as unknown as { scene: Group };
  // Per-instance clone so multiple equips on different anchors don't
  // mutate a shared scene reference.
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}
