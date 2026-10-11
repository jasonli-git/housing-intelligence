import type { GuideHome } from "./guide";

/** Home figures travel only on an explicit Continue action, never between places. */
const KEY = "hip.guide.home.v1";
const keys: (keyof GuideHome)[] = ["price", "taxYear", "hoaMonth", "floodYear", "movingCost", "repairsCost"];
export function writeGuideTransfer(placeId: number, home: GuideHome, rent: number | null) {
  try { sessionStorage.setItem(KEY, JSON.stringify({placeId, home, rent})); } catch { /* Session storage is optional. */ }
}
export function readGuideTransfer(placeId: number): {home: GuideHome; rent: number | null} {
  const empty = {home: {}, rent: null};
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!value || value.placeId !== placeId) return empty;
    const home: GuideHome = {};
    for (const key of keys) {
      const number = value.home?.[key];
      if (typeof number === "number" && Number.isFinite(number) && number >= 0 && (key !== "price" || number > 0)) home[key] = number;
    }
    return {home, rent: typeof value.rent === "number" && Number.isFinite(value.rent) && value.rent > 0 ? value.rent : null};
  } catch { return empty; }
}
