"use client";

import { Grid } from "@react-three/drei";
import { ACCENT } from "./types";

/**
 * Neon arena — maximal arcade energy. A bright magenta floor grid, a back-wall
 * grid, magenta-tinted fog and two coloured point lights wrap the figure in a
 * cyber-cage. Pairs with hud=full for heavy bloom; the emissive grid sections
 * are what the bloom pass blooms.
 */
export function EnvNeonArena() {
  return (
    <>
      <fog attach="fog" args={["#0a0410", 2.5, 12]} />

      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 6, 4]} intensity={0.8} color="#fff7ec" />
      <pointLight position={[-2.5, 1.6, 1.5]} intensity={10} distance={8} color={ACCENT} />
      <pointLight position={[2.5, 1.6, 1.5]} intensity={8} distance={8} color="#3aa0ff" />
      <directionalLight position={[0, 3, -4]} intensity={1.1} color={ACCENT} />

      {/* Bright neon floor grid. */}
      <Grid
        position={[0, 0.001, 0]}
        args={[24, 24]}
        infiniteGrid
        cellSize={0.18}
        cellThickness={0.8}
        cellColor="#3a1228"
        sectionSize={0.9}
        sectionThickness={1.4}
        sectionColor={ACCENT}
        fadeDistance={10}
        fadeStrength={1.6}
      />

      {/* Back-wall grid — rotated up to stand behind the figure. */}
      <Grid
        position={[0, 2.4, -3]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[24, 16]}
        cellSize={0.24}
        cellThickness={0.6}
        cellColor="#2a0e1e"
        sectionSize={1.2}
        sectionThickness={1.2}
        sectionColor="#7a2350"
        fadeDistance={14}
        fadeStrength={1.4}
      />
    </>
  );
}
