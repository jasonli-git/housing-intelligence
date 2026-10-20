/**
 * Colours live in tokens (ARCHITECTURE #383, #384). Two rules:
 *
 * - A kind's colour is never re-typed: the exact `light-dark()` pair of any kind in
 *   `app/kinds.css` appearing anywhere else fails, whatever the file.
 * - Every other hard-coded colour is frozen per file at `colourBaseline.json`. No file may
 *   gain one, a new file starts at none, and a file that loses some must lower its count,
 *   so the total only falls. `npm run colours:baseline` rewrites the counts after a
 *   reviewed change.
 *
 * Token files themselves (`tokens.css`, `kinds.css`) are where colours belong and are
 * not counted.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const BASELINE = join(__dirname, "colourBaseline.json");
const TOKEN_FILES = new Set(["app/tokens.css", "app/kinds.css"]);
const SCANNED = ["app", "components", "lib"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(css|tsx)$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

/**
 * Hex colours. In CSS a short `#fff` counts where a value starts (after a space, colon,
 * bracket or comma); in TSX only six- and eight-digit ones, since `href="#add"` is not a
 * colour.
 */
function hexes(path: string, text: string): string[] {
  const pattern = path.endsWith(".css")
    ? /(?<=[\s:(,])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![-\w])/g
    : /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![-\w])/g;
  return text.match(pattern) ?? [];
}

function counts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dir of SCANNED) {
    for (const path of files(join(ROOT, dir))) {
      const rel = relative(ROOT, path);
      if (TOKEN_FILES.has(rel)) continue;
      const n = hexes(rel, readFileSync(path, "utf8")).length;
      if (n > 0) out[rel] = n;
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function kindPairs(): { kind: string; pattern: RegExp }[] {
  const css = readFileSync(join(ROOT, "app/kinds.css"), "utf8");
  return [...css.matchAll(/--kind-([\w-]+):\s*light-dark\(\s*(#[0-9a-fA-F]+)\s*,\s*(#[0-9a-fA-F]+)\s*\)/g)].map(
    ([, kind, light, dark]) => ({
      kind,
      pattern: new RegExp(`light-dark\\(\\s*${light}\\s*,\\s*${dark}\\s*\\)`, "i"),
    }),
  );
}

describe("colours stay in tokens", () => {
  it("never re-types a kind's colour outside kinds.css", () => {
    const pairs = kindPairs();
    expect(pairs.length).toBeGreaterThanOrEqual(8);
    const found: string[] = [];
    for (const dir of SCANNED) {
      for (const path of files(join(ROOT, dir))) {
        const rel = relative(ROOT, path);
        if (rel === "app/kinds.css") continue;
        const text = readFileSync(path, "utf8");
        for (const { kind, pattern } of pairs) if (pattern.test(text)) found.push(`${rel}: --kind-${kind}`);
      }
    }
    expect(found, "use var(--kind-…) or var(--kind) instead").toEqual([]);
  });

  it("adds no hard-coded colour to any file, and lowers the baseline as they go", () => {
    const now = counts();
    if (process.env.UPDATE_COLOUR_BASELINE) {
      writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
      return;
    }
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
    const grew = Object.entries(now)
      .filter(([file, n]) => n > (baseline[file] ?? 0))
      .map(([file, n]) => `${file}: ${baseline[file] ?? 0} → ${n}`);
    expect(grew, "move the new colour behind a token in tokens.css or kinds.css").toEqual([]);
    const shrank = Object.entries(baseline)
      .filter(([file, n]) => (now[file] ?? 0) < n)
      .map(([file, n]) => `${file}: ${n} → ${now[file] ?? 0}`);
    expect(shrank, "fewer colours: run `npm run colours:baseline` to lock the gain in").toEqual([]);
  });
});
