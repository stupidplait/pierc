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
import { JewelryFilters, type JewelryStatus } from "./JewelryFilters";
import { JewelryList, type JewelryRow } from "./JewelryBoard";
import { JewelryListSkeleton } from "./JewelryBoardSkeleton";
import { StatusTabs } from "./StatusFilter";

/**
 * Catalog orchestrator — the single client island the server page renders. It
 * owns the filter→URL navigation (every control is a scroll-preserving
 * `router.replace` inside a transition) and the transition's `isPending`: while
 * a search/filter is in flight it swaps the list for the board skeleton, giving
 * loading feedback instead of a silently-stale list. Filters and the status
 * tabs stay live throughout.
 *
 * The list area sits in an `AnimatedHeight` wrapper so the card grows/shrinks
 * smoothly with the row count. The pending skeleton renders the *same* number of
 * rows as the outgoing list, so entering the loading state doesn't move the
 * height — only real result changes animate.
 */
export function JewelryCatalog({
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

  // The staggered blur-reveal is a first-impression flourish. Once the admin
  // touches a filter, updates swap skeleton → list without re-cascading every
  // row (set in the handlers below — never a ref/effect, per the strict
  // react-hooks lint).
  const [hasInteracted, setHasInteracted] = useState(false);

  // All filter writes funnel through here: clone the current params, mutate,
  // and replace inside a transition so `isPending` drives the skeleton.
  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      // Re-clicking the active tab (or any control that lands on the same query)
      // would otherwise fire a transition that refetches identical rows — the
      // skeleton flashes while the same data comes back. Bail when nothing moved.
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
    <div className="flex flex-col gap-8">
      <JewelryFilters
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

      {/* Same blur-rise as the toolbar above, so the list-with-tabs card enters
          as one cohesive unit with the rest of the page rather than popping in.
          Fires once on mount (initial → animate); filter updates don't re-run it,
          they swap the skeleton inside. The genuine first-paint row stagger still
          cascades within this card. */}
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
            <JewelryListSkeleton count={rows.length || 6} />
          ) : (
            <JewelryList rows={rows} animateIn={animateIn} />
          )}
        </AnimatedHeight>
      </motion.div>
    </div>
  );
}

/**
 * Animates its own height to fit its content as that content's height changes —
 * a plain CSS `height` transition driven by a ResizeObserver, so the card grows
 * and shrinks smoothly with no transform scaling (and therefore none of the
 * row-jumping that framer's `layout` produced). The height is written
 * imperatively in the observer callback (no inline style, no re-render per
 * resize). Honours reduced motion via the `motion-reduce:transition-none`
 * variant. The first measurement sets height from `auto`, which doesn't
 * transition — so the first paint never animates.
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
