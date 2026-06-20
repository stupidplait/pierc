import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════════
   ХРОМ — GPU stable-fluids cursor field. Own copy of the technique used
   in components/scene/FluidSimulation.ts (Jos Stam, ping-pong FBOs),
   trimmed for the landing variant. Produces a velocity texture consumed
   by the postprocessing trail effect (UV displacement + brightness).
   ════════════════════════════════════════════════════════════════════ */

const SIM_RES = 192;

const vertexShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const curlFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;
  float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).x;
  float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).x;
  gl_FragColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}
`;

const velocityFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform vec2 pointerPos;
uniform vec2 pointerVec;
uniform float curlStrength;
uniform float dt;
uniform float aspectRatio;
varying vec2 vUv;
void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  float cL = texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x;
  float cR = texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x;
  float cT = texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x;
  float cB = texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x;
  float cC = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(cT) - abs(cB), abs(cR) - abs(cL));
  force /= length(force) + 1e-5;
  force *= curlStrength * cC;
  vel += force * dt;
  vec2 diff = vUv - pointerPos;
  if (aspectRatio > 1.0) diff.x *= aspectRatio; else diff.y /= aspectRatio;
  float pointerLen = length(pointerVec);
  float influence = smoothstep(0.01 + 0.1 * min(0.5, pointerLen), 0.0, length(diff));
  vec2 velPower = pointerVec * 22.0;
  velPower = min(abs(velPower), vec2(2.0)) * sign(velPower);
  vel += influence * velPower;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

const divergenceFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
  float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
  float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

const pressureFrag = /* glsl */ `
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + T + B - div) * 0.25, 0.0, 0.0, 1.0);
}
`;

const gradientSubtractFrag = /* glsl */ `
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float pL = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
  float pR = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
  float pT = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
  float pB = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel -= 0.5 * vec2(pR - pL, pT - pB);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

const advectFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
uniform float velocityAttenuation;
varying vec2 vUv;
void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vec2 coord = vUv - vel * texelSize;
  gl_FragColor = vec4(texture2D(uVelocity, coord).xy * velocityAttenuation, 0.0, 1.0);
}
`;

function createFBO(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
  });
}

function createMaterial(
  frag: string,
  uniforms: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class ChromFluid {
  private velocityA = createFBO();
  private velocityB = createFBO();
  private pressureA = createFBO();
  private pressureB = createFBO();
  private curlFBO = createFBO();
  private divFBO = createFBO();

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private texelSize = new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES);

  private curlMat: THREE.ShaderMaterial;
  private velocityMat: THREE.ShaderMaterial;
  private divergenceMat: THREE.ShaderMaterial;
  private pressureMat: THREE.ShaderMaterial;
  private gradSubMat: THREE.ShaderMaterial;
  private advectMat: THREE.ShaderMaterial;

  private _pointerPos = new THREE.Vector2(0.5, 0.5);
  private _pointerVec = new THREE.Vector2(0, 0);
  private _lastMove = 0;
  private _idleMs = 1800;

  constructor() {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.curlMat = createMaterial(curlFrag, {
      uVelocity: { value: null },
      texelSize: { value: this.texelSize },
    });
    this.velocityMat = createMaterial(velocityFrag, {
      uVelocity: { value: null },
      uCurl: { value: null },
      texelSize: { value: this.texelSize },
      pointerPos: { value: this._pointerPos },
      pointerVec: { value: this._pointerVec },
      curlStrength: { value: 0.024 },
      dt: { value: 0.016 },
      aspectRatio: { value: 1 },
    });
    this.divergenceMat = createMaterial(divergenceFrag, {
      uVelocity: { value: null },
      texelSize: { value: this.texelSize },
    });
    this.pressureMat = createMaterial(pressureFrag, {
      uPressure: { value: null },
      uDivergence: { value: null },
      texelSize: { value: this.texelSize },
    });
    this.gradSubMat = createMaterial(gradientSubtractFrag, {
      uPressure: { value: null },
      uVelocity: { value: null },
      texelSize: { value: this.texelSize },
    });
    this.advectMat = createMaterial(advectFrag, {
      uVelocity: { value: null },
      texelSize: { value: this.texelSize },
      velocityAttenuation: { value: 0.972 },
    });
    this.quad = new THREE.Mesh(geo, this.curlMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setPointer(x: number, y: number, vx: number, vy: number) {
    this._pointerPos.set(x, y);
    const pvx = Math.sign(vx) * Math.pow(Math.abs(vx), 1.6);
    const pvy = Math.sign(vy) * Math.pow(Math.abs(vy), 1.6);
    this._pointerVec.x = Math.max(-1, Math.min(1, this._pointerVec.x + pvx));
    this._pointerVec.y = Math.max(-1, Math.min(1, this._pointerVec.y + pvy));
    this._lastMove = performance.now();
  }

  private renderPass(
    renderer: THREE.WebGLRenderer,
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  private swapVelocity() {
    const tmp = this.velocityA;
    this.velocityA = this.velocityB;
    this.velocityB = tmp;
  }

  private swapPressure() {
    const tmp = this.pressureA;
    this.pressureA = this.pressureB;
    this.pressureB = tmp;
  }

  compute(renderer: THREE.WebGLRenderer, dt: number) {
    if (performance.now() - this._lastMove > this._idleMs) return;
    const prevRT = renderer.getRenderTarget();
    const clampedDt = Math.min(dt, 0.05);

    this.curlMat.uniforms.uVelocity.value = this.velocityA.texture;
    this.renderPass(renderer, this.curlMat, this.curlFBO);

    this.velocityMat.uniforms.uVelocity.value = this.velocityA.texture;
    this.velocityMat.uniforms.uCurl.value = this.curlFBO.texture;
    this.velocityMat.uniforms.dt.value = clampedDt;
    this.velocityMat.uniforms.aspectRatio.value =
      renderer.domElement.width / renderer.domElement.height;
    this.renderPass(renderer, this.velocityMat, this.velocityB);
    this.swapVelocity();

    this.divergenceMat.uniforms.uVelocity.value = this.velocityA.texture;
    this.renderPass(renderer, this.divergenceMat, this.divFBO);

    this.pressureMat.uniforms.uDivergence.value = this.divFBO.texture;
    for (let i = 0; i < 4; i++) {
      this.pressureMat.uniforms.uPressure.value = this.pressureA.texture;
      this.renderPass(renderer, this.pressureMat, this.pressureB);
      this.swapPressure();
    }

    this.gradSubMat.uniforms.uPressure.value = this.pressureA.texture;
    this.gradSubMat.uniforms.uVelocity.value = this.velocityA.texture;
    this.renderPass(renderer, this.gradSubMat, this.velocityB);
    this.swapVelocity();

    this.advectMat.uniforms.uVelocity.value = this.velocityA.texture;
    this.renderPass(renderer, this.advectMat, this.velocityB);
    this.swapVelocity();

    this._pointerVec.multiplyScalar(0.5);
    renderer.setRenderTarget(prevRT);
  }

  get texture(): THREE.Texture {
    return this.velocityA.texture;
  }

  dispose() {
    this.velocityA.dispose();
    this.velocityB.dispose();
    this.pressureA.dispose();
    this.pressureB.dispose();
    this.curlFBO.dispose();
    this.divFBO.dispose();
    this.curlMat.dispose();
    this.velocityMat.dispose();
    this.divergenceMat.dispose();
    this.pressureMat.dispose();
    this.gradSubMat.dispose();
    this.advectMat.dispose();
    this.quad.geometry.dispose();
  }
}
