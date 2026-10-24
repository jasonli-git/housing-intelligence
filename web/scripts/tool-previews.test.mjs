import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TOOL_PREVIEWS, captureToolPreviews } from './tool-previews.mjs';

test('capture all six tools in both themes at the normal top-of-page viewport without clipping', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'hip-tool-previews-'));
  const captures = [], themes = [], styles = [], positioning = [], routes = [];
  let closed = 0, income = 0;
  const browser = { newContext: async (options) => {
    themes.push(options.colorScheme);
    assert.deepEqual(options.viewport, { width: 1440, height: 900 });
    return { close: async () => { closed++; }, route: async (pattern) => { routes.push(pattern); }, newPage: async () => ({
      goto: async () => ({ ok: () => true }),
      locator: () => ({ first() { return this; }, waitFor: async () => {} }),
      getByLabel: () => ({ fill: async () => { income++; } }),
      evaluate: async (fn) => { if (String(fn).includes('scrollTo')) positioning.push(String(fn)); },
      addStyleTag: async ({ content }) => styles.push(content),
      screenshot: async (options) => captures.push(options),
    }) };
  } };
  try {
    await captureToolPreviews(browser, { origin: 'http://local.test', outDir });
    assert.equal(TOOL_PREVIEWS.length, 6);
    assert.equal(new Set(TOOL_PREVIEWS.map((t) => t.name)).size, 6);
    assert.deepEqual(themes, ['light', 'dark']);
    assert.equal(captures.length, 12);
    assert.equal(closed, 2);
    // Figures come from the build's own artifacts, not the live origin CORS refuses.
    assert.deepEqual(routes, ['https://housing-data.jasonli.app/**', 'https://housing-data.jasonli.app/**']);
    assert.equal(income, 2);
    assert(styles.every((s) => !s.includes('.bar')));
    assert.equal(positioning.length, 12);
    assert(positioning.every((s) => s.includes('top: 0, left: 0')));
    assert(captures.every((s) => s.fullPage === false && !('clip' in s) && s.path.endsWith('.jpg')));
    assert(!TOOL_PREVIEWS.some((t) => /address=|parcel=/.test(t.path)));
  } finally { await rm(outDir, { recursive: true, force: true }); }
});

test('missing content fails the capture rather than silently shipping an empty preview', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'hip-tool-previews-'));
  let closed = false;
  const browser = { newContext: async () => ({ close: async () => { closed = true; }, route: async () => {}, newPage: async () => ({
    goto: async () => ({ ok: () => false, status: () => 404 }),
  }) }) };
  try {
    await assert.rejects(captureToolPreviews(browser, { origin: 'http://local.test', outDir }), /404/);
    assert.equal(closed, true);
  } finally { await rm(outDir, { recursive: true, force: true }); }
});
