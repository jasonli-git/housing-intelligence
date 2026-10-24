import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TOOL_PREVIEWS, captureToolPreviews } from './tool-previews.mjs';

test('capture all six tools in both themes, clipped to content with the header hidden', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'hip-tool-previews-'));
  const captures = [], themes = [], styles = [];
  let closed = 0, income = 0;
  const browser = { newContext: async (options) => {
    themes.push(options.colorScheme);
    return { close: async () => { closed++; }, newPage: async () => ({
      goto: async () => ({ ok: () => true }),
      setViewportSize: async () => {},
      locator: () => ({ first() { return this; }, waitFor: async () => {}, scrollIntoViewIfNeeded: async () => {}, boundingBox: async () => ({ x: 28, y: 100, width: 1044, height: 900 }) }),
      getByLabel: () => ({ fill: async () => { income++; } }),
      evaluate: async (fn) => String(fn).includes('scrollY') ? 200 : undefined,
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
    assert.equal(income, 2);
    assert(styles.every((s) => s.includes('.bar{visibility:hidden!important}')));
    assert(captures.every((s) => s.clip.y === 300 && s.clip.height === 653 && s.path.endsWith('.jpg')));
    assert(!TOOL_PREVIEWS.some((t) => /address=|parcel=/.test(t.path)));
  } finally { await rm(outDir, { recursive: true, force: true }); }
});

test('missing content fails the capture rather than silently shipping an empty preview', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'hip-tool-previews-'));
  let closed = false;
  const browser = { newContext: async () => ({ close: async () => { closed = true; }, newPage: async () => ({
    setViewportSize: async () => {},
    goto: async () => ({ ok: () => false, status: () => 404 }),
  }) }) };
  try {
    await assert.rejects(captureToolPreviews(browser, { origin: 'http://local.test', outDir }), /404/);
    assert.equal(closed, true);
  } finally { await rm(outDir, { recursive: true, force: true }); }
});
