"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
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
import type { ComboboxOption } from "@/components/shadcn/Combobox";

/**
 * Multi-select combobox. Selected labels are joined with the catalog's display
 * separator (", ") into one hidden input so it round-trips with the existing
 * free-text `stones` column — no schema change. `allowCustom` lets a one-off
 * stone be added inline. The initial value is parsed back from the same
 * comma-joined string.
 */
const SEP = ", ";

export function MultiCombobox({
  name,
  options,
  defaultValue = "",
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  allowCustom = true,
  addLabel = "Добавить",
  id,
}: {
  name: string;
  options: ComboboxOption[];
  /** Comma-joined string, e.g. "Циркон, Опал". */
  defaultValue?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  addLabel?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [extra, setExtra] = React.useState<ComboboxOption[]>([]);
  const [selected, setSelected] = React.useState<string[]>(() =>
    (defaultValue ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const all = React.useMemo(() => {
    const base = [...options, ...extra];
    for (const v of selected) {
      if (!base.some((o) => o.value === v)) base.unshift({ value: v, label: v });
    }
    return base;
  }, [options, extra, selected]);

  const trimmed = query.trim();
  const canAdd =
    allowCustom &&
    trimmed.length > 0 &&
    !all.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  function toggle(v: string) {
    setSelected((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
    setQuery("");
  }

  function addCustom() {
    setExtra((p) => [...p, { value: trimmed, label: trimmed }]);
    setSelected((p) => [...p, trimmed]);
    setQuery("");
  }

  const labelFor = (v: string) => all.find((o) => o.value === v)?.label ?? v;

  return (
    <>
      <input type="hidden" name={name} value={selected.join(SEP)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            data-placeholder={selected.length === 0}
            className="h-auto min-h-11 w-full justify-between py-2 font-normal"
          >
            {selected.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : (
              <span className="flex flex-1 flex-wrap gap-1.5">
                {selected.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {labelFor(v)}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Убрать ${labelFor(v)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(v);
                      }}
                      className="rounded-sm text-mute transition-colors hover:text-ink"
                    >
                      <X className="size-3" />
                    </span>
                  </Badge>
                ))}
              </span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 self-center text-mute" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {!canAdd ? <CommandEmpty>{emptyText}</CommandEmpty> : null}
              <CommandGroup>
                {all.map((o) => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Check
                      className={
                        selected.includes(o.value)
                          ? "size-4 text-accent opacity-100"
                          : "size-4 text-accent opacity-0"
                      }
                    />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
                {canAdd ? (
                  <CommandItem value={trimmed} onSelect={addCustom}>
                    <Plus className="size-4 text-accent" />
                    <span className="truncate">
                      {addLabel}: «{trimmed}»
                    </span>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
