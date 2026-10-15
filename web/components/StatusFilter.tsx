"use client";

import { useEffect, useRef, useState } from "react";

import type { FreshnessStatus } from "@/lib/api";

/**
 * The freshness page's counts, as filters (2026-10-15): pressing one shows only the sources
 * with that status, and the total shows them all again. The table stays server-rendered;
 * this only sets `data-filter` on the page, which the stylesheet reads, so with scripts off
 * every source is still listed.
 */
export function StatusFilter({ total, counts }: { total: number; counts: { status: FreshnessStatus; label: string; count: number }[] }) {
  const [filter, setFilter] = useState<FreshnessStatus | null>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const main = list.current?.closest("main");
    if (!main) return;
    if (filter) main.dataset.filter = filter;
    else delete main.dataset.filter;
  }, [filter]);
  return (
    <ul ref={list} className="data-tally" aria-label="Filter sources by status">
      <li data-status="all"><button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}><b>{total}</b> sources</button></li>
      {counts.map(({ status, label, count }) => (
        <li key={status} data-status={status}>
          <button type="button" aria-pressed={filter === status} onClick={() => setFilter(filter === status ? null : status)}><b>{count}</b> {label}</button>
        </li>
      ))}
    </ul>
  );
}
