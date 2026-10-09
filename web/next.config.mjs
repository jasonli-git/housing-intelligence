const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// The published artifact origin, which a production build defaults to (#359). A static
// export bakes every URL into the HTML, and until 2026-10-09 a bare `npm run build` fell
// back to the API's localhost, shipping report links that point at the builder's laptop;
// `make check-dist` caught it, but only for a build headed for a deploy. A development
// server still reads artifacts from the local API, where they are rendered.
const PUBLISHED_ARTIFACTS = "https://housing-data.jasonli.app";
const ARTIFACT_URL =
  process.env.NEXT_PUBLIC_ARTIFACT_URL ??
  (process.env.NODE_ENV === "production" ? PUBLISHED_ARTIFACTS : API_URL);

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
    // One timestamp for the whole static export. A quiet Friday check can leave the
    // published snapshot untouched, so this must describe the build, not a data update.
    SITE_BUILT_AT: new Date().toISOString(),
    // Where the published artifacts are served from in production. Distinct from the
    // API origin: the JSON tree goes to object storage, which has no file-count limit,
    // while the HTML goes to a static host that does.
    NEXT_PUBLIC_ARTIFACT_URL: ARTIFACT_URL,
  },
};

export default nextConfig;
