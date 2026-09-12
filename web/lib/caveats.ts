/**
 * Where each caveat sits on a page: beside the figures it qualifies, not collected at
 * the foot (Milestone 18).
 *
 * The API scopes every caveat to the metrics it is about (`caveat_scopes` on
 * `/regions/{id}/summary`, from `hip.packets.scoped_caveats`), so placement is a pure
 * function of those scopes and the rows each table shows:
 *
 * - A caveat that qualifies exactly one row on the page is set directly under that row.
 * - One that qualifies several is lettered on each of them, and its text is set out
 *   under the first table it appears in. A later table marks the same letter and says
 *   the note is above, rather than printing it twice.
 * - One that qualifies no row — a caveat about the region's figures as a whole, or about
 *   a metric no table shows — goes in `general`, under the tables. Nothing is dropped.
 */

export type CaveatScope = { text: string; metric_ids: string[] };

export type TablePlacement = {
  /** metric id → caveat texts set directly under that row. */
  inline: Map<string, string[]>;
  /** metric id → note letters marked on that row. */
  marks: Map<string, string[]>;
  /** Notes set out under this table: the ones first marked in it. */
  notes: { letter: string; text: string }[];
  /** Letters marked in this table whose notes sit under an earlier one. */
  earlier: string[];
};

export type Placement = { tables: TablePlacement[]; general: string[] };

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function append(map: Map<string, string[]>, key: string, value: string): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

/**
 * Place `scopes` against `tables`, each given as the metric ids it shows, in order.
 * Letters run a, b, c… in the order the caveats arrive, which is the API's stable order.
 */
export function placeCaveats(tables: string[][], scopes: CaveatScope[]): Placement {
  const placed: Placement = {
    tables: tables.map(() => ({ inline: new Map(), marks: new Map(), notes: [], earlier: [] })),
    general: [],
  };
  let next = 0;

  for (const scope of scopes) {
    const wanted = new Set(scope.metric_ids);
    const hits = tables.map((rows) => rows.filter((id) => wanted.has(id)));
    const count = hits.reduce((n, rows) => n + rows.length, 0);

    if (count === 0) {
      placed.general.push(scope.text);
      continue;
    }
    if (count === 1) {
      const t = hits.findIndex((rows) => rows.length === 1);
      append(placed.tables[t].inline, hits[t][0], scope.text);
      continue;
    }
    const letter = LETTERS[next] ?? String(next + 1);
    next += 1;
    let noted = false;
    hits.forEach((rows, t) => {
      if (rows.length === 0) return;
      for (const id of rows) append(placed.tables[t].marks, id, letter);
      if (noted) {
        placed.tables[t].earlier.push(letter);
      } else {
        placed.tables[t].notes.push({ letter, text: scope.text });
        noted = true;
      }
    });
  }
  return placed;
}

/**
 * The scope of each caveat a packet carries.
 *
 * The report is drawn from the packet, whose caveats are plain texts, and the scopes come
 * from the summary. Matching on the text keeps the packet the authority on *which*
 * caveats a report shows; a text the summary does not scope — a ZIP's allocation note
 * naming its weights, a thin-cohort warning the summary is not told about — is treated
 * as being about the region as a whole.
 */
export function scopesFor(texts: string[], scopes: CaveatScope[]): CaveatScope[] {
  const byText = new Map(scopes.map((s) => [s.text, s.metric_ids]));
  return texts.map((text) => ({ text, metric_ids: byText.get(text) ?? [] }));
}
