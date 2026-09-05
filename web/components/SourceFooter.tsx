import { api } from "@/lib/api";

/**
 * Site-wide attribution: every source behind any figure on the page, with its terms.
 *
 * This is a licence condition rather than a courtesy. Zillow publishes ZHVI and ZORI
 * "free for non-commercial use with attribution", and the landing page's choropleth and
 * ranking table are both `zhvi_sfr` — so before this existed, the most-visited page on
 * the site displayed Zillow data while naming no source at all. Report pages were always
 * covered, because a packet carries its sources and the report prints them; nothing else
 * was.
 *
 * Rendered from `GET /sources`, which reads the same `sources` table the packet does.
 * Hard-coding the list here would have been half the work and would drift the first time
 * a source was added — and drift here is a licence problem, not a stale-copy problem.
 *
 * Absent rather than wrong when the API cannot be reached: an attribution block listing
 * sources that may not be the ones actually behind the page would be worse than none,
 * and `make check-dist` already refuses to deploy a tree built without a live API.
 */
export async function SourceFooter() {
  const sources = await api.sources();
  if (!sources?.length) return null;

  // `hip_derived` is the platform's own computed metrics, not a third party to credit.
  const external = sources.filter((s) => s.source_id !== "hip_derived");
  const restricted = external.filter((s) =>
    s.license.toLowerCase().includes("non-commercial"),
  );

  return (
    <footer className="site-footer">
      <h2>Sources</h2>
      <p className="muted">
        Every figure on this site comes from one of these, and carries its release and
        match method in the underlying packet.
      </p>
      <ul className="source-list">
        {external.map((source) => (
          <li key={source.source_id}>
            {/* `homepage`, not `url`: for API-fetched sources the canonical root is
                the API itself, which returns JSON or a 404 to a reader who clicks it. */}
            <a href={source.homepage} rel="noreferrer noopener" target="_blank">
              {source.name}
            </a>
            <span className="source-publisher">{source.publisher}</span>
            <span className="source-license">{source.license}</span>
          </li>
        ))}
      </ul>
      {restricted.length > 0 && (
        <p className="source-restriction">
          <strong>Not for commercial use.</strong>{" "}
          {restricted.map((s) => s.name).join(" and ")}{" "}
          {restricted.length === 1 ? "is" : "are"} licensed for non-commercial use with
          attribution. Figures derived from{" "}
          {restricted.length === 1 ? "it" : "them"} — including the downloadable reports —
          carry that restriction onward, and this site cannot grant terms it was not
          given.
        </p>
      )}
      <p className="muted">
        Analysis and code are MIT licensed; the data is not ours to relicense. See{" "}
        <a
          href="https://github.com/jasonli-git/housing-intelligence/blob/main/NOTICE"
          rel="noreferrer noopener"
          target="_blank"
        >
          NOTICE
        </a>{" "}
        for the full terms.
      </p>
    </footer>
  );
}
