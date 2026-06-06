// Environments render only lights + floor/walls/fog/decor as children of the
// <Canvas>; the body, anchor dots, equipped pieces and camera rig are constant
// siblings owned by CatalogStage. They take no props today — ambient motion
// (e.g. the dais turntable) is gated in CatalogStage where the body lives.

/** Shared magenta accent — matches the showroom's anchor dots + rim light. */
export const ACCENT = "#fe017e";
