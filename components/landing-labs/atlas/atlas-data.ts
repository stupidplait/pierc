/**
 * АТЛАС ТЕЛА — atlas zone registry.
 *
 * The interactive body atlas plots real piercing placements onto the focused
 * head/face/ear region of /models/body/body.glb. Each zone carries:
 *   - the real anchor world-position (lifted verbatim from
 *     prisma/seed-data/anchors.json so a hotspot lands exactly where the
 *     catalog mounts jewelry),
 *   - a clinical, Russian description,
 *   - the matching REAL jewelry GLB (from /jewelry-glb/) shown spinning in the
 *     deep-dive viewer,
 *   - material / gauge / price spec for the precision-instrument readout.
 *
 * Coordinate system matches the GLB scene root (origin at the floor between
 * feet, +Y up, +Z forward). The atlas camera frames the head, so we only plot
 * head/face/ear zones plus the navel as a single torso anchor.
 */

export interface AtlasZone {
  /** Stable id + URL-ish key. */
  id: string;
  /** Two-digit atlas index, e.g. "01". */
  no: string;
  /** Russian zone name (display). */
  name: string;
  /** Latin / clinical sub-label. */
  latin: string;
  /** World position of the anchor on body.glb (metres). */
  position: [number, number, number];
  /** Which side the label flag should fly out to in the 3D overlay. */
  flag: "left" | "right";
  /** Clinical Russian description for the deep-dive panel. */
  body: string;
  /** Real jewelry GLB shown spinning in the deep-dive viewer. */
  glb: string;
  /** Spec readout. */
  material: string;
  gauge: string;
  size: string;
  healing: string;
  /** Price in roubles. */
  price: number;
}

const J = "/jewelry-glb/";

