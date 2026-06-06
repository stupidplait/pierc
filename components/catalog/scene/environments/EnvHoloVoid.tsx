"use client";

import { Grid } from "@react-three/drei";
import { ACCENT } from "./types";

/**
 * Holo-scan void — the body floats over an infinite magenta hologrid that
 * fades into the dark void, lit by the showroom's warm-key / cool-fill /
 * magenta-rim three-point rig. The scanline sweep + bloom that complete the
 * sci-fi-HUD read live in <PostFx> and <HudChrome> (driven by the hud axis),
 * so this env stays a clean floor + lights and composes with any HUD level.
 */
export function EnvHoloVoid() {
  return (
    <>
      {/* Dark fog pulls the grid down into the void a few metres out. */}
      <fog attach="fog" args={["#080808", 2.5, 11]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} color="#fff7ec" />
      <directionalLight position={[-3, 2, 2]} intensity={0.45} color="#cfe1ff" />
      <directionalLight position={[0, 2, -3]} intensity={0.35} color={ACCENT} />

      {/* Infinite hologrid at floor level (body feet sit at y=0). */}
      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        infiniteGrid
        cellSize={0.12}
        cellThickness={0.6}
        cellColor="#2a2a2a"
        sectionSize={0.6}
        sectionThickness={1}
        sectionColor={ACCENT}
        fadeDistance={9}
        fadeStrength={2}
        followCamera={false}
      />
    </>
  );
}
