import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import {
  type BookingPurpose,
  nextStep,
  previousStep,
  serializeBookingParams,
} from "@/lib/booking/url-state";
import { firstPhotoUrl, formatPrice } from "@/lib/jewelry/format";

interface JewelryStepProps {
  purpose: BookingPurpose;
  selectedIds: string[];
}

export async function JewelryStep({ purpose, selectedIds }: JewelryStepProps) {
  const jewelry = await prisma.jewelry.findMany({
    where: { status: "PUBLISHED" },
    include: { category: { select: { name: true } } },
    orderBy: [{ inStock: "desc" }, { updatedAt: "desc" }],
  });

  const t = ru.pages.book.jewelryStep;
  const back = previousStep("jewelry", purpose);
  const next = nextStep("jewelry", purpose);
  const selectedSet = new Set(selectedIds);

  return (
    <form method="get" action="/book" className="flex flex-col gap-6">
      {/* Carry purpose + step forward via hidden inputs. */}
      <input type="hidden" name="step" value={next ?? "contact"} />
      <input type="hidden" name="purpose" value={purpose} />

      <header>
        <h2 className="font-display text-2xl font-medium text-ink">
          {t.heading}
        </h2>
        <p className="mt-1 text-mute">{t.lead}</p>
      </header>

      {jewelry.length === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {jewelry.map((j) => {
            const photo = firstPhotoUrl(j.photos);
            const out = j.inStock <= 0;
            const checked = selectedSet.has(j.id);
            return (
              <li key={j.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-line bg-page hover:border-primary/40"
                  } ${out ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    name="items"
                    value={j.id}
                    defaultChecked={checked}
                    disabled={out}
                    className="size-5 rounded border-line text-primary focus:ring-primary"
                  />
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-card">
                    {photo ? (
                      <Image
                        src={photo}
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
                      {j.category.name} · {formatPrice(j.price)}
                      {out ? ` · ${t.outOfStock}` : ""}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {back ? (
          <Link
            href={`/book?${serializeBookingParams({
              step: back,
              purpose,
              itemIds: selectedIds,
            })}`}
            className="text-sm text-mute hover:text-primary"
          >
            ← {ru.pages.book.nav.back}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft"
        >
          {ru.pages.book.nav.next} →
        </button>
      </div>
    </form>
  );
}
