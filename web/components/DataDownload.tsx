import { artifactUrl } from "@/lib/api";

/**
 * "Download this page's data" (Milestone 31): every figure in the page's tables as a CSV,
 * each row with its kind, source, release and licence, under header lines carrying the
 * citation, any non-commercial restriction and the notices the sources require. A
 * figure its owner lets the site show but not redistribute is left out, and the file
 * says so.
 *
 * The published artifact path, as the report's Markdown link is: a static file cannot
 * vary on `?window=`, so `hip publish` writes the window into the file's name, beside
 * the region's geoid. The name is the path's because the artifacts are on another
 * origin, where a browser ignores the `download` attribute's name. In
 * development `artifactUrl` is the local API, which serves `/regions/{id}/download` with
 * a query instead — check the link against a published tree.
 */
export function DataDownload({
  regionId,
  geoid,
  window,
  className = "data-download",
}: {
  regionId: number;
  geoid: string;
  window: string;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={`${artifactUrl}/regions/${regionId}/download/${geoid}-${window}.csv`}
      download={`${geoid}-${window}.csv`}
    >
      Download this page’s data (CSV)
    </a>
  );
}
