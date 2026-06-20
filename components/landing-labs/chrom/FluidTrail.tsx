"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Effect, BlendFunction } from "postprocessing";
import { Uniform, type Texture } from "three";
import { ChromFluid } from "./fluid-sim";

/* ════════════════════════════════════════════════════════════════════
   ХРОМ — cursor fluid-trail post pass. Reads the velocity field from
   ChromFluid and displaces UVs + brightens along the trail. Own copy of
   the technique in components/scene/FluidTrailEffect.tsx, simplified
   (no reveal shockwave). Drives the "liquid metal smears under cursor".
   ════════════════════════════════════════════════════════════════════ */

const fragmentShader = /* glsl */ `
uniform sampler2D uFluidTex;
uniform float uIsDark;

void mainUv(inout vec2 uv) {
  vec2 fluid = texture2D(uFluidTex, uv).xy;
  uv += fluid * 0.0045;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 fluid = texture2D(uFluidTex, uv).xy;
  float len = length(fluid);
  float effect = len * 1.6;
  // dark: brighten the smear (chrome catches light); light: subtle darken
  float multiplier = mix(1.0 - effect * 0.12, 1.0 + effect, uIsDark);
  outputColor = vec4(inputColor.rgb * multiplier, inputColor.a);
}
`;

class FluidTrailImpl extends Effect {
  constructor(fluidTexture: Texture) {
    super("ChromFluidTrail", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uFluidTex", new Uniform(fluidTexture)],
        ["uIsDark", new Uniform(1.0)],
      ]),
    });
  }
  set fluidTexture(tex: Texture) {
    this.uniforms.get("uFluidTex")!.value = tex;
  }
  set isDark(v: boolean) {
    this.uniforms.get("uIsDark")!.value = v ? 1.0 : 0.0;
  }
}

export function FluidTrail({
  mouseRef,
  isDark = true,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  isDark?: boolean;
}) {
  const { gl } = useThree();
  const sim = useMemo(() => new ChromFluid(), []);
  const effect = useMemo(() => new FluidTrailImpl(sim.texture), [sim]);
  const prev = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => () => sim.dispose(), [sim]);

  /* eslint-disable react-hooks/immutability -- driving a postprocessing Effect's uniforms each frame is the canonical r3f pattern */
  useFrame((_, delta) => {
    const m = mouseRef.current;
    const dt = Math.min(delta, 0.05);
    const mx = m.x * 0.5 + 0.5;
    const my = m.y * 0.5 + 0.5;
    const vx = (mx - prev.current.x) * 20;
    const vy = (my - prev.current.y) * 20;
    prev.current.x = mx;
    prev.current.y = my;
    sim.setPointer(mx, my, vx, vy);
    sim.compute(gl, dt);
    effect.fluidTexture = sim.texture;
    effect.isDark = isDark;
  });
  /* eslint-enable react-hooks/immutability */

  return <primitive object={effect} dispose={null} />;
}
