/**
 * The printed report is static (#201, #395): no carousel, ticker or strip that moves or
 * scrolls on its own, since paper cannot pause it. The region page's interactive pieces
 * and the report's static ones are separate components; this keeps them so.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const MOVING = ["RegionStandOuts", "StateProfileTicker", "useAutoCarousel", "EditorialMetrics", "TownRow", "CountyCabinet", "HousingMosaic"];

describe("the printed report stays static", () => {
  it("imports none of the region page's moving parts", () => {
    const page = readFileSync(join(ROOT, "app/[state]/[place]/report/page.tsx"), "utf8");
    const imported = MOVING.filter((name) => new RegExp(`from "@/components/${name}"`).test(page));
    expect(imported).toEqual([]);
  });

  it("renders its stand-outs from a server component", () => {
    const standOuts = readFileSync(join(ROOT, "components/StandOuts.tsx"), "utf8");
    expect(standOuts.trimStart().startsWith('"use client"')).toBe(false);
  });
});
