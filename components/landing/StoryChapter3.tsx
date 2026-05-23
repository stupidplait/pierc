import Link from "next/link";
import Image from "next/image";
import {
  type EquippedMap,
  type JewelryWire,
} from "@/lib/catalog/types";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

interface StoryChapter3Props {
  jewelry: JewelryWire[];
  equipped: EquippedMap;
}

export function StoryChapter3({ jewelry, equipped }: StoryChapter3Props) {
  const t = ru.pages.home.ch3;
  const equippedIds = Array.from(new Set(Object.values(equipped)));
  const equippedItems = equippedIds
    .map((id) => jewelry.find((j) => j.id === id))
    .filter((j): j is JewelryWire => Boolean(j));

  const bookHref =
    equippedItems.length > 0
      ? `/book?items=${encodeURIComponent(equippedItems.map((j) => j.id).join(","))}`
      : "/book";

  return (
    <section
      id="story-ch3"
      className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16 sm:px-8 sm:py-20"
    >
      <header className="max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">
          {t.eyebrow}
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium text-balance text-ink sm:text-5xl">
          {t.title}
        </h2>
        <p className="mt-3 text-balance text-mute">{t.lead}</p>
      </header>

      {equippedItems.length > 0 ? (
        <ul className="grid w-full max-w-md gap-3">
          {equippedItems.map((j) => (
            <li
              key={j.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card/40 p-3"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-card">
                {j.photo ? (
                  <Image
                    src={j.photo}
                    alt={j.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {j.name}
                </p>
                <p className="truncate text-xs text-mute">
                  {j.categoryName} · {formatPrice(j.price)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-md text-center text-mute">{t.skipNothing}</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href={bookHref}
          className="inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-on-primary transition-colors hover:bg-primary-soft"
        >
          {equippedItems.length > 0 ? t.cta : t.bookEmpty} →
        </Link>
        <Link
          href="/catalog"
          className="text-sm text-mute transition-colors hover:text-primary"
        >
          {ru.pages.home.hero.skipToCatalog}
        </Link>
      </div>
    </section>
  );
}
