"use client";

import { createContext, useContext } from "react";

export interface SlotsContextValue {
  /** Open the planner drawer on the single-slot tab, prefilled for a cell. */
  requestQuickAdd: (dateKey: string, start?: string) => void;
}

const SlotsContext = createContext<SlotsContextValue | null>(null);

export const SlotsProvider = SlotsContext.Provider;

export function useSlots(): SlotsContextValue {
  const ctx = useContext(SlotsContext);
  if (!ctx) throw new Error("useSlots must be used within SlotsProvider");
  return ctx;
}
