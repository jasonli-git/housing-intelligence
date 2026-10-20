import { api } from "@/lib/api";
import { pack } from "@/lib/mapdata";
export const dynamic="force-static";
export async function GET() {
  // The Atlas county level is deliberately New Jersey's (Decision #398).
  const geometry=await api.geo("county","NJ",.001);
  return Response.json({outlines:geometry ? pack(geometry,"region_id") : []});
}
