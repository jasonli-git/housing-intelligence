import { expect, it } from "vitest";
import { lineageEdges, shortBytes, tableFlow, traceLineage, type Catalog, type CatalogTable } from "./dataCatalog";

const metric = (id: string, source: string, inputs: string[] = []) => ({ id, label: id, unit: "", frequency: "", kind: "", description: "", source, inputs, observations: 0, places: 0, first: null, last: null });
const model = (name: string, sources: string[], metrics: string[], upstream: string[] = []) => ({ name, description: "", rows: 1, columns: [], tests: 0, upstream, sources, metrics });
const source = (id: string) => ({ id, name: id, publisher: "", cadence: "", homepage: "" });
const catalog: Catalog = {
  sources: [source("a"), source("b"), source("osm")],
  models: [model("stg_a", ["a"], ["rent"]), model("stg_b", ["b"], ["income"])],
  tables: [],
  metrics: [metric("rent", "a"), metric("income", "b"), metric("burden", "derived", ["rent", "income"]), metric("wawa", "osm")],
};

it("links a metric no model names to its source, and a calculated one to its inputs", () => {
  const edges = lineageEdges(catalog);
  expect(edges).toContainEqual(["source:osm", "metric:wawa"]);
  expect(edges).toContainEqual(["metric:rent", "metric:burden"]);
  expect(edges).not.toContainEqual(["source:derived", "metric:burden"]);
});

it("traces only what feeds the focus", () => {
  const flow = traceLineage(catalog, "metric:rent");
  const ids = flow.columns.flatMap((c) => c.nodes.map((n) => n.id));
  expect(ids).toEqual(expect.arrayContaining(["source:a", "model:stg_a", "metric:rent", "metric:burden"]));
  expect(ids).not.toContain("source:b");
  expect(ids).not.toContain("metric:wawa");
});

it("keeps the focus when a long column is cut", () => {
  const many = Array.from({ length: 30 }, (_, i) => metric(`m${i}`, "a"));
  const flow = traceLineage({ ...catalog, models: [model("stg_a", ["a"], many.map((m) => m.id))], metrics: many }, "metric:m29");
  expect(flow.columns[2].nodes[0].id).toBe("metric:m29");
  const wide = traceLineage({ ...catalog, models: [model("stg_a", ["a"], many.map((m) => m.id))], metrics: many }, "source:a");
  expect(wide.columns[2].hidden).toBe(16);
});

it("orders joined tables from facts to references and leaves unjoined ones out", () => {
  const table = (name: string, refs: string[]): CatalogTable => ({ name, rows: 0, bytes: 0, columns: [], foreign_keys: refs.map((r) => ({ column: "id", references: r })) });
  const flow = tableFlow([table("sources", []), table("metrics", ["sources"]), table("facts", ["metrics"]), table("alone", [])]);
  expect(flow.columns.map((c) => c.nodes.map((n) => n.id))).toEqual([["facts"], ["metrics"], ["sources"]]);
  expect(flow.edges).toContainEqual(["facts", "metrics"]);
});

it("words sizes", () => { expect(shortBytes(3 * 1048576)).toBe("3 MB"); expect(shortBytes(2048)).toBe("2 KB"); });
