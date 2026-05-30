"use client";

import { useActionState } from "react";
import {
  adjustJewelryStock,
  type StockAdjustState,
} from "@/lib/admin/jewelry-stock-action";
import { ru } from "@/lib/i18n/ru";

interface Props {
  jewelryId: string;
  stock: number;
}

export function StockAdjuster({ jewelryId, stock }: Props) {
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
        className="inline-flex size-7 items-center justify-center rounded-full border border-ink/15 text-xs font-semibold text-mute transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
        onClick={(e) => e.stopPropagation()}
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-medium text-ink tabular-nums">
        {stock}
      </span>
      <button
        type="submit"
        name="delta"
        value="1"
        disabled={pending}
        title={t.stockPlus}
        className="inline-flex size-7 items-center justify-center rounded-full border border-ink/15 text-xs font-semibold text-mute transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
        onClick={(e) => e.stopPropagation()}
      >
        +
      </button>
    </form>
  );
}
