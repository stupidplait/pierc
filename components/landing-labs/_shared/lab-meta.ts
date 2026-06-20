/**
 * Landing Labs — variant registry.
 *
 * A sandbox of 5 alternative, awwwards-grade landing concepts for PIERCERKZN,
 * each living at /landing-labs/<slug>. The real landing (app/page.tsx) is NOT
 * touched. This registry powers the index gallery and the shared LabChrome bar.
 */

export interface LabVariant {
  /** URL slug → /landing-labs/<slug> */
  slug: string;
  /** 01..05 — display order + label */
  no: string;
  /** Display title (Russian) */
  title: string;
  /** Latin codename */
  codename: string;
  /** One-line concept pitch (Russian) */
  pitch: string;
  /** Aesthetic register, for the gallery card chips */
  register: string;
  /** Signature accent (used only on the gallery card, not the variant itself) */
  accent: string;
}

export const LAB_VARIANTS: LabVariant[] = [
  {
    slug: "ostrie",
    no: "01",
    title: "ОСТРИЁ",
    codename: "EDITORIAL",
    pitch: "Бруталистская кинетическая типографика и горизонтальная витрина украшений.",
    register: "Editorial · Kinetic type",
    accent: "#f06ba0",
  },
  {
    slug: "chrom",
    no: "02",
    title: "ХРОМ",
    codename: "LIQUID METAL",
    pitch: "Жидкий хром, реагирующий на курсор, искры и кинематографичный пролёт камеры.",
    register: "Cinematic · WebGL",
    accent: "#7cdfff",
  },
  {
    slug: "atlas",
    no: "03",
    title: "АТЛАС ТЕЛА",
    codename: "BODY ATLAS",
    pitch: "Интерактивная анатомия: точки пирсинга с макро-деталями реальных украшений.",
    register: "Clinical · Interactive 3D",
    accent: "#c8a96b",
  },
  {
    slug: "vitrina",
    no: "04",
    title: "ВИТРИНА",
    codename: "BENTO SHOWCASE",
    pitch: "Кинетическое бенто, бегущая строка и магнитные кнопки — почти готовый сайт.",
    register: "Bento · Motion",
    accent: "#f06ba0",
  },
  {
    slug: "director",
    no: "05",
    title: "РЕЖИССЁРСКАЯ ВЕРСИЯ",
    codename: "DIRECTOR'S CUT",
    pitch: "Эволюция текущего сценария ВЫБЕРИ → ПРИМЕРЬ → ЗАБРОНИРУЙ, доведённая до предела.",
    register: "Narrative · 3D scroll",
    accent: "#f06ba0",
  },
];

export function getLabVariant(slug: string): LabVariant | undefined {
  return LAB_VARIANTS.find((v) => v.slug === slug);
}
