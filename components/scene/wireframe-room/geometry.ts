// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function mergeNonIndexed(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const ni = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(ni);
    // Dispose temporaries that toNonIndexed created
    ni.forEach((g, i) => {
        if (g !== geos[i]) g.dispose();
    });
    return merged!;
}

export function makeCrossEarring(): THREE.BufferGeometry {
    // Substantial hoop ring at top (ear hook)
    const hoop = new THREE.TorusGeometry(0.09, 0.018, 24, 48);
    hoop.translate(0, 0.32, 0);
    // Small bail loop connecting hoop to cross
    const bail = new THREE.TorusGeometry(0.025, 0.01, 12, 16, Math.PI);
    bail.rotateZ(Math.PI);
    bail.translate(0, 0.22, 0);
    // Rectangular cross pendant — flat bars, slightly tapered
    const armW = 0.038; // bar width
    const armD = 0.016; // bar depth (flat)
    const vBar = new THREE.BoxGeometry(armW, 0.32, armD);
    vBar.translate(0, 0.0, 0);
    const hBar = new THREE.BoxGeometry(0.2, armW, armD);
    hBar.translate(0, 0.08, 0);
    const g = mergeNonIndexed([hoop, bail, vBar, hBar]);
    g.scale(3.5, 3.5, 3.5);
    return g;
}

export function makeLabret(): THREE.BufferGeometry {
    const shaft = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 16);
    const ball = new THREE.SphereGeometry(0.065, 24, 24);
    ball.translate(0, 0.175 + 0.06, 0);
    const disc = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 24);
    disc.translate(0, -0.175, 0);
    const g = mergeNonIndexed([shaft, ball, disc]);
    // Lay sideways (like septum ring)
    g.rotateX(Math.PI / 2);
    g.scale(3.4, 3.4, 3.4);
    return g;
}

export function makeStudEarring(): THREE.BufferGeometry {
    // Faceted gem (octahedron = diamond-like)
    const gem = new THREE.OctahedronGeometry(0.1, 0);
    gem.translate(0, 0.06, 0);
    // Decorative bezel ring around gem
    const bezel = new THREE.TorusGeometry(0.11, 0.015, 8, 24);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(0, 0.06, 0);
    // Post
    const post = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12);
    post.translate(0, -0.11, 0);
    // Butterfly back
    const backDisc = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 16);
    backDisc.translate(0, -0.22, 0);
    const g = mergeNonIndexed([gem, bezel, post, backDisc]);
    // Lay sideways (like septum ring)
    g.rotateX(Math.PI / 2);
    g.scale(4.5, 4.5, 4.5);
    return g;
}

export function makeBarbell(): THREE.BufferGeometry {
    const bar = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 16);
    bar.rotateZ(Math.PI / 2); // horizontal
    const ballL = new THREE.SphereGeometry(0.06, 20, 20);
    ballL.translate(-0.225, 0, 0);
    const ballR = new THREE.SphereGeometry(0.06, 20, 20);
    ballR.translate(0.225, 0, 0);
    const g = mergeNonIndexed([bar, ballL, ballR]);
    g.scale(3.9, 3.9, 3.9);
    return g;
}

export function makeSeptumRing(): THREE.BufferGeometry {
    // Horseshoe / circular barbell — half-torus with ball ends
    const curve = new THREE.TorusGeometry(0.18, 0.025, 20, 32, Math.PI);
    // Ball ends at each tip of the half-torus
    const ballA = new THREE.SphereGeometry(0.05, 16, 16);
    ballA.translate(-0.18, 0, 0);
    const ballB = new THREE.SphereGeometry(0.05, 16, 16);
    ballB.translate(0.18, 0, 0);
    const g = mergeNonIndexed([curve, ballA, ballB]);
    g.scale(4.9, 4.9, 4.9);
    return g;
}

export function makeRingTorus(): THREE.BufferGeometry {
    return new THREE.TorusGeometry(1, 0.12, 128, 384);
}

/* Aligned 1:1 with ROSTER in JewelryShowcase.tsx so activeJewelry=N
   shows the same piece in 3D as the rolodex names. The hero floating
   torus IS the first carousel item ("Кольцо"). makeHoopEarring is
   no longer used (the hoop entry was dropped from the roster). */
export const PIECE_GEOMETRIES = [
    makeRingTorus, // 0: Кольцо (hero ring)
    makeCrossEarring, // 1: Крест-серьга
    makeLabret, // 2: Лабрет
    makeStudEarring, // 3: Пусета
    makeBarbell, // 4: Штанга
    makeSeptumRing, // 5: Септум
];