export const ATLAS_ZONES: AtlasZone[] = [
  {
    id: "lobe",
    no: "01",
    name: "Мочка",
    latin: "Lobulus auriculae",
    position: [0.0711, 1.5479, -0.0164],
    flag: "right",
    body: "Базовая точка. Мягкая ткань без хряща — самый предсказуемый прокол и самое быстрое заживление. С неё начинают коллекцию из нескольких отверстий.",
    glb: `${J}labret-titanium-ball-6mm-16g.glb`,
    material: "Титан ASTM F136",
    gauge: "16G",
    size: "6 мм · шар",
    healing: "6–8 недель",
    price: 2900,
  },
  {
    id: "helix",
    no: "02",
    name: "Хеликс",
    latin: "Helix",
    position: [0.0848, 1.5883, -0.0364],
    flag: "right",
    body: "Внешний завиток хряща. Носит кольцо-сегмент или лабрет. Хрящ заживает дольше кожи — режим покоя обязателен в первые недели.",
    glb: `${J}seamless-hoop-titanium-8mm-16g.glb`,
    material: "Титан ASTM F136",
    gauge: "16G",
    size: "8 мм · кольцо",
    healing: "4–6 месяцев",
    price: 3600,
  },
  {
    id: "tragus",
    no: "03",
    name: "Козелок",
    latin: "Tragus",
    position: [0.0718, 1.5677, -0.0135],
    flag: "right",
    body: "Маленький выступ хряща перед слуховым каналом. Аккуратный лабрет с плоским диском сидит плотно и не цепляется за наушники.",
    glb: `${J}labret-titanium-disc-8mm-16g.glb`,
    material: "Титан ASTM F136",
    gauge: "16G",
    size: "8 мм · диск",
    healing: "3–5 месяцев",
    price: 3200,
  },
  {
    id: "conch",
    no: "04",
    name: "Конха",
    latin: "Concha",
    position: [0.0774, 1.5711, -0.0317],
    flag: "right",
    body: "Внутренняя чаша ушной раковины. Крупный калибр и золото 585 раскрывают центр уха — эффектная якорная точка композиции.",
    glb: `${J}seamless-hoop-gold585-8mm-16g.glb`,
    material: "Золото 585",
    gauge: "16G",
    size: "8 мм · кольцо",
    healing: "4–6 месяцев",
    price: 7400,
  },
  {
    id: "nostril",
    no: "05",
    name: "Крыло носа",
    latin: "Ala nasi",
    position: [0.011, 1.557, 0.08],
    flag: "left",
    body: "Классический нострил. Тонкая штанга-гвоздик 18G с опалом или прозрачным камнем держится незаметно и заживает деликатно.",
    glb: `${J}nose-stud-l-gold585-opal-18g.glb`,
    material: "Золото 585 · опал",
    gauge: "18G",
    size: "L-штифт",
    healing: "2–4 месяца",
    price: 5200,
  },
  {
    id: "septum",
    no: "06",
    name: "Септум",
    latin: "Septum nasi",
    position: [0, 1.53, 0.08224],
    flag: "left",
    body: "Прокол в эластичной зоне перегородки. Подкова-кольцо позволяет прятать украшение вверх. Один из самых быстрозаживающих хрящевых проколов.",
    glb: `${J}horseshoe-titanium-8mm-16g.glb`,
    material: "Титан ASTM F136",
    gauge: "16G",
    size: "8 мм · подкова",
    healing: "6–8 недель",
    price: 4100,
  },
  {
    id: "eyebrow",
    no: "07",
    name: "Бровь",
    latin: "Supercilium",
    position: [0.03, 1.598, 0.07104],
    flag: "right",
    body: "Поверхностный прокол по линии брови. Изогнутая штанга-банан повторяет рельеф и снижает риск миграции. Графичная, дерзкая деталь.",
    glb: `${J}curved-barbell-titanium-10mm-14g.glb`,
    material: "Титан ASTM F136",
    gauge: "14G",
    size: "10 мм · банан",
    healing: "2–3 месяца",
    price: 3400,
  },
  {
    id: "labret",
    no: "08",
    name: "Лабрет",
    latin: "Labretum",
    position: [0, 1.512, 0.072],
    flag: "left",
    body: "Прокол под нижней губой. Внутренняя плоская площадка бережёт эмаль и дёсны, снаружи — аккуратный шар или диск из розового золота.",
    glb: `${J}labret-rose-gold-585-disc-8mm-16g.glb`,
    material: "Золото 585 (розовое)",
    gauge: "16G",
    size: "8 мм · диск",
    healing: "2–3 месяца",
    price: 6100,
  },
  {
    id: "navel",
    no: "09",
    name: "Пупок",
    latin: "Umbilicus",
    position: [0, 1.055, 0.091],
    flag: "left",
    body: "Навель — изогнутая штанга по верхней складке пупка. Классика body-пирсинга. Требует терпения: полное заживление дольше, чем у уха.",
    glb: `${J}curved-barbell-gold585-12mm-14g.glb`,
    material: "Золото 585",
    gauge: "14G",
    size: "12 мм · банан",
    healing: "6–9 месяцев",
    price: 8200,
  },
];

/** Aftercare protocol — the clinical «уход / заживление» section. */
export interface CareStep {
  no: string;
  title: string;
  detail: string;
}

export const CARE_PROTOCOL: CareStep[] = [
  {
    no: "Ø1",
    title: "Стерильность",
    detail: "Одноразовая игла, перчатки, автоклав. Каждый инструмент вскрывается при тебе. Никаких пистолетов.",
  },
  {
    no: "Ø2",
    title: "Солевой раствор",
    detail: "Промывание изотоническим раствором 2 раза в день. Без спирта, перекиси и мазей — они сушат и тормозят заживление.",
  },
  {
    no: "Ø3",
    title: "Режим покоя",
    detail: "Не трогать, не крутить, не менять украшение до контрольного осмотра. Сон на здоровой стороне.",
  },
  {
    no: "Ø4",
    title: "Контроль",
    detail: "Бесплатный осмотр через 4 недели. Смена украшения и подбор постоянного — только после полного заживления.",
  },
];

/** Headline stats for the hero readout. */
export const ATLAS_STATS = [
  { value: "9", label: "зон в атласе" },
  { value: "F136", label: "имплант-титан" },
  { value: "585", label: "проба золота" },
  { value: "3D", label: "примерка онлайн" },
];

export const formatPrice = (rub: number) =>
  `${rub.toLocaleString("ru-RU")} ₽`;
