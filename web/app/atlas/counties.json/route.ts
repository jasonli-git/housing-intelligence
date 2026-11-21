import { atlasOutlines } from "@/lib/atlasOutlines";
export const dynamic="force-static";
/** The atlas's light county outlines, for the whole state (lib/atlasOutlines.ts). */
export async function GET() {
  return Response.json({outlines:await atlasOutlines("county","light")});
}
