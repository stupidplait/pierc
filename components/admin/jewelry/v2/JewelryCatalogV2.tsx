"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CARD } from "@/components/admin/form/styles";
import type { JewelryStatus } from "../types";
import { Toolbar } from "./Toolbar";
import { StatusTabs } from "./StatusTabs";
import { JewelryBoardV2, type JewelryRow } from "./Board";
import { BoardSkeletonV2 } from "./BoardSkeleton";

/**
 * Catalog orchestrator — the single client island the page renders. Owns the
 * filter→URL navigation (every control is a scroll-preserving `router.replace`
 * in a transition; `isPending` swaps the list for the skeleton) wired to the
 * responsive board children. Fully responsive from 320px.
 */
export function JewelryCatalogV2({
  q,
  categoryIds,
  status,
  featured,
  lowStock,
  categories,
  counts,
  total,
  rows,
}: {
  q: string;
  categoryIds: string[];
  status: JewelryStatus | "";
  featured: boolean;
  lowStock: boolean;
  categories: { id: string; name: string }[];
  counts: Record<JewelryStatus, number>;
  total: number;
  rows: JewelryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [hasInteracted, setHasInteracted] = useState(false);

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      if (qs === searchParams.toString()) return;
      setHasInteracted(true);
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const setParam = useCallback(
    (key: string, value: string) =>
      navigate((p) => {
        if (value) p.set(key, value);
        else p.delete(key);
      }),
    [navigate],
  );

  const setMulti = useCallback(
    (key: string, values: string[]) =>
      navigate((p) => {
        if (values.length) p.set(key, values.join(","));
        else p.delete(key);
      }),
    [navigate],
  );

  const clearAll = useCallback(() => {
    setHasInteracted(true);
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  const hasFilters = Boolean(
    q || categoryIds.length || status || featured || lowStock,
  );

  const animateIn = !hasInteracted && !isPending;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Toolbar
        q={q}
        categoryIds={categoryIds}
        featured={featured}
        lowStock={lowStock}
        categories={categories}
        hasFilters={hasFilters}
        setParam={setParam}
        setMulti={setMulti}
        clearAll={clearAll}
      />

      <motion.div
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`${CARD} overflow-hidden`}
      >
        <StatusTabs
          status={status}
          counts={counts}
          total={total}
          animateIn={animateIn}
          onSelect={(s) => setParam("status", s)}
        />
        <AnimatedHeight>
          {isPending ? (
            <BoardSkeletonV2 count={rows.length || 6} />
          ) : (
            <JewelryBoardV2 rows={rows} animateIn={animateIn} />
          )}
        </AnimatedHeight>
      </motion.div>
    </div>
  );
}

/**
 * Animates its own height to fit its content as that content changes — a plain
 * CSS height transition driven by a ResizeObserver (no transform scaling, so no
 * row-jumping). Height is written imperatively in the observer (no re-render per
 * resize). Honours reduced motion; the first measurement (from auto) doesn't
 * transition.
 */
function AnimatedHeight({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const observer = new ResizeObserver(() => {
      outer.style.height = `${inner.offsetHeight}px`;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="overflow-hidden transition-[height] duration-400 ease-in-out motion-reduce:transition-none"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
