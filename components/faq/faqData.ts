// Pure, client-safe FAQ helpers. No Prisma / server-only imports here — the
// scroll-spy client island (FaqContent) imports from this module, so it
// must stay free of `next/server` and `@/lib/prisma`.
//
// `FAQItem.category` (a nullable key like "prep") is the source of truth for
// grouping. Rows without a key fall back to a keyword classifier, so the page
// still groups sensibly before/without a backfill.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** Stored category key; null/absent → classified by keywords at render. */
  categoryKey?: string | null;
}

export interface FaqCategory {
  key: string;
  /** Display label (ru). */
  label: string;
  /** One-line description used as a rail caption / section eyebrow. */
  blurb: string;
  /** Lowercase substrings used to classify rows that lack a key. */
  keywords: string[];
}

export interface FaqGroup {
  category: FaqCategory;
  items: FaqItem[];
}

// Ordered category set. This order is the order sections / rail entries appear
// in. Keywords only matter for rows that have no stored `category`.
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    key: "prep",
    label: "Подготовка",
    blurb: "Перед визитом",
    keywords: [
      "подготов",
      "поешь",
      "поесть",
      "алкогол",
      "возраст",
      "противопоказ",
      "натощак",
    ],
  },
  {
    key: "procedure",
    label: "Процедура",
    blurb: "Как проходит сеанс",
    keywords: [
      "больно",
      "боль",
      "щипок",
      "игл",
      "стерил",
      "автоклав",
      "сеанс",
      "длит",
      "анестез",
    ],
  },
  {
    key: "healing",
    label: "Заживление",
    blurb: "Сроки и этапы",
    keywords: ["заживл", "зажив", "отёк", "отек", "покрасн", "сукровиц"],
  },
  {
    key: "care",
    label: "Уход",
    blurb: "После прокола",
    keywords: [
      "уход",
      "ухажив",
      "промыв",
      "солев",
      "раствор",
      "мирамистин",
      "трогать",
      "прокручив",
      "купан",
      "бассейн",
      "спорт",
    ],
  },
  {
    key: "materials",
    label: "Материалы",
    blurb: "Металлы и украшения",
    keywords: [
      "металл",
      "титан",
      "сталь",
      "золот",
      "никел",
      "аллерг",
      "имплант",
      "проб",
      "украшен",
    ],
  },
  {
    key: "booking",
    label: "Запись",
    blurb: "Запись и оплата",
    keywords: ["запис", "предоплат", "оплат", "перенест", "отмен", "цена", "стоимост"],
  },
];

// Catch-all for rows that match no category. Never advertised in keywords.
export const OTHER_CATEGORY: FaqCategory = {
  key: "other",
  label: "Другое",
  blurb: "Прочие вопросы",
  keywords: [],
};

// Includes OTHER_CATEGORY so a row with a stored "other" key still renders under
// "Другое". Note the deliberate asymmetry with isFaqCategoryKey() below, which
// EXCLUDES "other": the admin picker never offers it and the save path stores
// null for it, so a persisted "other" key can only arise from a manual DB edit —
// and when it does, it groups harmlessly here.
const CATEGORY_BY_KEY = new Map<string, FaqCategory>(
  [...FAQ_CATEGORIES, OTHER_CATEGORY].map((c) => [c.key, c]),
);

/** True if `key` is a known, selectable category (excludes the "other" sink). */
export function isFaqCategoryKey(key: string): boolean {
  return FAQ_CATEGORIES.some((c) => c.key === key);
}

// Best-effort classification for rows without a stored key: first category
// whose any keyword is a substring of (question + answer), lowercased. Returns
// the "other" key when nothing matches. Used at render time and by the backfill.
export function suggestCategoryKey(item: {
  question: string;
  answer: string;
}): string {
  const haystack = `${item.question} ${item.answer}`.toLowerCase();
  for (const cat of FAQ_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (haystack.includes(kw)) return cat.key;
    }
  }
  return OTHER_CATEGORY.key;
}

// Group items into ordered, non-empty categories. A stored, valid `categoryKey`
// wins; otherwise the item is classified by keywords. Item order within a group
// is preserved from the input. "Другое" is only appended when something lands
// there.
export function categorizeFaq(items: FaqItem[]): FaqGroup[] {
  const buckets = new Map<string, FaqItem[]>();
  for (const item of items) {
    const key =
      item.categoryKey && CATEGORY_BY_KEY.has(item.categoryKey)
        ? item.categoryKey
        : suggestCategoryKey(item);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const groups: FaqGroup[] = [];
  for (const cat of FAQ_CATEGORIES) {
    const list = buckets.get(cat.key);
    if (list && list.length > 0) groups.push({ category: cat, items: list });
  }
  const other = buckets.get(OTHER_CATEGORY.key);
  if (other && other.length > 0)
    groups.push({ category: OTHER_CATEGORY, items: other });

  return groups;
}
