import Link from "next/link";
import { Showroom } from "@/components/catalog/Showroom";
import {
  type AnchorWire,
  type EquippedMap,
  type JewelryWire,
} from "@/lib/catalog/types";
import { ru } from "@/lib/i18n/ru";

interface StoryChapter2Props {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  initialEquipped: EquippedMap;
}

export function StoryChapter2({
  anchors,
  jewelry,
  initialEquipped,
}: StoryChapter2Props) {
  const t = ru.pages.home.ch2;
  return (
    <section
      id="story-ch2"
      className="flex min-h-screen flex-col gap-6 px-6 py-12 sm:px-8 sm:py-16"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">
          {t.eyebrow}
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium text-balance text-ink sm:text-5xl">
          {t.title}
        </h2>
        <p className="mt-3 text-balance text-mute">{t.lead}</p>
      </header>

      <div className="h-[80vh] overflow-hidden rounded-3xl border border-line">
        <Showroom
          anchors={anchors}
          jewelry={jewelry}
          initialSelectedId={null}
          initialEquipped={initialEquipped}
          pathname="/"
          hideGridLink
        />
      </div>

      <footer className="mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
        <a
          href="#story-ch3"
          className="inline-flex h-11 items-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft"
        >
          {t.next} →
        </a>
        <Link
          href="/catalog"
          className="text-mute transition-colors hover:text-primary"
        >
          {t.skip}
        </Link>
      </footer>
    </section>
  );
}
