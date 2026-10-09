"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import { entryPath, type SearchEntry } from "@/lib/search";

/**
 * Find a county, municipality or ZIP code by name (Milestone 17), in the shared bar since
 * Milestone 23 so every page has it — the county picker it replaced reached 21 places of
 * 1,134.
 *
 * `search.json` is fetched the first time the box is focused rather than carried in the
 * page, and picking a place opens its page. The wording names ZIP codes at the owner's
 * request, though "ZIP" is what draws iOS's offer of the reader's own postal code
 * (ARCHITECTURE #150): the picker reopens its list for any value AutoFill types, so the
 * offer is an annoyance rather than a dead end.
 *
 * The home page carries a second, larger one as its main action ("Find your place"), and
 * the bar's is left out there so the page has one search, not two.
 */
export function PlaceSearch({
  variant = "bar",
}: {
  /** "hero": the home page's own search, larger and labelled "Find your place". */
  variant?: "bar" | "hero";
} = {}) {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);
  const router = useRouter();

  function load() {
    if (requested.current) return;
    requested.current = true;
    fetch("/search.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: SearchEntry[]) => setEntries(data))
      .catch(() => setFailed(true));
  }

  return (
    <PlacePicker
      className={variant === "hero" ? "place-search place-search-hero" : "place-search"}
      role="search"
      entries={entries}
      failed={failed}
      onFocus={load}
      onPick={(entry) => router.push(entryPath(entry))}
      label="Search by state, town, county or ZIP code"
      placeholder={variant === "hero" ? "State, town, county or ZIP code" : "Search town, county or ZIP"}
      name={variant === "hero" ? "home-place-query" : "place-query"}
    />
  );
}
