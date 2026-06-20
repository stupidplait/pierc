import { type Material, type Mesh, type Object3D } from "three";

// ── Dither-dissolve reveal ────────────────────────────────────────────────
// Materialize newly-attached jewelry with a hashed screen-space dither (à la
// the landing's jewelry swaps) instead of a hard pop-in: a `uReveal` uniform
// ramps 0→1 and any fragment whose stable per-pixel hash exceeds it is
// discarded, so the piece stipples into existence. Works on any GLB material
// (discard needs no transparency/sort), patched per-instance via onBeforeCompile.
export const REVEAL_TARGET = 1.12; // slightly >1 so no stray pixels stay discarded
export const REVEAL_DAMP = 4.5; // ramp speed (≈0.6s)

const DITHER_GLSL = /* glsl */ `
uniform float uReveal;
float _revealHash(vec2 p){
  return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
}
`;

export function patchDitherReveal(material: Material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = { value: 0 };
    // Stash the compiled shader so useFrame can drive uReveal without holding a
    // React value (avoids the lint against mutating refs/memos during render).
    material.userData.shader = shader;
    shader.fragmentShader =
      DITHER_GLSL +
      shader.fragmentShader.replace(
        "void main() {",
        "void main() {\n  if (uReveal < _revealHash(gl_FragCoord.xy)) discard;",
      );
  };
  material.needsUpdate = true;
}

/** Push the current reveal value into every patched material in `root`. */
export function setRevealValue(root: Object3D, value: number) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const shader = m?.userData?.shader as
        | { uniforms: { uReveal?: { value: number } } }
        | undefined;
      if (shader?.uniforms.uReveal) shader.uniforms.uReveal.value = value;
    }
  });
}
