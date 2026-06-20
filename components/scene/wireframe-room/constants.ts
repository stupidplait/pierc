// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
export const DOLLY_OFFSET = -6; // units CLOSER at start (negative = toward back wall)
export const DOLLY_LAMBDA = 4; // damp rate for camera-Z + jewelry-Z tracking.
// Bumped from the historical 1.5 once readLayout was moved into the
// smooth-scroll tick(): phases now arrive in lock-step with the
// smoothed currentScroll, so this damper only needs to soak out
// single-frame jitter, not provide the cinematic glide. The previous
// 1.5 produced visible camera-Z stepping during fast wheel input
// because it double-smoothed an already-smoothed scroll input.
export const FOV_START = 50; // narrow FOV at start (zoomed in)
export const FOV_OVERSHOOT = 62; // briefly wider than rest (cinematic breathing)
export const FOV_END = 60; // normal FOV at rest
export const FOV_OVERSHOOT_DURATION = 0.5; // seconds to hold overshoot before settling

/* Chapter-1 pull-back — the camera dollies BACK away from the exhibit
   as the user scrolls hero→Chapter 1, revealing the full room around
   the fixed exhibit at the back. Hero is the intimate close-up of the
   exhibit; Chapter 1 is the wide gallery shot that contextualises it. */
export const PULLBACK_DISTANCE = 16; // chapter 1 pullback — camera Z increases by this
/* EXHIBIT_Z sits *behind* the hero camera (-21) and *in front of* the
   chapter-1 camera (-5). In hero it's behind the lens (invisible);
   as the camera pulls back past z=-12 the podium organically comes
   into view in the lower half of frame. Tuned close to the chapter-1
   camera (distance 7) so the exhibit reads prominently without the
   need for a fade animation. */
export const EXHIBIT_Z = -12;
export const HERO_RING_Z = -27; // hero floating-ring position — close to camera for original size

export const MOTE_COUNT = 40;
