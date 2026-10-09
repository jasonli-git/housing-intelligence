// Renders the site's raster icons and its social preview from `app/icon.svg` (#358):
// `app/favicon.ico` for browsers and crawlers that ask for /favicon.ico, `app/apple-icon.png`
// for iOS home screens, and `public/og-image.png` for shared links — a fixed address rather
// than Next's `opengraph-image` convention, because every page names it (`lib/meta.ts`). Run by hand after
// the icon changes: `node scripts/make-site-images.mjs`. The outputs are committed, so a
// build needs no image tooling.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const icon = readFileSync(new URL("../app/icon.svg", import.meta.url));

// An ICO holding one 32px PNG, which every current browser accepts.
const png32 = await sharp(icon, { density: 384 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // no palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
writeFileSync(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, png32]));

// iOS draws its own rounded corners, so the touch icon is full-bleed.
await sharp(icon, { density: 1440 })
  .resize(180, 180)
  .flatten({ background: "#111113" })
  .png()
  .toFile(new URL("../app/apple-icon.png", import.meta.url).pathname);

const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111113"/>
  <g transform="translate(96 132) scale(4.5)">
    <path d="M7 15.5 16 8l9 7.5V25H7z" fill="none" stroke="#f5f5f7" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="16" cy="19.5" r="2.9" fill="#2ea98a"/>
  </g>
  <text x="96" y="380" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="88" font-weight="600" fill="#f5f5f7">Housing</text>
  <text x="96" y="448" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="36" fill="#c7c7cc">New Jersey housing data, every figure traced to its source</text>
  <text x="96" y="548" font-family="Menlo, monospace" font-size="26" fill="#8e8e93">housing.jasonli.app</text>
</svg>`;
await sharp(Buffer.from(preview)).png().toFile(new URL("../public/og-image.png", import.meta.url).pathname);
console.log("wrote app/favicon.ico, app/apple-icon.png, public/og-image.png");
