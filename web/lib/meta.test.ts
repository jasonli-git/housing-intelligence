import { describe, expect, it } from "vitest";

import type { Region } from "@/lib/api";
import { pageMetadata, regionTitle } from "@/lib/meta";

const region = (fields: Partial<Region>): Region =>
  ({ region_id: 1, geoid: "", level: "county", name: "Atlantic", name_lsad: "", state_code: "NJ", ...fields }) as Region;
const morris = region({ level: "county", name: "Morris" });

describe("regionTitle (#358)", () => {
  it("names a county and a ZIP code as a reader would", () => {
    expect(regionTitle(region({ level: "county", name: "Atlantic" }))).toBe("Atlantic County, NJ");
    expect(regionTitle(region({ level: "zip", name: "07001" }))).toBe("ZIP 07001, NJ");
  });

  it("tells Boonton town from Boonton township by its legal type and county", () => {
    const town = region({ level: "municipality", name: "Boonton", name_lsad: "Boonton town" });
    const township = region({ level: "municipality", name: "Boonton", name_lsad: "Boonton township" });
    expect(regionTitle({ ...town, ancestors: [morris] })).toBe("Boonton town, Morris County, NJ");
    expect(regionTitle({ ...township, ancestors: [morris] })).toBe("Boonton township, Morris County, NJ");
  });
});

describe("pageMetadata (#358)", () => {
  it("gives shared links the page's own title and description, and one canonical address", () => {
    const meta = pageMetadata({ title: "T", description: "D", path: "/regions/5" });
    expect(meta.openGraph).toMatchObject({ title: "T", description: "D", url: "/regions/5" });
    expect(meta.twitter).toMatchObject({ title: "T", description: "D", card: "summary_large_image" });
    expect(meta.openGraph).toMatchObject({ siteName: "Housing Intelligence", images: [{ url: "/og-image.png" }] });
    expect(meta.alternates).toEqual({ canonical: "/regions/5" });
  });
});
