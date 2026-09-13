import { regionsWithData } from "@/lib/api";
import { searchEntries } from "@/lib/search";

/**
 * The search index, written to `search.json` at build beside the pages (a static export
 * renders a GET route handler to a file).
 *
 * A file fetched on first use rather than data embedded in the page: about 1,100 entries
 * would ride in every one of 1,134 pages that never search, and the export is already
 * half a gigabyte.
 */
export const dynamic = "force-static";

export async function GET() {
  return Response.json(searchEntries(await regionsWithData()));
}
