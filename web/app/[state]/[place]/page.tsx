import { notFound } from "next/navigation";

import { PlaceBriefing } from "@/components/PlaceBriefing";
import { api, regionsWithData } from "@/lib/api";
import { pageMetadata, regionTitle } from "@/lib/meta";
import { placeLine } from "@/lib/names";
import { hasBriefing, placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { standsOut } from "@/lib/takeaways";
import { PlacePoster } from "./PlacePoster";

/**
 * Which region pages exist: every region carrying data except the state, whose page
 * folded into the New Jersey page (ARCHITECTURE #127). `output: "export"` writes only
 * what this lists.
 */
export async function generateStaticParams() {
  return placeRouteParams(await regionsWithData());
}

/**
 * Each place's own title and description (#358), so a tab, a search result and a shared
 * link name the town. A town's address is its briefing (#520), so its description is the
 * briefing's own first finding: where the town stands out.
 */
export async function generateMetadata({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  const region = regionId === null ? null : await api.region(regionId);
  if (regionId === null || !region) return {};
  if (hasBriefing(regionId)) {
    const top = standsOut((await api.packet(regionId, "5y"))?.levels ?? []).map((x) => x.t.topic);
    const stands = top.length ? `stands out on ${top.join(", ").replace(/, ([^,]*)$/, " and $1")}` : "in seven slides";
    return pageMetadata({
      title: `${regionTitle(region)} — Housing`,
      description: `${placeLine(region)}. A seven-slide briefing: ${region.name} ${stands}, with prices, taxes, flood risk and its homes beside New Jersey’s median town.`,
      path: regionPath(regionId),
    });
  }
  return pageMetadata({
    title: `${regionTitle(region)} — Housing`,
    description: `${placeLine(region)}: home values, rents, what it costs to own or rent, and local conditions, with every figure traced to its public source.`,
    path: regionPath(regionId),
  });
}

/** A place's own address: a New Jersey town's briefing, or any other place's full page. */
export default async function PlacePage({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  if (regionId === null) notFound();
  return hasBriefing(regionId) ? <PlaceBriefing regionId={regionId} /> : <PlacePoster regionId={regionId} />;
}
