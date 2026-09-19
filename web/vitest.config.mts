import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Node environment, no DOM. What is worth testing here is the arithmetic behind the
 * charts — how a value is classified, where a point projects — and none of it needs a
 * browser. Rendering assertions would need jsdom and a component library; the pure
 * functions are where the bugs actually were.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
