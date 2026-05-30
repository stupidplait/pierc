/**
 * Constants + anchor data shared by WireframeRoom + Stud.
 *
 * History: this file used to render its own copy of the body via
 *   useGLTF("/model_v6.glb")
 * but the landing now reuses the catalog's `body.glb` (rendered inline
 * by WireframeRoom's Ch2BodyMesh). The 3D component is dead, so only
 * the values stay.
 */

/* The exported gltf places the model's feet at y=0 (model-local), and
 * the model is 1.8m tall. The chapter-2 podium top tier sits at world
 * y=-2.25, so we offset by -2.25 to land the feet on the podium and
 * scale up so the body fills enough of the frame that the jewelry
 * reads as jewelry, not architecture. */
export const MODEL_Y_OFFSET = -2.25;
export const MODEL_SCALE = 4.0;

/* Ch2 multiplier on top of MODEL_SCALE. Body smooth-ramps to this
 * when the chapter activates so head/neck/shoulders fill the frame
 * for the close-up orbit. Combined: 4.0 × 2.6 = 10.4 effective. */
export const CH2_SCALE_BOOST = 2.6;

/* Anchor data in gltf-local coordinates: position (where the piercing
 * sits on the skin) + normal (outward direction the post pokes out
 * from the body). Positions copied verbatim from the GLTF empty
 * nodes (anchor_ear_l_lobe, anchor_nose_l_nostril, anchor_lip_labret,
 * anchor_brow_l) so the sign of every component matches the model's
 * own coordinate system — the model faces +Z, so the ear lobe sits
 * at z<0 (slightly behind the head's center plane), nose/lip/brow
 * at z>0 (forward face). Normals are anatomical cardinals derived
 * from each anchor's surface orientation.
 *
 * The +Z attachment convention: a jewelry piece's local +Z axis is
 * the post's outward direction (gem at +Z tip, post crosses skin
 * along -Z into the body). To attach, build a parent group whose
 * quaternion maps +Z → anchor.normal via setFromUnitVectors. */
export interface AnchorData {
    position: [number, number, number];
    normal: [number, number, number];
}

const norm3 = (
    x: number,
    y: number,
    z: number,
): [number, number, number] => {
    const m = Math.hypot(x, y, z) || 1;
    return [x / m, y / m, z / m];
};

export const ANCHORS_LOCAL: Record<string, AnchorData> = {
    // anchor_ear_l_lobe — outward = +X (avatar's left), slightly back (-Z).
    ear_left: {
        position: [+0.0722, +1.634, -0.0149],
        normal: norm3(+1, 0, -0.1),
    },
    // mirror of ear_left across YZ plane.
    ear_right: {
        position: [-0.0722, +1.634, -0.0149],
        normal: norm3(-1, 0, -0.1),
    },
    // anchor_nose_l_nostril — outward of left nostril aims forward, down, and slightly out.
    nose: {
        position: [+0.004, +1.6532, +0.0961],
        normal: norm3(+0.5, -0.5, +0.7),
    },
    // anchor_lip_labret — below lower lip, post points forward + slightly down.
    lip: {
        position: [+0.0, +1.6059, +0.0822],
        normal: norm3(0, -0.4, +0.9),
    },
    // anchor_brow_l — left eyebrow, post points forward + up + slightly out.
    eyebrow: {
        position: [+0.035, +1.7174, +0.0764],
        normal: norm3(+0.3, +0.3, +0.9),
    },
    // No GLTF empty for navel — anatomical estimate, post forward.
    navel: {
        position: [+0.0, +1.0, +0.1],
        normal: norm3(0, 0, +1),
    },
};

/* Back-compat export: positions only. WireframeRoom's BUST_ANCHORS
 * still consumes the positions-only shape. */
export const ANCHOR_DOTS_LOCAL: Record<
    string,
    [number, number, number]
> = Object.fromEntries(
    Object.entries(ANCHORS_LOCAL).map(([k, a]) => [k, a.position]),
) as Record<string, [number, number, number]>;
