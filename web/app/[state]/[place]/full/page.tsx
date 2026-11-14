import { notFound } from "next/navigation";

import { api, regionsWithData } from "@/lib/api";
import { pageMetadata, regionTitle } from "@/lib/meta";
import { placeLine } from "@/lib/names";
import { fullPath, hasBriefing, placeRouteParams, resolvePlace } from "@/lib/placeRoutes";
import { PlacePoster } from "../PlacePoster";

/**
 * A New Jersey town's full page, one switch away from its briefing (ARCHITECTURE #520).
 * Only towns with a briefing have one: a county's or ZIP code's full page is its address.
 */
export async function generateStaticParams() {
  return placeRouteParams((await regionsWithData()).filter((r) => hasBriefing(r.region_id)));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  const region = regionId === null || !hasBriefing(regionId) ? null : await api.region(regionId);
  if (regionId === null || !region) return {};
  return pageMetadata({
    title: `${regionTitle(region)}, every figure — Housing`,
    description: `${placeLine(region)}: home values, rents, what it costs to own or rent, and local conditions, with every figure traced to its public source.`,
    path: fullPath(regionId),
  });
}

export default async function FullPlacePage({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  if (regionId === null || !hasBriefing(regionId)) notFound();
  return <PlacePoster regionId={regionId} />;
}
