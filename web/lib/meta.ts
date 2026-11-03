import type { Metadata } from "next";

import { artifactUrl, type Region } from "@/lib/api";
import { displayName, legalType } from "@/lib/names";
import { SITE_NAME } from "@/lib/site";

/**
 * The site's share card (#358), named on every page: Next merges metadata shallowly, so a
 * page that sets its own `openGraph` or `twitter` replaces the layout's whole object,
 * image, site name and card size included. Rendered by `scripts/make-site-images.mjs`.
 */
const PREVIEW = {
  url: "/housing-preview.png",
  width: 1200,
  height: 630,
  alt: "Housing Intelligence — a clearer picture of the place you could call home. Free housing data, traced to its sources.",
};
export const SHARE_DEFAULTS = {
  openGraph: { siteName: SITE_NAME, type: "website" as const, locale: "en_US", images: [PREVIEW] },
  twitter: { card: "summary_large_image" as const, images: [PREVIEW] },
};

/**
 * A page's title, description and the same pair for shared links (#358). Social sites read
 * `og:title` and `og:description`, which Next does not derive from the title, so a page
 * that sets only a title shares as the site's generic card. The canonical address keeps
 * one URL per page for search engines; the share card is `SHARE_DEFAULTS`.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const images = storyShareImage(path, title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARE_DEFAULTS.openGraph, title, description, url: path, ...(images && { images }) },
    twitter: { ...SHARE_DEFAULTS.twitter, title, description, ...(images && { images }) },
  };
}

/** Stories that show no chart until a reader picks a town, so the deploy draws no card for
 *  them (story-share.mjs skips them and says so) and their previews keep the site's image. */
export const NO_SHARE_CARD = new Set(["health-in-context", "sites-and-cleanup", "where-internet-reaches", "when-the-power-goes-out", "where-students-go"]);

/**
 * A visual story's own share card (Director Note "Social export", 2026-11-03): its title,
 * takeaway and chart, drawn at deploy by `scripts/story-share.mjs` beside the artifacts.
 */
function storyShareImage(path: string, title: string) {
  const slug = path.match(/^\/stories\/([a-z0-9-]+)$/)?.[1];
  return slug && !NO_SHARE_CARD.has(slug) ? [{ url: `${artifactUrl}/screenshots/share/${slug}.jpg`, width: 1200, height: 630, alt: title.replace(/ — Housing$/, "") }] : null;
}

/**
 * A region as a page title names it: "Boonton township, Morris County, NJ" rather than
 * "Boonton", since four New Jersey pairs share a name and a county and only TIGER's legal
 * type tells them apart; "Atlantic County, NJ"; "ZIP 07001, NJ".
 */
export function regionTitle(region: Region & { ancestors?: Region[] }): string {
  const state = region.state_code;
  if (region.level !== "municipality") return `${displayName(region)}, ${state}`;
  const type = legalType(region);
  const county = region.ancestors?.find((a) => a.level === "county");
  return [type ? `${region.name} ${type}` : region.name, county ? displayName(county) : null, state]
    .filter(Boolean)
    .join(", ");
}
