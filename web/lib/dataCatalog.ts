/**
 * The Data Explorer's catalog (Milestone 59, `GET /catalog`) and the graphs drawn from it.
 * Pure, so what connects to what is tested rather than eyeballed.
 */

export type CatalogColumn = { name: string; type: string; nullable?: boolean; null_share?: number | null; distinct?: number | null };
export type CatalogSource = { id: string; name: string; publisher: string; cadence: string; homepage: string };
export type CatalogModel = { name: string; description: string; rows: number | null; columns: CatalogColumn[]; tests: number; upstream: string[]; sources: string[]; metrics: string[] };
export type CatalogTable = { name: string; rows: number; bytes: number; columns: CatalogColumn[]; foreign_keys: { column: string; references: string }[] };
export type CatalogMetric = { id: string; label: string; unit: string; frequency: string; kind: string; description: string; source: string; inputs: string[]; observations: number; places: number; first: string | null; last: string | null };
export type Catalog = { sources: CatalogSource[]; models: CatalogModel[]; tables: CatalogTable[]; metrics: CatalogMetric[]; storage?: { name: string; bytes: number }[] };

export type FlowNode = { id: string; label: string };
export type FlowColumn = { title: string; nodes: FlowNode[]; hidden?: number };
export type Flow = { columns: FlowColumn[]; edges: [string, string][] };

const CAP = 14;

/** Every link in the pipeline, as `source:`, `model:` and `metric:` node ids. */
export function lineageEdges(catalog: Catalog): [string, string][] {
  const edges: [string, string][] = [];
  const modelled = new Set<string>();
  for (const model of catalog.models) {
    for (const source of model.sources) edges.push([`source:${source}`, `model:${model.name}`]);
    for (const parent of model.upstream) edges.push([`model:${parent}`, `model:${model.name}`]);
    for (const metric of model.metrics) { edges.push([`model:${model.name}`, `metric:${metric}`]); modelled.add(metric); }
  }
  for (const metric of catalog.metrics) {
    // A calculated figure comes from other figures; the rest of the unmodelled few are
    // loaded straight from their source's staged table.
    for (const input of metric.inputs) edges.push([`metric:${input}`, `metric:${metric.id}`]);
    if (!modelled.has(metric.id) && !metric.inputs.length) edges.push([`source:${metric.source}`, `metric:${metric.id}`]);
  }
  return edges;
}

function reach(start: string, step: Map<string, string[]>) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) for (const next of step.get(queue.pop()!) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen;
}

/** Only what feeds the focus and what it feeds, in pipeline order. */
export function traceLineage(catalog: Catalog, focus: string): Flow {
  const edges = lineageEdges(catalog);
  const down = new Map<string, string[]>();
  const up = new Map<string, string[]>();
  for (const [from, to] of edges) { down.set(from, [...(down.get(from) ?? []), to]); up.set(to, [...(up.get(to) ?? []), from]); }
  const kept = new Set([...reach(focus, up), ...reach(focus, down)]);
  const column = (title: string, nodes: FlowNode[]): FlowColumn => {
    const shown = nodes.filter((n) => kept.has(n.id));
    // The focus is never the one cut.
    const ordered = [...shown.filter((n) => n.id === focus), ...shown.filter((n) => n.id !== focus)];
    return { title, nodes: ordered.slice(0, CAP), hidden: Math.max(0, ordered.length - CAP) };
  };
  const columns = [
    column("Publisher", catalog.sources.map((s) => ({ id: `source:${s.id}`, label: s.name }))),
    column("Staged table", catalog.models.map((m) => ({ id: `model:${m.name}`, label: m.name }))),
    column("Published figure", catalog.metrics.map((m) => ({ id: `metric:${m.id}`, label: m.label }))),
  ];
  const drawn = new Set(columns.flatMap((c) => c.nodes.map((n) => n.id)));
  return { columns, edges: edges.filter(([a, b]) => drawn.has(a) && drawn.has(b) && kept.has(a) && kept.has(b)) };
}

/** The serving tables by how many joins separate them from the tables nothing depends on. */
export function tableFlow(tables: CatalogTable[]): Flow {
  const parents = new Map(tables.map((t) => [t.name, [...new Set(t.foreign_keys.map((k) => k.references).filter((r) => r !== t.name))]]));
  const depth = (name: string, seen = new Set<string>()): number => {
    if (seen.has(name)) return 0;
    const above = parents.get(name) ?? [];
    return above.length ? 1 + Math.max(...above.map((p) => depth(p, new Set(seen).add(name)))) : 0;
  };
  const joined = tables.filter((t) => t.foreign_keys.length || tables.some((o) => o.foreign_keys.some((k) => k.references === t.name)));
  const deepest = Math.max(0, ...joined.map((t) => depth(t.name)));
  const columns: FlowColumn[] = Array.from({ length: deepest + 1 }, (_, i) => ({
    title: i === 0 ? "Reference tables" : i === deepest ? "Facts about places" : "Linking tables",
    nodes: joined.filter((t) => deepest - depth(t.name) === deepest - i && depth(t.name) === i).map((t) => ({ id: t.name, label: t.name })),
  })).reverse();
  return { columns, edges: joined.flatMap((t) => (parents.get(t.name) ?? []).map((p) => [t.name, p] as [string, string])) };
}

export function shortBytes(bytes: number) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  return bytes >= 1048576 ? `${Math.round(bytes / 1048576).toLocaleString("en-US")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
