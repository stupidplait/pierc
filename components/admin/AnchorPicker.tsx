"use client";

import * as React from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
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

// True only after the first (hydration) render. The selected-anchor
// AnimatePresence is gated behind `selected.length > 0`, so it mounts the
// moment the first anchor is picked — and `initial={false}` would suppress that
// first enter, making the first chip/group pop in statically while every later
// one animates. Feeding this flag to `initial` keeps the page-load case static
// (no pop-in for anchors already selected in the edit view, where this is false
// on the first render) yet animates the first user-picked anchor (by then true).
// useSyncExternalStore — not useEffect+setState — to satisfy the react-hooks lint.
const emptySubscribe = () => () => {};
function useHasMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
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
  const hasMounted = useHasMounted();

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

  // Selected anchors bucketed under their body-place heading (Уши / Нос / …) so
  // a long compat-list reads as tidy sections instead of one flowing wrap.
  // Group order follows selection order (first place picked appears first).
  const selectedGroups = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, string[]>();
    for (const id of selected) {
      const place = byId.get(id)?.place ?? "—";
      if (!map.has(place)) {
        map.set(place, []);
        order.push(place);
      }
      map.get(place)!.push(id);
    }
    return order.map((place) => ({ place, ids: map.get(place)! }));
  }, [selected, byId]);

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

  // One selected-anchor chip. `i` is the position in the full selection (used
  // for the order badge + reorder bounds on fixed types). Each chip pops in/out
  // and slides on reorder via `layout` — wrapped in an AnimatePresence below.
  const renderChip = (id: string, i: number) => {
    const a = byId.get(id);
    return (
      <motion.li
        key={id}
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.18 }}
      >
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
      </motion.li>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-3">
        {/* Submit order = selection order; server reads via getAll(). */}
        {selected.map((id) => (
          <input key={id} type="hidden" name="anchorIds" value={id} />
        ))}

        {selected.length > 0 ? (
          ordered ? (
            // Fixed types: order is the whole point — keep one flat ordered row
            // with position numbers + reorder controls.
            <ul className="flex flex-wrap gap-2">
              <AnimatePresence initial={hasMounted} mode="popLayout">
                {selected.map((id, i) => renderChip(id, i))}
              </AnimatePresence>
            </ul>
          ) : (
            // Compat types: split the selection into body-place sections. Each
            // section collapses out when its last anchor is removed.
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={hasMounted} mode="popLayout">
                {selectedGroups.map((g) => (
                  <motion.div
                    key={g.place}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">
                      {g.place}
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      <AnimatePresence initial={false} mode="popLayout">
                        {g.ids.map((id) =>
                          renderChip(id, selected.indexOf(id)),
                        )}
                      </AnimatePresence>
                    </ul>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
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
    </MotionConfig>
  );
}
