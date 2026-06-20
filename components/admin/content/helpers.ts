import { FAQ_CATEGORIES } from "@/components/faq/faqData";
import { formatDuration } from "@/lib/jewelry/format";
import type {
  ServiceRow,
  FaqRow,
} from "@/lib/admin/content-view";
import type { ServiceInitial } from "./ServiceFormBody";
import type { FaqInitial } from "./FaqFormBody";

/**
 * Pure mappers shared by the content manager: row → form initial, plus the
 * compact summary strings shown in the list rows.
 */

const CATEGORY_LABEL = new Map(FAQ_CATEGORIES.map((c) => [c.key, c.label]));

export function serviceMeta(s: ServiceRow): string | undefined {
  return (
    [
      s.price ? `${s.price} ₽` : null,
      s.durationMin ? formatDuration(s.durationMin) : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}

export function toServiceInitial(s: ServiceRow): ServiceInitial {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    price: s.price,
    durationMin: s.durationMin,
    published: s.published,
  };
}

export function faqCategoryLabel(category: string | null): string | undefined {
  return category ? (CATEGORY_LABEL.get(category) ?? category) : undefined;
}

export function toFaqInitial(q: FaqRow): FaqInitial {
  return {
    id: q.id,
    question: q.question,
    answer: q.answer,
    category: q.category,
    published: q.published,
  };
}
