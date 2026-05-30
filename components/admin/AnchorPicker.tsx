"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/shadcn/ui/badge";
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

export interface AnchorChoice {
  id: string;
  name: string;
  /** Localised body-place group heading, e.g. "Уши". */
  place: string;
}

/**
 * Catalog anchor picker — a searchable, grouped multi-select that replaces the
 * old wall of checkboxes. Anchors are grouped by body place; picked ones show
 * as removable chips above the trigger. Selection order is preserved and
 * emitted as `anchorIds` hidden inputs in that order, which the server reads
 * with `getAll()` — so for "fixed" types (barbell, orbital…) the first chip is
 * the primary endpoint, the second the secondary, and so on. `ordered` turns on
 * the position numbers + drag-free reorder controls for those types.
 */
export function AnchorPicker({
  anchors,
  defaultSelected = [],
  ordered = false,
  searchPlaceholder = "Поиск по месту…",
  emptyText = "Ничего не найдено",
  placeholder = "Выберите места примерки",
  addMoreLabel = "Добавить ещё",
  onChange,
}: {
  anchors: AnchorChoice[];
  defaultSelected?: string[];
  ordered?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  placeholder?: string;
  addMoreLabel?: string;
  /** Fired with the new selection whenever the picked set or order changes. */
  onChange?: (selected: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(defaultSelected);

  const byId = React.useMemo(() => {
    const m = new Map<string, AnchorChoice>();
    for (const a of anchors) m.set(a.id, a);
    return m;
  }, [anchors]);

  // Stable group order = first appearance in the (pre-sorted) anchors list.
  const groups = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, AnchorChoice[]>();
    for (const a of anchors) {
      if (!map.has(a.place)) {
        map.set(a.place, []);
        order.push(a.place);
      }
      map.get(a.place)!.push(a);
    }
    return order.map((place) => ({ place, items: map.get(place)! }));
  }, [anchors]);

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    setSelected(next);
    onChange?.(next);
  }

  function move(id: string, dir: -1 | 1) {
    const i = selected.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
    onChange?.(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Submit order = selection order; server reads via getAll(). */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="anchorIds" value={id} />
      ))}

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((id, i) => {
            const a = byId.get(id);
            return (
              <li key={id}>
                <Badge variant="accent" className="gap-1.5 py-1 pl-2.5 pr-1.5 text-sm">
                  {ordered ? (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold tabular-nums">
                      {i + 1}
                    </span>
                  ) : null}
                  <span>{a?.name ?? id}</span>
                  {ordered && selected.length > 1 ? (
                    <span className="ml-0.5 inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Выше в порядке"
                        disabled={i === 0}
                        onClick={() => move(id, -1)}
                        className="px-0.5 leading-none text-accent/70 transition-colors hover:text-accent disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Ниже в порядке"
                        disabled={i === selected.length - 1}
                        onClick={() => move(id, 1)}
                        className="px-0.5 leading-none text-accent/70 transition-colors hover:text-accent disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Убрать ${a?.name ?? ""}`}
                    onClick={() => toggle(id)}
                    className="rounded-sm text-accent/70 transition-colors hover:text-accent"
                  >
                    <X className="size-3.5" />
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-placeholder={selected.length === 0}
            className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors hover:border-ink/35 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 data-[placeholder=true]:text-mute"
          >
            <Plus className="size-4 text-mute" />
            {selected.length === 0 ? placeholder : addMoreLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.place} heading={g.place}>
                  {g.items.map((a) => {
                    const isSel = selected.includes(a.id);
                    return (
                      <CommandItem
                        key={a.id}
                        value={`${g.place} ${a.name}`}
                        onSelect={() => toggle(a.id)}
                      >
                        <Check
                          className={cn(
                            "size-4 text-accent",
                            isSel ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{a.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
