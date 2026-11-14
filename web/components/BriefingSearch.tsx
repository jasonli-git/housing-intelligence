"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import { hasBriefing, regionPath } from "@/lib/placeRoutes";
import type { SearchEntry } from "@/lib/search";

/**
 * `/guide`, the briefing's entry in the Menu, as a search (ARCHITECTURE #520): picking a
 * town opens its own address, which is its briefing. An older link's `?place=<id>` is
 * sent to that town's address, since the briefing no longer loads in this page.
 */
export function BriefingSearch() {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("place"));
    if (id > 0) { window.location.replace(regionPath(id)); return; }
    fetch("/search.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: SearchEntry[]) => setEntries(data.filter((e) => hasBriefing(e.id))))
      .catch(() => setFailed(true));
  }, []);
  return <PlacePicker
    className="place-search place-search-hero bf-search"
    role="search"
    entries={entries}
    failed={failed}
    onPick={(entry) => router.push(regionPath(entry.id))}
    label="Search a New Jersey town for its briefing"
    placeholder="Search a town, e.g. Princeton"
    name="briefing-town"
  />;
}
