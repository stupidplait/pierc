// Catalog design axes. These started as a `?key=value` variant lab; the
// directions are now locked, so the URL params + live switcher are gone and the
// single chosen combination lives in {@link CATALOG_DESIGN} below. The variant
// type unions survive only because the surviving components still take them as
// props:
//
//   env      dais       -> 3D stage / environment
//   cards    rail       -> jewelry-card placement (hotbar on mobile)
//   hud      full       -> chrome / postprocessing intensity
//   detail   overlay    -> what clicking a piece does
//   place    bar        -> where piercing-place selection lives
//   info     rail       -> where the data readouts live
//   bg       glow       -> backdrop behind the dais figure
//   dots     ring       -> anchor-dot marker style
//   cardview gallery    -> in-rail card-page layout
//   loader   spinner    -> loader/spinner style (scene + GLB)

export const ENV_VARIANTS = ["holo", "dais", "atelier", "arena"] as const;
export type EnvVariant = (typeof ENV_VARIANTS)[number];

export const CARDS_VARIANTS = ["rail", "hotbar", "radial", "sheet"] as const;
export type CardsVariant = (typeof CARDS_VARIANTS)[number];

export const HUD_VARIANTS = ["full", "subtle", "landing"] as const;
export type HudVariant = (typeof HUD_VARIANTS)[number];

export const DETAIL_VARIANTS = ["overlay", "both", "page"] as const;
export type DetailVariant = (typeof DETAIL_VARIANTS)[number];

export const PLACE_VARIANTS = ["bar", "map", "dropdown"] as const;
export type PlaceVariant = (typeof PLACE_VARIANTS)[number];

export const INFO_VARIANTS = ["hud", "rail"] as const;
export type InfoVariant = (typeof INFO_VARIANTS)[number];

export const BG_VARIANTS = ["void", "glow", "gradient", "beams"] as const;
export type BgVariant = (typeof BG_VARIANTS)[number];

export const DOTS_VARIANTS = ["ring", "solid", "pulse", "reticle"] as const;
export type DotsVariant = (typeof DOTS_VARIANTS)[number];

export const CARDVIEW_VARIANTS = ["gallery", "editorial", "sheet"] as const;
export type CardviewVariant = (typeof CARDVIEW_VARIANTS)[number];

export const CARDTX_VARIANTS = ["fade", "slide", "cover"] as const;
export type CardtxVariant = (typeof CARDTX_VARIANTS)[number];

export const LOADER_VARIANTS = ["spinner", "bars", "pulse", "ring"] as const;
export type LoaderVariant = (typeof LOADER_VARIANTS)[number];

export interface LabState {
  env: EnvVariant;
  cards: CardsVariant;
  hud: HudVariant;
  detail: DetailVariant;
  place: PlaceVariant;
  info: InfoVariant;
  bg: BgVariant;
  dots: DotsVariant;
  cardview: CardviewVariant;
  cardtx: CardtxVariant;
  loader: LoaderVariant;
  /** Jewelry id currently open in the inspect overlay, or null. */
  inspect: string | null;
}

/**
 * The locked-in catalog design. The variant lab + its `?key=value` URL params
 * and live switcher have been collapsed to this single combination; the showroom
 * reads it directly (no URL state, no switcher). The variant type unions above
 * are kept because the surviving components still take them as props.
 */
export const CATALOG_DESIGN: Omit<LabState, "inspect"> = {
  env: "dais",
  cards: "rail",
  hud: "full",
  detail: "overlay",
  place: "bar",
  info: "rail",
  bg: "glow",
  dots: "ring",
  cardview: "gallery",
  cardtx: "fade",
  loader: "spinner",
};
