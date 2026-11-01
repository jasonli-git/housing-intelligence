"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./poster.module.css";

export type TownRow = { id: number; name: string; href: string; sale: number | null; value: number | null; tax: number | null; income: number | null };
const COLUMNS = [["sale", "Recent sale"], ["value", "Home value"], ["tax", "Tax rate"], ["income", "Income"]] as const;
type Key = "name" | (typeof COLUMNS)[number][0];
const money = (value: number | null) => (value === null ? "–" : `$${Math.round(value).toLocaleString("en-US")}`);

/** Every town in the county, sortable; a town missing a figure sinks, whichever way the column runs. */
export function TownTable({ towns }: { towns: TownRow[] }) {
  const [key, setKey] = useState<Key>("sale");
  const [down, setDown] = useState(true);
  const rows = useMemo(() => [...towns].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name) * (down ? -1 : 1);
    const x = a[key], y = b[key];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (x - y) * (down ? -1 : 1);
  }), [towns, key, down]);
  const sort = (next: Key) => { if (next === key) setDown(!down); else { setKey(next); setDown(next !== "name"); } };
  const header = (column: Key, label: string) => <th key={column} scope="col" aria-sort={key === column ? (down ? "descending" : "ascending") : "none"}>
    <button type="button" onClick={() => sort(column)}>{label}{key === column ? (down ? " ↓" : " ↑") : ""}</button>
  </th>;
  return <div className={styles.townTable} tabIndex={0} role="region" aria-label="Towns in this county">
    <table>
      <thead><tr>{header("name", "Town")}{COLUMNS.map(([column, label]) => header(column, label))}</tr></thead>
      <tbody>{rows.map((town) => <tr key={town.id}>
        <th scope="row"><Link href={town.href}>{town.name}</Link></th>
        <td>{money(town.sale)}</td><td>{money(town.value)}</td><td>{town.tax === null ? "–" : `${town.tax.toFixed(2)}%`}</td><td>{money(town.income)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
