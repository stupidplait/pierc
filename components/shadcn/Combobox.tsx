"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
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

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Single-select combobox that submits as a native form field via a hidden
 * `<input name>`. Type-to-filter over `options`; when `allowCustom` is set, a
 * value the admin types that isn't in the list can be added on the fly (the
 * catalog uses this for material/colour so a one-off finish isn't blocked by
 * the curated list).
 */
export function Combobox({
  name,
  options,
  defaultValue = "",
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  allowCustom = false,
  addLabel = "Добавить",
  id,
  invalid = false,
  onChange,
}: {
  name: string;
  options: ComboboxOption[];
  defaultValue?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  addLabel?: string;
  id?: string;
  /** Paints the trigger with the error ring; pair with an external message. */
  invalid?: boolean;
  /** Fired with the committed value whenever the selection changes. */
  onChange?: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Custom values typed by the admin are appended so they render + stay
  // selected just like the curated ones.
  const [extra, setExtra] = React.useState<ComboboxOption[]>([]);
  const [value, setValue] = React.useState<string>(defaultValue ?? "");

  const all = React.useMemo(() => {
    const base = [...options, ...extra];
    // Preserve a pre-existing value that isn't in the curated list (legacy row).
    if (value && !base.some((o) => o.value === value)) {
      base.unshift({ value, label: value });
    }
    return base;
  }, [options, extra, value]);

  const selected = all.find((o) => o.value === value);
  const trimmed = query.trim();
  const canAdd =
    allowCustom &&
    trimmed.length > 0 &&
    !all.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  function commit(next: string) {
    setValue(next);
    setOpen(false);
    setQuery("");
    onChange?.(next);
  }

  function addCustom() {
    setExtra((p) => [...p, { value: trimmed, label: trimmed }]);
    commit(trimmed);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            data-placeholder={!selected}
            className="w-full justify-between font-normal aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/30"
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-mute" />
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
                  <CommandItem key={o.value} value={o.label} onSelect={() => commit(o.value)}>
                    <Check
                      className={cn(
                        "size-4 text-accent",
                        value === o.value ? "opacity-100" : "opacity-0",
                      )}
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
