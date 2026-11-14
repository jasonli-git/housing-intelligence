import type { MetadataRoute } from "next";

import { regionsWithData } from "@/lib/api";
import { SITE_URL } from "@/lib/site";
import { fullPath, hasBriefing, placeRouteParams, regionPath } from "@/lib/placeRoutes";

// Written once at build, like every page of the static export.
export const dynamic = "force-static";

const PAGES = [
  "/",
  "/states/new-jersey",
  "/atlas",
  "/compare",
  "/guide",
  "/tax",
  "/freshness",
  "/changes",
  "/terms",
  "/sources",
  "/data",
  "/privacy",
];

/**
 * Every page a search engine should find (#358): the site's own pages and each region
 * page the export writes — the same list `generateStaticParams` uses, so a page cannot be
 * built and left out. A New Jersey town has two: its briefing at its address and its full
 * page at `/full` (ARCHITECTURE #520). The printable reports are left out: each repeats its region page.
 * No dates: a build date would say every page changed on every deploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const regions = (await regionsWithData()).filter((r) => r.level !== "state" && r.level !== "nation");
  placeRouteParams(regions); // Fail rather than publish unregistered/numeric new places.
  return [
    ...PAGES.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...regions.map((r) => ({ url: `${SITE_URL}${regionPath(r.region_id)}` })),
    ...regions.filter((r) => hasBriefing(r.region_id)).map((r) => ({ url: `${SITE_URL}${fullPath(r.region_id)}` })),
  ];
}
