// Renders the site's raster icons and its social preview from `app/icon.svg` (#358):
// `app/favicon.ico` for browsers and crawlers that ask for /favicon.ico, `app/apple-icon.png`
// for iOS home screens, and `public/housing-preview.png` for shared links — a fixed address rather
// than Next's `opengraph-image` convention, because every page names it (`lib/meta.ts`). Run by hand after
// the icon changes: `node scripts/make-site-images.mjs`. The outputs are committed, so a
// build needs no image tooling.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const icon = readFileSync(new URL("../app/icon.svg", import.meta.url));
const mark = icon.toString().replace(/^<svg[^>]*>|<\/svg>\s*$/g, "");

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
  <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#202b28" stroke-opacity=".04"/></pattern></defs>
  <rect width="1200" height="630" fill="#f3f1e8"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <text x="76" y="91" font-family="Menlo, monospace" font-size="19" letter-spacing="2.5" fill="#53675d">PUBLIC DATA. A CLEARER PICTURE.</text>
  <text x="72" y="224" font-family="Georgia, serif" font-size="104" letter-spacing="-4" fill="#202b28">Housing</text>
  <text x="72" y="334" font-family="Georgia, serif" font-size="104" letter-spacing="-4" fill="#202b28">Intelligence</text>
  <text x="76" y="407" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="29" fill="#53675d">A clearer picture of the place you could call home.</text>
  <g transform="translate(860 158)" fill="none" stroke="#377762" stroke-width="1.5">
    <circle cx="124" cy="129" r="122" fill="#377762" fill-opacity=".05" stroke="none"/>
    <path d="M-25 255H263M0 102 119 9 238 102M15 91V255M223 91V255M28 275H210M28 269V281M210 269V281"/>
    <path d="M28 140H55V255H28ZM85 98H112V255H85ZM142 117H169V255H142ZM199 166H226V255H199Z" fill="#377762" fill-opacity=".12" stroke="none"/>
    <path d="M-30 202Q48 122 126 156T262 90M-30 225Q48 145 126 179T262 113M-30 248Q48 168 126 202T262 136" stroke-opacity=".22"/>
  </g>
  <svg x="1040" y="52" width="74" height="74" viewBox="0 0 64 64">${mark}</svg>
  <path d="M76 486H1124" stroke="#202b28" stroke-opacity=".18"/>
  <text x="76" y="547" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="25" fill="#202b28">Free to use. Every figure traced to its source.</text>
  <text x="1124" y="592" text-anchor="end" font-family="Menlo, monospace" font-size="21" fill="#53675d">housing.jasonli.app</text>
</svg>`;
// Keep the previous URL working for already shared links; new metadata names a fresh URL.
await sharp(Buffer.from(preview)).png().toFile(new URL("../public/og-image.png", import.meta.url).pathname);
await sharp(Buffer.from(preview)).png().toFile(new URL("../public/housing-preview.png", import.meta.url).pathname);
console.log("wrote app/favicon.ico, app/apple-icon.png, public/og-image.png, public/housing-preview.png");
