import type { Place } from "@/lib/afford";

/** Explicit statewide scope wins; otherwise a profile link starts in its county. */
export function affordScope(params: URLSearchParams, places: Place[]) {
  const picked = places.find((place) => place.id === Number(params.get("place"))) ?? null;
  const requested = params.get("county");
  const countyId = requested === "all" ? null
    : places.find((place) => place.level === "county" && place.id === Number(requested))?.id
      ?? (picked?.level === "county" ? picked.id : picked?.parentId ?? null);
  return { pickedId: picked?.id ?? null, countyId };
}
