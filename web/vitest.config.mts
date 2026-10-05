import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Pure calculations stay in Node. Interactive component tests opt into jsdom with
 * a file-level environment directive; the axe audit separately runs real browsers.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
