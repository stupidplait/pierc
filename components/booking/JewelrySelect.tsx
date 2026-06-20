"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import type { WizardJewelry } from "@/lib/booking/wizard-types";

interface JewelrySelectProps {
  jewelry: WizardJewelry[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

// Searchable jewelry picker. Keeps the choice visual (a dropdown of names would
// throw away the photos that drive the decision): a search input opens a panel
// of thumbnail rows, and chosen pieces appear as small thumbnail chips above it.
// Out-of-stock pieces are disabled, matching the old wizard grid.
export function JewelrySelect({
  jewelry,
  selected,
  onToggle,
}: JewelrySelectProps) {
  const t = ru.pages.book.form;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q
    ? jewelry.filter((j) => j.name.toLowerCase().includes(q))
    : jewelry;
  const chosen = jewelry.filter((j) => selected.has(j.id));

  // Close the panel on outside-click / Escape. Listener registered in the
  // effect (not run synchronously in its body) per the project's lint rules.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {/* Selected chips */}
      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((j) => (
            <li key={j.id}>
              <span className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 py-1 pl-1 pr-2">
                <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-page">
                  {j.photo ? (
                    <Image
                      src={j.photo}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="max-w-32 truncate text-sm text-ink">
                  {j.name}
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(j.id)}
                  aria-label={`${t.jewelryRemove}: ${j.name}`}
                  className="-m-2 flex size-8 items-center justify-center rounded-full p-2 text-mute transition-colors hover:text-ink"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">{t.jewelryChosenEmpty}</p>
      )}

      {/* Search + panel */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          aria-label={t.jewelrySearch}
          placeholder={t.jewelrySearch}
          className="h-11 w-full rounded-xl border border-line bg-card px-4 text-ink outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />

        {open ? (
          <ul className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 flex max-h-72 flex-col overflow-y-auto overscroll-contain rounded-xl border border-line bg-page p-1 shadow-elev-overlay">
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-sm text-mute">{t.jewelryEmpty}</li>
            ) : (
              matches.map((j) => {
                const out = j.inStock <= 0;
                const isSel = selected.has(j.id);
                return (
                  <li key={j.id}>
                    <button
                      type="button"
                      disabled={out}
                      onClick={() => onToggle(j.id)}
                      aria-pressed={isSel}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSel ? "bg-card" : ""
                      }`}
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-page">
                        {j.photo ? (
                          <Image
                            src={j.photo}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {j.name}
                        </span>
                        <span className="block font-mono text-xs text-mute tabular-nums">
                          {formatPrice(j.price)}
                          {out
                            ? ` · ${ru.pages.book.jewelryStep.outOfStock}`
                            : ""}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSel
                            ? "border-primary bg-primary text-on-primary"
                            : "border-line text-transparent"
                        }`}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M3.5 8.5l3 3 6-6.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
