"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { previewPaths } from "@/lib/atlasPreviews";
import { budgetFit, type BudgetFit, type Reached } from "@/lib/afford";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { regionPath } from "@/lib/placeRoutes";

const SIZE = 460;
// The town outlines the housing map reads, so usually cached already; one request per visit.
let loading: Promise<Map<number, Path2D> | null> | null = null;
function load(): Promise<Map<number, Path2D> | null> {
  // Nothing to draw with where the browser has no canvas paths; the list still answers.
  if (typeof Path2D === "undefined") return Promise.resolve(null);
  loading ??= fetch("/atlas/municipalities.json")
    .then((r) => (r.ok ? (r.json() as Promise<{ outlines: PackedOutline[] }>) : null))
    .then((body) => (body?.outlines.length ? previewPaths(unpack(body.outlines), SIZE, 6) : null))
    .catch(() => null);
  return loading;
}

const FITS: BudgetFit[] = ["within", "near", "over", "none"];
const money = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

/**
 * The Budget explorer as a map (#495): every town shaded by whether its typical month
 * fits the reader's budget. It draws the list's own rows, so the two cannot disagree, and
 * the list beside it stays the way to read the towns without a pointer.
 */
export function BudgetMap({ rows, budget, scope, verb }: {
  /** Every town with the figures the mode needs, as the list holds them. */
  rows: Reached[];
  budget: number;
  /** Within one county: its towns, so the rest of the state is drawn faint. */
  scope?: Set<number>;
  verb: "buy" | "rent";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = useRef<HTMLUListElement>(null);
  const [paths, setPaths] = useState<Map<number, Path2D> | null>(null);
  const [theme, setTheme] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const byId = useMemo(() => new Map(rows.map((row) => [row.place.id, row])), [rows]);
  const counts = useMemo(() => {
    const tally: Record<BudgetFit, number> = { within: 0, near: 0, over: 0, none: 0 };
    // Within one county the key counts that county's towns, as the list beside it does.
    for (const row of rows) if (!scope || scope.has(row.place.id)) tally[budgetFit(row, budget)] += 1;
    return tally;
  }, [rows, budget, scope]);

  useEffect(() => { let live = true; load().then((p) => { if (live) setPaths(p); }); return () => { live = false; }; }, []);
  // The shades are theme tokens, so repaint when the theme changes.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const change = () => setTheme((t) => t + 1);
    media?.addEventListener("change", change);
    return () => { observer.disconnect(); media?.removeEventListener("change", change); };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !paths) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = SIZE * ratio;
    element.height = SIZE * ratio;
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);
    // The key's own swatches carry the colours: reading them resolves each theme's token.
    const shade = Object.fromEntries(FITS.map((fit) => [fit, getComputedStyle(key.current?.querySelector(`[data-fit="${fit}"] i`) ?? element).backgroundColor])) as Record<BudgetFit, string>;
    const style = getComputedStyle(element);
    context.lineWidth = 0.5;
    context.strokeStyle = style.getPropertyValue("--surface-card") || "white";
    for (const [id, path] of paths) {
      const row = byId.get(id);
      context.globalAlpha = scope && !scope.has(id) ? 0.25 : 1;
      context.fillStyle = shade[row ? budgetFit(row, budget) : "none"];
      context.fill(path);
      context.stroke(path);
    }
    context.globalAlpha = 1;
    const marked = picked ?? hover;
    const path = marked === null ? undefined : paths.get(marked);
    if (path) { context.lineWidth = 2.5; context.strokeStyle = style.color; context.stroke(path); }
  }, [paths, byId, budget, scope, theme, hover, picked]);

  const townAt = (event: React.MouseEvent<HTMLCanvasElement>): number | null => {
    const element = canvas.current, context = element?.getContext("2d");
    if (!element || !context || !paths) return null;
    const box = element.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * element.width, y = ((event.clientY - box.top) / box.height) * element.height;
    for (const [id, path] of paths) if (context.isPointInPath(path, x, y)) return id;
    return null;
  };
  const shown = picked ?? hover;
  const row = shown === null ? undefined : byId.get(shown);
  const label = `${scope ? "This county’s towns, on a map of New Jersey," : "New Jersey’s towns"} shaded by whether the typical home to ${verb} fits ${money(budget)} a month: ${counts.within} within budget, ${counts.near} just over, ${counts.over} over. The list beside this map names them.`;

  return (
    <figure className="budget-map">
      <canvas ref={canvas} width={SIZE} height={SIZE} role="img" aria-label={label}
        onMouseMove={(event) => setHover(townAt(event))} onMouseLeave={() => setHover(null)}
        onClick={(event) => { const id = townAt(event); setPicked(id === picked ? null : id); }} />
      <p className="budget-map-readout" aria-live="polite">
        {shown === null ? "Point at a town, or tap one, to see its monthly cost."
          : row ? <><Link href={regionPath(row.place.id)}>{row.place.name}</Link> · {money(row.monthly)} a month · {row.missing.length ? "some costs are not published" : row.within ? `${money(budget - row.monthly)} to spare` : `${money(row.monthly - budget)} over`}</>
          : "No figure is published for this town on this price."}
      </p>
      <ul className="budget-map-key" ref={key}>
        <li data-fit="within"><i />Within budget · {counts.within}</li>
        <li data-fit="near"><i />Up to 15% over · {counts.near}</li>
        <li data-fit="over"><i />Over · {counts.over}</li>
        <li data-fit="none"><i />No figure</li>
      </ul>
    </figure>
  );
}
