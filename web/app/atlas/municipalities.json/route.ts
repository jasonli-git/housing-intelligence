import { api } from "@/lib/api";
import { pack } from "@/lib/mapdata";
export const dynamic="force-static";
export async function GET() {
  // New Jersey's towns for the atlas (Director Note "Visualizing the data", 2026-10-22).
  const geometry=await api.geo("municipality","NJ",.0005);
  return Response.json({outlines:geometry ? pack(geometry,"region_id") : []});
}
