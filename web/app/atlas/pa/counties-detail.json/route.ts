import { atlasOutlines } from "@/lib/atlasOutlines";
export const dynamic="force-static";
/** Pennsylvania's detail counties outlines for the atlas (lib/atlasOutlines.ts, Milestone 63). */
export async function GET() {
  return Response.json({outlines:await atlasOutlines("county","detail","PA")});
}
