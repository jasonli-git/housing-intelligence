import { api } from "@/lib/api";
import { pack, PRECISION } from "@/lib/mapdata";

/** Coverage locator geometry only; no local measures or municipal coordinates. */
export const dynamic = "force-static";

export async function GET() {
  const states = await api.backdrop();
  if (!states) return Response.json({ outlines: [] });
  return Response.json({ precision: PRECISION, outlines: pack(states, "code") });
}
