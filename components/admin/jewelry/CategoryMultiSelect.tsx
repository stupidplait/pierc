"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shadcn/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/ui/popover";

interface Category {
  id: string;
  name: string;
}

/**
 * Catalog category filter — a searchable multi-select (combobox + checkmarks),
 * replacing the old single Radix Select so the admin can scope the list to
 * several categories at once. Same footprint/styling as the form Select
 * triggers; selection is driven by the parent (which writes a comma-joined
 * `category` URL param), so this stays a controlled presentational control.
 * Mirrors the Popover+Command pattern already used by AnchorPicker.
 */
export function CategoryMultiSelect({
  categories,
  selected,
  onChange,
  wrapperClassName,
  triggerClassName,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Optional override for the outer relative wrapper (e.g. flex-1 on mobile). */
  wrapperClassName?: string;
  /** Optional override for the trigger button (e.g. shrink to fill on mobile). */
  triggerClassName?: string;
}) {
  const t = ru.admin.jewelry;
  const [open, setOpen] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(id: string) {
    onChange(
      selectedSet.has(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  // One selection → show its name; many → keep the neutral label + a count chip.
  const soleName =
    selected.length === 1
      ? (categories.find((c) => c.id === selected[0])?.name ?? null)
      : null;
  const triggerLabel = soleName ?? t.categoryLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The count chip doubles as the clear control — it can't be nested inside
          the trigger <button>, so it sits in an overlay alongside the chevron:
          the chip catches its own clicks (clears), the chevron is click-through
          to the trigger (opens), and the rest of the trigger opens too. */}
      <div className={cn("relative inline-flex", wrapperClassName)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t.categoryLabel}
            data-placeholder={selected.length === 0}
            className={cn(
              "flex h-11 w-auto min-w-40 items-center rounded-xl border border-ink/15 bg-ink/3 pl-3.5 pr-14 text-sm text-ink outline-none transition-colors hover:border-ink/35 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 data-[placeholder=true]:text-mute",
              triggerClassName,
            )}
          >
            <span className="truncate">{triggerLabel}</span>
          </button>
        </PopoverTrigger>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5">
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              aria-label={`${t.clear}: ${t.categoryLabel}`}
              className="group/clr pointer-events-auto inline-flex size-5 items-center justify-center rounded-full bg-ink/10 text-xs font-medium tabular-nums text-ink transition-colors hover:bg-error/15 hover:text-error"
            >
              <span className="group-hover/clr:hidden">{selected.length}</span>
              <X className="hidden size-3 group-hover/clr:block" />
            </button>
          ) : null}
          <ChevronDown className="size-4 text-mute" />
        </div>
      </div>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t.pickers.search} />
          <CommandList>
            <CommandEmpty>{t.pickers.empty}</CommandEmpty>
            <CommandGroup>
              {categories.map((c) => {
                const isSel = selectedSet.has(c.id);
                return (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => toggle(c.id)}
                  >
                    <Check
                      className={cn(
                        "size-4 text-accent",
                        isSel ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{c.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
