"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ru } from "@/lib/i18n/ru";
import { formatDuration, formatPrice } from "@/lib/jewelry/format";
import type { WizardService } from "@/lib/booking/wizard-types";

interface ServiceSelectProps {
  services: WizardService[];
  value: string | null;
  onChange: (id: string) => void;
}

// Single-select combobox for services. A button trigger opens an absolutely
// positioned panel with a filter input + scrollable option list. Built from
// native elements (no headless lib in the project) following the Drawer's
// outside-click/Escape listener pattern — the listener calls setState from an
// event callback, which the strict react-hooks lint allows (only synchronous
// set-state in the effect *body* is banned).
export function ServiceSelect({ services, value, onChange }: ServiceSelectProps) {
  const t = ru.pages.book.form;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = services.find((s) => s.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? services.filter((s) => s.name.toLowerCase().includes(q))
    : services;

  // Close on outside-click / Escape while open. Registered here (not run in the
  // body) so no set-state happens during the effect itself.
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

  const openPanel = () => {
    setOpen(true);
    setQuery("");
    setActive(0);
  };
  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[active] ?? matches[0];
      if (pick) choose(pick.id);
    }
  };

  const triggerCls =
    "flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 text-left text-ink outline-none transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={triggerCls}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {selected.name}
            </span>
            <span className="shrink-0 font-mono text-sm text-mute tabular-nums">
              {formatPrice(selected.price)}
            </span>
          </span>
        ) : (
          <span className="text-sm text-mute">{t.servicePlaceholder}</span>
        )}
        <span aria-hidden="true" className="shrink-0 text-mute">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 flex max-h-72 flex-col overflow-hidden rounded-xl border border-line bg-page shadow-elev-overlay">
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                matches.length > 0 ? optionId(active) : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              aria-label={t.serviceSearch}
              placeholder={t.serviceSearch}
              className="h-9 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={t.servicePlaceholder}
            className="flex-1 overflow-y-auto overscroll-contain p-1"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-sm text-mute">{t.serviceEmpty}</li>
            ) : (
              matches.map((s, i) => {
                const isSel = s.id === value;
                const isActive = i === active;
                return (
                  <li key={s.id} role="presentation">
                    <button
                      type="button"
                      id={optionId(i)}
                      role="option"
                      aria-selected={isSel}
                      onClick={() => choose(s.id)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isActive ? "bg-card" : ""
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-ink">
                            {s.name}
                          </span>
                          <span className="shrink-0 font-mono text-sm font-medium text-ink tabular-nums">
                            {formatPrice(s.price)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-mute">
                            {formatDuration(s.durationMin)}
                          </span>
                          {s.description ? (
                            <span className="truncate text-xs text-mute">
                              {s.description}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSel
                            ? "border-primary bg-primary text-on-primary"
                            : "border-transparent text-transparent"
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
        </div>
      ) : null}
    </div>
  );
}
