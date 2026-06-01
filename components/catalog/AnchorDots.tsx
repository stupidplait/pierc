"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Group } from "three";
import * as THREE from "three";
import type { AnchorWire } from "@/lib/catalog/types";

interface AnchorDotsProps {
  anchors: AnchorWire[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Dim or hide unrelated anchors when one is focused. */
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function AnchorDots({
  anchors,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: AnchorDotsProps) {
  // Belt-and-suspenders: if the canvas unmounts while a dot is hovered
  // (e.g. route change), reset the global cursor that pointerOver sets.
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
      }
    };
  }, []);

  return (
    <group>
      {anchors.map((a) => (
        <Dot
          key={a.id}
          anchor={a}
          selected={selectedId === a.id}
          hovered={hoveredId === a.id}
          dimmed={selectedId !== null && selectedId !== a.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

// Temp vector for world position calculations
const tempVec = new THREE.Vector3();

interface DotProps {
  anchor: AnchorWire;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function Dot({ anchor, selected, hovered, dimmed, onSelect, onHover }: DotProps) {
  const groupRef = useRef<Group | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const { camera, scene, invalidate } = useThree();

  // Per-dot raycaster to avoid shared state mutations
  const raycasterRef = useRef(new THREE.Raycaster());

  // Cache body mesh references for targeted raycasting (find once, reuse)
  const bodyMeshesRef = useRef<THREE.Object3D[] | null>(null);

  // Track last camera position to detect movement and throttle occlusion checks
  const lastCameraPosRef = useRef(new THREE.Vector3());
  const frameCountRef = useRef(0);
  const isOccludedRef = useRef(false);
  const lastHoveredRef = useRef(hovered);

  // Occlusion only cares whether *something* blocks the dot, not which tri is
  // nearest — so let the BVH bail at the first hit.
  useEffect(() => {
    raycasterRef.current.firstHitOnly = true;
  }, []);

  // Find body meshes once on mount (only test occlusion against body, not jewelry/anchors)
  useEffect(() => {
    const bodyMeshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      // Only test against body mesh, not jewelry or other anchors
      if (obj.type === 'Mesh' || obj.type === 'SkinnedMesh') {
        // Check if this is part of the body model (not jewelry)
        let parent = obj.parent;
        let isBodyMesh = false;
        while (parent) {
          // Body model is loaded via useGLTF("/models/body/body.glb")
          if (parent.userData?.isBodyModel || parent.name.includes('body')) {
            isBodyMesh = true;
            break;
          }
          parent = parent.parent;
        }
        if (isBodyMesh) {
          bodyMeshes.push(obj);
        }
      }
    });
    bodyMeshesRef.current = bodyMeshes.length > 0 ? bodyMeshes : null;
  }, [scene]);

  // Frame loop: billboard effect + occlusion culling + hover scale
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // Billboard: make the anchor always face the camera (cheap operation)
    g.quaternion.copy(camera.quaternion);

    // Only run expensive occlusion check every 30 frames (was 5) AND when camera moved significantly
    frameCountRef.current++;
    const cameraMoved = camera.position.distanceToSquared(lastCameraPosRef.current) > 0.001;

    if (frameCountRef.current % 30 === 0 || cameraMoved) {
      lastCameraPosRef.current.copy(camera.position);

      // Occlusion culling: hide anchors behind the body
      const worldPos = tempVec.setFromMatrixPosition(g.matrixWorld);
      const dirToCamera = worldPos.clone().sub(camera.position).normalize();

      // Cast ray from anchor toward camera
      const raycaster = raycasterRef.current;
      raycaster.set(worldPos, dirToCamera.negate());
      raycaster.far = worldPos.distanceTo(camera.position);

      // OPTIMIZATION: Only test against body meshes, not entire scene
      if (bodyMeshesRef.current && bodyMeshesRef.current.length > 0) {
        const intersects = raycaster.intersectObjects(bodyMeshesRef.current, false);
        isOccludedRef.current = intersects.some((hit) => {
          return hit.distance < raycaster.far - 0.01;
        });
      } else {
        // Fallback: no occlusion if body meshes not found
        isOccludedRef.current = false;
      }
    }

    // Hide if occluded
    g.visible = !isOccludedRef.current;

    // Hover scale - only invalidate when hover state changes
    if (hovered && !isOccludedRef.current) {
      g.scale.setScalar(1.3);
      if (!lastHoveredRef.current) {
        invalidate();
        lastHoveredRef.current = true;
      }
    } else {
      g.scale.setScalar(1);
      if (lastHoveredRef.current) {
        invalidate();
        lastHoveredRef.current = false;
      }
    }
  });

  // Smaller sizes - matching landing page body-local units
  const coreRadius = 0.0008;
  const ringInner = 0.0022;
  const ringOuter = 0.0025;

  const accent = "#fe017e";
  const opacity = dimmed ? 0.35 : 1;

  return (
    <group
      ref={groupRef}
      position={[anchor.position.x, anchor.position.y, anchor.position.z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(anchor.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(anchor.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      {/* Hide marker when selected - the equipped jewelry is the visual indicator */}
      {!selected && (
        <>
          {/* Filled core dot */}
          <mesh ref={coreRef} renderOrder={1000}>
            <sphereGeometry args={[coreRadius, 14, 14]} />
            <meshBasicMaterial
              color={hovered ? "#ffffff" : accent}
              toneMapped={false}
              depthTest={false}
              transparent
              opacity={opacity}
            />
          </mesh>

          {/* Outer ring (hairline outline) */}
          <mesh ref={ringRef} renderOrder={1000}>
            <ringGeometry args={[ringInner, ringOuter, 40]} />
            <meshBasicMaterial
              color={hovered ? accent : "#888888"}
              toneMapped={false}
              depthTest={false}
              transparent
              opacity={hovered ? opacity : opacity * 0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
