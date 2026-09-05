const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ARTIFACT_URL = process.env.NEXT_PUBLIC_ARTIFACT_URL ?? API_URL;

// A static export bakes every URL into the HTML, so an unset artifact origin is not a
// misconfiguration the site recovers from at runtime — it ships 1,135 pages whose
// "Download Markdown" link points at the builder's own laptop. Warned rather than
// thrown, because building locally against `make api` is a legitimate thing to do and
// is how the export gets checked at all.
if (process.env.NODE_ENV === "production" && ARTIFACT_URL.includes("localhost")) {
  console.warn(
    `\n  WARNING  NEXT_PUBLIC_ARTIFACT_URL is unset, so artifact links resolve to ` +
      `${ARTIFACT_URL}.\n           Every report page's Markdown download points at ` +
      `localhost in this build.\n           Set it to the published artifact origin ` +
      `before deploying.\n`,
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: every page is rendered at build time and written as HTML, so the
  // deployed site needs no Node server (ARCHITECTURE #68). The API still has to be
  // running *during* the build — that is where the data comes from — but nothing
  // fetches at request time, because there are no requests.
  output: "export",

  // Files, not directories: `regions/11.html` rather than `regions/11/index.html`.
  // `hip publish` writes `regions/11/summary/5y.json` under that same prefix, and a
  // directory-style export would put an `index.html` inside the directory the JSON
  // artifacts live in, leaving `/regions/11` ambiguous between a page and a folder.
  trailingSlash: false,

  // The dashboard talks to the API over HTTP only and shares no code with Python
  // (see the dependency rule in ARCHITECTURE.md).
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
    // Where the published artifacts are served from in production. Distinct from the
    // API origin: the JSON tree goes to object storage, which has no file-count limit,
    // while the HTML goes to a static host that does.
    NEXT_PUBLIC_ARTIFACT_URL: ARTIFACT_URL,
  },
};

export default nextConfig;
