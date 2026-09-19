import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";

const url = process.env.SCREENSHOT_URL ?? "http://localhost:3000/regions/8";
const output = resolve(
  process.env.SCREENSHOT_OUTPUT ??
    "../agent-handoffs/artifacts/screenshot-automation-poc.png",
);
const width = Number(process.env.SCREENSHOT_WIDTH ?? 1440);
const height = Number(process.env.SCREENSHOT_HEIGHT ?? 1000);

if (![width, height].every(Number.isSafeInteger) || width <= 0 || height <= 0) {
  throw new Error("SCREENSHOT_WIDTH and SCREENSHOT_HEIGHT must be positive integers");
}

await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width, height },
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
  });

  const response = await page.goto(url, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  if (!response?.ok()) {
    throw new Error(`GET ${url} returned ${response?.status() ?? "no response"}`);
  }

  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("heading", { name: "Bergen County", exact: true }).waitFor();
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
      nextjs-portal { display: none !important; }
    `,
  });
  await page.screenshot({
    path: output,
    animations: "disabled",
    scale: "css",
  });

  console.log(`Captured ${url} at ${width}x${height} to ${output}`);
} finally {
  await browser.close();
}
