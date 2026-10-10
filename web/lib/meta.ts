import type { Metadata } from "next";

import { type Region } from "@/lib/api";
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
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARE_DEFAULTS.openGraph, title, description, url: path },
    twitter: { ...SHARE_DEFAULTS.twitter, title, description },
  };
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
