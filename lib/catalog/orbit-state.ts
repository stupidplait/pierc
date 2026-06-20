// Shared mutable flag: true while the user is drag-orbiting the camera on the
// bare canvas. CameraRig owns it (sets it on canvas pointerdown / up); AnchorDots
// reads it to suppress dot hover during a drag — so the orbit stays smooth (no
// per-dot hover re-render churn) and dots don't flicker-highlight under the swept
// cursor. Module singleton — the catalog is a single instance (same pattern as
// scene-ready.ts).
export const orbitState = { dragging: false };
