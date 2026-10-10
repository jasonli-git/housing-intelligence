// Place photos for the state and county page headers (ARCHITECTURE #368).
//
// `make publish` runs this into dist/artifacts/photos/, so the photos ride the same R2
// sync, backup and rollback as every other artifact; anything not written here would be
// deleted from the bucket by that sync. Originals are cached by content hash beside the
// raw data (data/raw/photos/) and fetched from Wikimedia Commons only when missing. A
// download whose SHA-256 is not the manifest's is refused: a file replaced on Commons is
// a new photo, and needs reviewing again before it is published.
//
//   node web/scripts/make-photos.mjs --out dist/artifacts/photos [--raw data/raw/photos]

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { cropBox, derivativeWidths } from "../lib/photoCrop.ts";

const repo = path.resolve(import.meta.dirname, "..", "..");
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? path.resolve(process.argv[at + 1]) : fallback;
};
const out = arg("--out");
const raw = arg("--raw", path.join(repo, "data", "raw", "photos"));
if (!out) {
  console.error("make-photos: --out <dir> is required");
  process.exit(1);
}

const photos = JSON.parse(await readFile(path.join(repo, "web", "lib", "photos.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const UA = "HousingIntelligence/1.0 (https://housing.jasonli.app; housing@jasonli.app)";

async function original(photo) {
  const file = path.join(raw, `${photo.original.sha256.slice(0, 16)}.jpg`);
  if (existsSync(file)) {
    const bytes = await readFile(file);
    if (sha256(bytes) !== photo.original.sha256) throw new Error(`${file}: cached original does not match its hash`);
    return bytes;
  }
  const response = await fetch(photo.original.url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`${photo.geoid}: Commons answered ${response.status} for ${photo.original.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== photo.original.sha256) {
    throw new Error(`${photo.geoid}: ${photo.credit.title} on Commons has changed since it was reviewed; review it again and update its hash`);
  }
  await mkdir(raw, { recursive: true });
  await writeFile(file, bytes);
  return bytes;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let files = 0;
for (const photo of photos) {
  const box = cropBox(photo.original.width, photo.original.height, photo.crop);
  // Metadata is stripped by default: no EXIF, so no camera GPS travels with the copy.
  const cropped = await sharp(await original(photo), { limitInputPixels: false }).rotate().extract(box).toBuffer();
  for (const width of derivativeWidths(box.width)) {
    const resized = sharp(cropped).resize({ width });
    await resized.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(out, `${photo.geoid}-${width}.avif`));
    await resized.clone().webp({ quality: 76 }).toFile(path.join(out, `${photo.geoid}-${width}.webp`));
    files += 2;
  }
}
console.log(`make-photos: ${photos.length} photos, ${files} files in ${path.relative(process.cwd(), out)}`);
