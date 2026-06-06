"use client";

import { useMemo } from "react";
import { Object3D } from "three";
import { Backdrop, ContactShadows } from "@react-three/drei";

/**
 * Atelier spotlight — the refined / luxury take: a curved studio cyclorama,
 * a soft overhead spotlight raking the figure, and a grounded contact shadow.
 * Deliberately restrained — no grid, no neon — so the metal of the jewelry
 * carries the frame. Reads best with hud=subtle, but composes with bloom too.
 */
export function EnvAtelierSpotlight() {
  // Aim the spotlight at the upper body / head rather than the feet.
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(0, 1.3, 0.1);
    return o;
  }, []);

  return (
    <>
      <ambientLight intensity={0.25} />
      {/* Key spotlight from above-front. */}
      <primitive object={target} />
      <spotLight
        position={[0.6, 4.2, 2.4]}
        angle={0.55}
        penumbra={0.9}
        intensity={45}
        distance={12}
        decay={2}
        color="#fff4e6"
        target={target}
      />
      {/* Cool counter-fill to keep the shadow side from going black. */}
      <directionalLight position={[-3, 2, 1]} intensity={0.25} color="#bcd0ff" />

      {/* Curved studio backdrop behind + under the figure. */}
      <Backdrop
        floor={2}
        segments={24}
        scale={[16, 8, 4]}
        position={[0, 0, -2.2]}
        receiveShadow
      >
        <meshStandardMaterial color="#0c0c0e" roughness={1} metalness={0} />
      </Backdrop>

      {/* Soft grounded contact shadow at the feet. */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={4}
        blur={2.4}
        opacity={0.6}
        far={3}
        resolution={512}
        color="#000000"
      />
    </>
  );
}
