/**
 * «ОСТРИЁ» content roster.
 *
 * Russian editorial copy + the jewelry rail items, modelled on the real catalog
 * vocabulary (Титан ASTM F136, Золото 585, gauge, мм). Prices are invented
 * pre-launch placeholders. Kept as plain data so the Experience stays declarative.
 */

export interface RailItem {
  /** 2-digit index shown in the corner of the card. */
  no: string;
  /** Product name (Russian, uppercase-friendly). */
  name: string;
  /** Category chip. */
  tag: string;
  /** Material line. */
  material: string;
  /** Gauge, e.g. "14G". */
  gauge: string;
  /** Size, e.g. "12 мм". */
  size: string;
  /** Price label (₽). */
  price: string;
}

export const RAIL_ITEMS: RailItem[] = [
  {
    no: "01",
    name: "Лабрет «Опал»",
    tag: "Хеликс / лоб",
    material: "Титан ASTM F136",
    gauge: "16G",
    size: "6 мм",
    price: "3 200 ₽",
  },
  {
    no: "02",
    name: "Кольцо-сегмент",
    tag: "Септум / хеликс",
    material: "Титан G23",
    gauge: "16G",
    size: "8 мм",
    price: "2 900 ₽",
  },
  {
    no: "03",
    name: "Изогнутая штанга",
    tag: "Бровь / индастриал",
    material: "Золото 585",
    gauge: "14G",
    size: "12 мм",
    price: "9 400 ₽",
  },
  {
    no: "04",
    name: "Нострила «Опал»",
    tag: "Крыло носа",
    material: "Золото 585",
    gauge: "18G",
    size: "L-форма",
    price: "5 600 ₽",
  },
  {
    no: "05",
    name: "Подкова",
    tag: "Септум / хеликс",
    material: "Титан с PVD",
    gauge: "16G",
    size: "8 мм",
    price: "3 100 ₽",
  },
  {
    no: "06",
    name: "Лабрет «Диск»",
    tag: "Лоб / монро",
    material: "Розовое золото 585",
    gauge: "16G",
    size: "8 мм",
    price: "6 800 ₽",
  },
  {
    no: "07",
    name: "Прямая штанга",
    tag: "Индастриал / язык",
    material: "Хирургическая сталь",
    gauge: "14G",
    size: "16 мм",
    price: "2 400 ₽",
  },
  {
    no: "08",
    name: "Хеликс-гвоздик",
    tag: "Хеликс / трагус",
    material: "Титан · синий гем",
    gauge: "18G",
    size: "6 мм",
    price: "3 900 ₽",
  },
];

/** Running-marquee words — the brand's vocabulary as a kinetic strip. */
export const MARQUEE_TOP = [
  "ТИТАН ASTM F136",
  "ЗОЛОТО 585",
  "СЕПТУМ",
  "ХЕЛИКС",
  "ИНДАСТРИАЛ",
  "ЛАБРЕТ",
  "3D-ПРИМЕРКА",
  "СТЕРИЛЬНО",
];

export const MARQUEE_BOTTOM = [
  "ЗАПИСАТЬСЯ",
  "КАЗАНЬ",
  "ТОЧНОСТЬ",
  "КОЛЬЦО-СЕГМЕНТ",
  "ХИРУРГИЧЕСКАЯ СТАЛЬ",
  "GAUGE",
  "ОСТРИЁ",
  "СКОРО ОТКРЫТИЕ",
];

export interface ProcessStep {
  no: string;
  title: string;
  accent: string;
  body: string;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    no: "01",
    title: "Выбери",
    accent: "украшение",
    body: "Каталог из титана ASTM F136 и золота 585. Каждая позиция — с точным gauge, длиной и материалом. Без компромиссов по качеству.",
  },
  {
    no: "02",
    title: "Примерь",
    accent: "в 3D",
    body: "Наша фишка: примерь украшение на 3D-модели до прокола. Увидь, как штанга или кольцо сядут именно на твоей анатомии.",
  },
  {
    no: "03",
    title: "Забронируй",
    accent: "время",
    body: "Выбери мастера и слот онлайн. Стерильный кабинет, одноразовый инструмент, сопровождение всего периода заживления.",
  },
];

export interface StatItem {
  num: string;
  accent?: string;
  label: string;
}

export const STATS: StatItem[] = [
  { num: "F136", label: "имплантационный титан" },
  { num: "585", label: "проба золота" },
  { num: "3D", accent: "•", label: "примерка до прокола" },
  { num: "100", accent: "%", label: "стерильный протокол" },
];
