// Run against a local web + API pair: node scripts/check-paused-profile-swipe.mjs
// Chromium touch emulation checks the native paused-strip gesture, not iOS Safari.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.CHECK_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);

    for (const route of ["/", "/regions/12"]) {
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      const ticker = page.locator(".state-ticker").first();
      const track = ticker.locator(".state-ticker-track");
      const scroller = ticker.locator(".state-ticker-window");
      await ticker.waitFor();
      await page.waitForTimeout(400);
      assert.equal(await ticker.locator(".state-ticker-group").count(), 2, "Only two groups should be exported for playback");

      const animatedOffset = await track.evaluate((node) =>
        new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,
      );
      await ticker.getByRole("button", { name: /Pause .* ticker/ }).tap();
      assert.equal(await ticker.locator(".state-ticker-group").count(), 4, "Pause adds room to swipe either way");

      const read = () => scroller.evaluate((node) => ({
        left: node.scrollLeft,
        max: node.scrollWidth - node.clientWidth,
        group: node.querySelector(".state-ticker-group").getBoundingClientRect().width,
        touchAction: getComputedStyle(node).touchAction,
      }));
      const start = await read();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(documentWidth <= width, `${route} at ${width}px must not overflow the page`);
      assert.ok(start.max > start.left + 120, `${route} at ${width}px needs room to swipe forward`);
      assert.ok(start.left > 120, `${route} at ${width}px needs room to swipe backward`);
      assert.equal(start.touchAction, "auto", "Paused touch swipe must belong to the browser");
      assert.ok(
        Math.abs(start.left - start.group + animatedOffset) < 20,
        `${route} at ${width}px should keep its visible position when paused`,
      );

      const box = await scroller.boundingBox();
      assert.ok(box, "The profile strip must be visible");
      const x = box.x + box.width * 0.75;
      const y = box.y + box.height * 0.5;
      async function swipe(delta) {
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let step = 1; step <= 8; step++) {
          await client.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + delta * step / 8, y }],
          });
          await page.waitForTimeout(22);
        }
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(250);
      }

      await swipe(-160);
      const forward = await read();
      assert.ok(forward.left > start.left + 50, `${route} at ${width}px must swipe left while paused`);
      await swipe(160);
      const backward = await read();
      assert.ok(backward.left < forward.left - 50, `${route} at ${width}px must swipe right while paused`);

      await ticker.getByRole("button", { name: /Play .* ticker/ }).tap();
      const resumedOffset = await track.evaluate((node) =>
        new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,
      );
      const phase = backward.left % backward.group;
      assert.ok(
        Math.abs(resumedOffset + phase) < 20,
        `${route} at ${width}px should resume from the swiped position`,
      );
      console.log(`${route} at ${width}px: paused swipe both ways and resumed in place`);
    }
    await context.close();
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const route of ["/", "/regions/12"]) {
    await desktop.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    const ticker = desktop.locator(".state-ticker").first();
    const scroller = ticker.locator(".state-ticker-window");
    await ticker.getByRole("button", { name: /Pause .* ticker/ }).click();
    const box = await scroller.boundingBox();
    assert.ok(box, "The desktop profile strip must be visible");
    const before = await scroller.evaluate((node) => node.scrollLeft);
    const x = box.x + box.width * 0.7;
    const y = box.y + box.height * 0.5;
    await desktop.mouse.move(x, y);
    await desktop.mouse.down();
    await desktop.mouse.move(x - 140, y, { steps: 8 });
    await desktop.mouse.up();
    const after = await scroller.evaluate((node) => node.scrollLeft);
    assert.ok(after > before + 50, `${route} must drag while paused on desktop`);
    console.log(`${route} at 1440px: paused mouse drag works`);
  }
  await desktop.close();

  const keyboard = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await keyboard.goto(`${origin}/regions/12`, { waitUntil: "networkidle" });
  const keyboardTicker = keyboard.locator(".state-ticker").first();
  const lastTerm = keyboardTicker.locator(".state-ticker-group:not([aria-hidden]) .term").last();
  await lastTerm.focus();
  await keyboard.waitForTimeout(100);
  assert.equal(await keyboardTicker.getAttribute("data-stopped"), "true", "Keyboard focus still exposes the static strip");
  const termBox = await lastTerm.boundingBox();
  const windowBox = await keyboardTicker.locator(".state-ticker-window").boundingBox();
  assert.ok(
    termBox && windowBox && termBox.x >= windowBox.x && termBox.x + termBox.width <= windowBox.x + windowBox.width + 1,
    "The focused definition stays inside the visible strip",
  );
  await keyboard.close();

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reduced = await reducedContext.newPage();
  await reduced.goto(origin, { waitUntil: "networkidle" });
  const reducedTicker = reduced.locator(".state-ticker").first();
  assert.equal(await reducedTicker.getAttribute("data-stopped"), "true", "Reduced motion remains static");
  assert.ok(!(await reducedTicker.locator(".state-ticker-head button").isVisible()), "Reduced motion hides the control");
  assert.ok(await reducedTicker.locator(".state-ticker-group").first().isVisible(), "Reduced motion shows the original metrics");
  assert.ok(!(await reducedTicker.locator(".state-ticker-group").last().isVisible()), "Reduced motion hides the duplicate");
  await reducedContext.close();
  console.log("Keyboard focus and reduced-motion layouts remain intact");
} finally {
  await browser.close();
}
