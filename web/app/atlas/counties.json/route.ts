import { api } from "@/lib/api";
import { pack } from "@/lib/mapdata";
export const dynamic="force-static";
export async function GET() {
  const geometry=await api.geo("county",.001);
  return Response.json({outlines:geometry ? pack(geometry,"region_id") : []});
}
