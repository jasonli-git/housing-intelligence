import { api } from "@/lib/api";

// Build-time public snapshot, not a runtime API or new acquisition path. Keeping it
// same-origin lets localhost and production use the same lazy directory request.
export const dynamic = "force-static";
export async function GET() {
  const states = await api.regions("level=state&state=NJ&limit=1");
  const state = states?.items[0];
  const inventory = state ? await api.affordableHousing(state.region_id, false) : null;
  return Response.json(inventory ?? { error: "The published inventory was unavailable at build time." });
}
