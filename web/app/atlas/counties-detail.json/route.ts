import { atlasOutlines } from "@/lib/atlasOutlines";
export const dynamic="force-static";
/** The atlas's detailed county outlines, fetched when the map is zoomed in (lib/atlasOutlines.ts). */
export async function GET() {
  return Response.json({outlines:await atlasOutlines("county","detail")});
}
