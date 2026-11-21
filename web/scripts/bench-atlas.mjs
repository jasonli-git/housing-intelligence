#!/usr/bin/env node
/**
 * How smoothly the housing map moves (Milestone 66): frame times while it is dragged,
 * zoomed with its buttons and zoomed with the scroll wheel, at each New Jersey layer and
 * at three zooms, in a Chromium slowed to a phone's pace (CPU throttled 4×).
 *
 *   node scripts/bench-atlas.mjs [base URL] [--throttle 4]
 *
 * Two readings per case. Frame times are the gaps between animation frames (median, 95th
 * percentile, and the share slower than 50ms). Headless Chromium keeps those near 60 a
 * second even when the work behind them is heavy, so the trace's work is reported too:
 * milliseconds of script, of style and layout, of paint and of raster spent on the
 * gesture, which is what a slower phone feels as lag. Numbers move with the machine;
 * compare a before and an after taken on the same one.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = (args.find((a, i) => /^https?:/.test(a) && !args[i - 1]?.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const throttle = Number(option("--throttle")) || 4;
// `--level municipality --zoom 1` measures one case; `--css "…"` adds a style, to try a change.
const levels = option("--level") ? [option("--level")] : ["county", "municipality", "zip"];
const zooms = option("--zoom") ? [Number(option("--zoom"))] : [1, 3, 8];
const css = option("--css");

// `--gpu` draws with the machine's GPU, as a reader's browser does; headless Chromium's
// default is a software GPU, which makes compositor work (a moving layer's filter) look
// far dearer than it is.
const browser = await chromium.launch(args.includes("--gpu") ? { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

const record = async () => { await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] }); await page.evaluate(() => {
  const w = window;
  w.__frames = []; w.__recording = true;
  let last = performance.now();
  const loop = (t) => { w.__frames.push(t - last); last = t; if (w.__recording) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}); };
const WORK = { script: ["FunctionCall", "EventDispatch", "TimerFire", "FireAnimationFrame", "V8.Execute"], layout: ["UpdateLayoutTree", "Layout", "PrePaint", "UpdateLayerTree"], paint: ["Paint", "PaintImage", "Layerize"], raster: ["RasterTask", "GPUTask"] };
const work = (buffer) => {
  const events = JSON.parse(buffer.toString()).traceEvents ?? [];
  const out = {};
  for (const [kind, names] of Object.entries(WORK)) {
    // Top-level only: a FunctionCall inside an EventDispatch is not counted twice.
    const spans = events.filter((e) => names.includes(e.name) && e.ph === "X" && e.dur).map((e) => [e.tid, e.ts, e.ts + e.dur]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let total = 0, tid = null, end = -1;
    for (const [t, a, b] of spans) { if (t !== tid) { tid = t; end = -1; } if (a >= end) { total += b - a; end = b; } else if (b > end) { total += b - end; end = b; } }
    out[kind] = Math.round(total / 1000);
  }
  return out;
};
const stop = async () => { const frames = await page.evaluate(() => {
  const w = window; w.__recording = false;
  const t = w.__frames.slice(2).sort((a, b) => a - b);
  if (!t.length) return null;
  return { frames: t.length, median: +t[t.length >> 1].toFixed(1), p95: +t[Math.floor(t.length * 0.95)].toFixed(1), slow: +(t.filter((x) => x > 50).length / t.length * 100).toFixed(0) };
}); return { ...frames, ...work(await browser.stopTracing()) }; };
const settle = (ms) => page.waitForTimeout(ms);

const rows = [];
for (const level of levels) {
  for (const zoom of zooms) {
    await page.goto(`${base}/atlas?level=${level}&measure=acs_median_hh_income&view=latest&zoom=${zoom}&x=0&y=0`, { waitUntil: "networkidle" });
    await page.waitForSelector(".atlas-map-geography path");
    if (css) await page.addStyleTag({ content: css });
    await settle(1500);
    const box = await page.locator(".atlas-county-map").boundingBox();
    const cx = box.x + box.width * 0.55, cy = box.y + box.height * 0.55;
    const run = async (name, act) => {
      await record(); await act(); await settle(400);
      rows.push({ level, zoom, gesture: name, ...(await stop()) });
    };
    await run("drag", async () => {
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 30; i++) { await page.mouse.move(cx - i * 6, cy - i * 3); await settle(16); }
      await page.mouse.up();
    });
    await run("buttons", async () => {
      for (const label of ["Zoom in", "Zoom out"]) { await page.getByRole("button", { name: label }).click(); await settle(450); }
    });
    await run("wheel", async () => {
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, i < 6 ? -60 : 60); await settle(30); }
    });
  }
}
await browser.close();
console.log(`CPU throttled ${throttle}×, ${base}`);
console.table(rows);
const sum = (k) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
console.log(`total ms: script ${sum("script")}, layout ${sum("layout")}, paint ${sum("paint")}, raster ${sum("raster")}`);
