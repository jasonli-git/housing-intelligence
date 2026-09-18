"use client";

import { useEffect, useMemo, useState } from "react";

import { type MapFile, unpack } from "@/lib/mapdata";
import type { Outline } from "@/lib/globe";

export type MapLayers = {
  nation: Outline[];
  county: Outline[];
  municipality: Outline[];
  /** The towns simplified harder, for when the whole state is on screen (`MapFile`). */
  municipalityWide: Outline[];
};

/**
 * `map.json`, fetched once and unpacked.
 *
 * A hook rather than a fetch inside the map, because the ranking beside the map reads
 * the same file: at municipal zoom there is no published ranking to list — 564 towns
 * across 29 measures and six windows would be a page of its own — so the table lists
 * what the map is drawing, from the map's own figures. One owner, one request.
 */
export function useMapFile(): {
  file: MapFile | null;
  layers: MapLayers | null;
  failed: boolean;
} {
  const [file, setFile] = useState<MapFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/map.json")
      .then((response) =>
        response.ok ? response.json() : Promise.reject(response.status),
      )
      .then((body: MapFile) => live && setFile(body))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // Unpacked once: the delta decoding walks every one of about 48,000 coordinates, and
  // redoing it on each render would do it again on every pan.
  const layers = useMemo(
    () =>
      file
        ? {
            nation: unpack(file.nation.outlines),
            county: unpack(file.county.outlines),
            municipality: unpack(file.municipality.outlines),
            municipalityWide: unpack(file.municipalityWide.outlines),
          }
        : null,
    [file],
  );

  return { file, layers, failed };
}
