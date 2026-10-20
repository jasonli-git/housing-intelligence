"use client";

import { useEffect } from "react";

/**
 * Sends an old `?mode=afford` bookmark of a place page (#305) to the budget explorer for
 * that place, which is what the mode was. A static page cannot redirect on a query
 * string, so this runs once it loads; anything else in the address rides along.
 */
export function AffordForward({ placeId }: { placeId: number | null }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "afford") return;
    params.delete("mode");
    if (placeId !== null) params.set("place", String(placeId));
    const rest = params.toString();
    window.location.replace(`/afford${rest ? `?${rest}` : ""}`);
  }, [placeId]);
  return null;
}
