import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NJDEP_NOTICE } from "@/lib/notices";

describe("notices placed beside their figures", () => {
  it("quotes NJDEP's notice exactly as config/sources.yml records it", () => {
    const config = readFileSync(join(__dirname, "../../config/sources.yml"), "utf8");
    expect(config).toContain(NJDEP_NOTICE);
  });
});
