import land from "@/lib/world-land.json";
import { unpack, type PackedOutline } from "@/lib/mapdata";

/**
 * A postcard-scale world silhouette behind the US state layer.
 *
 * Natural Earth 1:110m land, version 4.0.0, is intended for small locator maps and is
 * public domain. It is generated once into the same delta-packed rings as map.json,
 * not fetched in the browser and never used as a data geography.
 * https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/
 */
export const WORLD_LAND = unpack(land.outlines as PackedOutline[]);

