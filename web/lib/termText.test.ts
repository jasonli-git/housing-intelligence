/**
 * Definitions are written once, in `lib/terms.ts` (ARCHITECTURE #387–#389). A page or
 * component may build a definition from the figures it shows — a template with the live
 * values in it — but never write a fixed one inline, where it would drift from the
 * dictionary and from every other place the same idea is explained.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

/** Fixed definition text: a string literal, or a template literal with nothing live in it. */
const FIXED = String.raw`(?:"[^"]*"|\x60[^\x60$]*\x60)`;
const RULES: { name: string; pattern: RegExp }[] = [
  { name: "a fixed definition= on a term", pattern: new RegExp(String.raw`<Term\b[^>]*\bdefinition=(?:${FIXED}|\{${FIXED}\})`) },
  { name: "a fixed what: in an entry", pattern: new RegExp(String.raw`\bwhat:\s*${FIXED}\s*[,}]`) },
  { name: "a fixed definition: in a term object", pattern: new RegExp(String.raw`\bdefinition:\s*${FIXED}\s*[,}]`) },
];

describe("definitions stay in the dictionary", () => {
  it("writes no fixed definition text in a page or component", () => {
    const found: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const path of files(join(ROOT, dir))) {
        const text = readFileSync(path, "utf8");
        for (const { name, pattern } of RULES) {
          if (pattern.test(text)) found.push(`${relative(ROOT, path)}: ${name}`);
        }
      }
    }
    expect(found, "move the text into lib/terms.ts and use <Term id=…>").toEqual([]);
  });
});
