"use client";

import { useActionState } from "react";
import {
  adjustJewelryStock,
  type StockAdjustState,
} from "@/lib/admin/jewelry-stock-action";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";
import { ru } from "@/lib/i18n/ru";

interface Props {
  jewelryId: string;
  stock: number;
  /** Tick the count up from 0 on first paint (the catalog's entrance). */
  countOnMount?: boolean;
}

export function StockAdjuster({ jewelryId, stock, countOnMount }: Props) {
  const [, action, pending] = useActionState<StockAdjustState, FormData>(
    adjustJewelryStock,
    undefined,
  );
  const t = ru.admin.jewelry;

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={jewelryId} />
      <button
        type="submit"
        name="delta"
        value="-1"
        disabled={pending || stock <= 0}
        title={t.stockMinus}
        className="inline-flex size-7 items-center justify-center rounded-lg border border-ink/15 text-xs font-semibold text-mute transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
        onClick={(e) => e.stopPropagation()}
      >
        −
      </button>
      <AnimatedNumber
        value={stock}
        countOnMount={countOnMount}
        className="min-w-10 text-center text-sm font-medium text-ink tabular-nums"
      />
      <button
        type="submit"
        name="delta"
        value="1"
        disabled={pending}
        title={t.stockPlus}
        className="inline-flex size-7 items-center justify-center rounded-lg border border-ink/15 text-xs font-semibold text-mute transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
        onClick={(e) => e.stopPropagation()}
      >
        +
      </button>
    </form>
  );
}
