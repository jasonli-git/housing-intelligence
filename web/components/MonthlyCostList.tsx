"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StackedBars, type Part } from "@/components/StackedBars";
import { formatValue } from "@/lib/format";
import { regionPath } from "@/lib/placeRoutes";
import type { MonthlyCost } from "@/lib/stories";

export type CostRow = { id: number; name: string; county: string; cost: MonthlyCost };

const PARTS: Part[] = [
  { key: "mortgage", label: "Mortgage" },
  { key: "tax", label: "Property tax" },
  { key: "insurance", label: "Insurance" },
  { key: "electricity", label: "Electricity" },
  { key: "gas", label: "Gas" },
  { key: "water", label: "Water and sewer" },
];
const usd = (v: number) => formatValue(v, "usd");
const total = (c: MonthlyCost) => c.mortgage + c.tax + c.insurance + c.electricity + c.gas + c.water;
/** Everything but the mortgage: what a month costs even with the loan paid off. */
const running = (c: MonthlyCost) => total(c) - c.mortgage;

/** Every town's typical month, stacked, ordered by the whole or by the share that is not the loan. */
export function MonthlyCostList({ rows, counties }: { rows: CostRow[]; counties: string[] }) {
  const [county, setCounty] = useState("");
  const [order, setOrder] = useState<"total" | "running">("running");
  const shown = useMemo(
    () => rows.filter((r) => !county || r.county === county).sort((a, b) => (order === "total" ? total(b.cost) - total(a.cost) : running(b.cost) / total(b.cost) - running(a.cost) / total(a.cost))),
    [rows, county, order],
  );
  return (
    <>
      <div className="ladder-controls">
        <label>County
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="">All of New Jersey</option>
            {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
        </label>
        <label>Order by
          <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
            <option value="running">Most of the month not the mortgage</option>
            <option value="total">Dearest month</option>
          </select>
        </label>
      </div>
      <p className="story-note" role="status">{shown.length} towns · {order === "running" ? "each bar is the whole month as 100%" : "bars on one dollar scale"}; on the right, the whole month and, in brackets, the share that is not the mortgage</p>
      <StackedBars
        parts={PARTS}
        max={Math.max(...shown.map((r) => total(r.cost)))}
        shares={order === "running"}
        heads={["Town", "Month (not loan)"]}
        ticks={order === "running"
          ? [0, 0.25, 0.5, 0.75].map((f) => ({ at: f, label: `${f * 100}%` }))
          : [1000, 2000, 4000, 6000, 8000, 10000, 15000, 20000].filter((v) => v < Math.max(...shown.map((r) => total(r.cost)))).map((v) => ({ at: v, label: usd(v) }))}
        format={usd}
        label="Stacked bars: each town's typical monthly cost of owning, by part."
        rows={shown.map((r) => ({
          id: r.id,
          name: <Link href={regionPath(r.id)}>{r.name}</Link>,
          aside: county ? undefined : r.county,
          values: r.cost,
          total: `${usd(total(r.cost))} (${Math.round((running(r.cost) / total(r.cost)) * 100)}%)`,
        }))}
      />
    </>
  );
}
