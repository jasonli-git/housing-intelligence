import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { api, formatChange, formatValue, publicApiUrl } from "@/lib/api";

const WINDOW = "5y";

/**
 * The exportable region report, laid out from the analysis packet.
 *
 * The same packet the API serves and `hip pack` writes, rendered for a screen and a
 * sheet of paper instead of for a model. That is the point of the contract: two media,
 * one source of numbers, no second query path to keep in step. The Markdown export
 * below is the same packet through `hip.packets.report`.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regionId = Number(id);
  const packet = await api.packet(regionId, WINDOW);

  if (!packet) {
    return (
      <main>
        <h1>No report</h1>
        <p className="sub">
          Region {id} has no analytics for the {WINDOW} window, or the API is
          unreachable. <Link href={`/regions/${id}`}>Back to the region</Link>.
        </p>
      </main>
    );
  }

  const { region, window, comparisons } = packet;

  return (
    <main className="report">
      <p className="muted print-hide">
        <Link href="/">Overview</Link>
        {" / "}
        <Link href={`/regions/${regionId}`}>{region.name}</Link>
        {" / report"}
      </p>

      <header>
        <h1>{region.label} — housing report</h1>
        <p className="sub">
          {packet.metrics.length} metrics over the {window.label} change window, ranked
          against {comparisons.peer_count} {comparisons.peer_level} regions in{" "}
          {comparisons.peer_scope}.
        </p>
        <p className="muted">
          {/* The envelope, not a span every metric covers: sources publish at
              different frequencies, so each metric resolves the window to its own
              dates. The table gives them. */}
          Between them the metrics reach from {window.start} to {window.end}; each one
          covers its own window, given below.
        </p>
        <p className="print-hide" style={{ display: "flex", gap: "0.75rem" }}>
          <PrintButton />
          <a
            href={`${publicApiUrl}/regions/${regionId}/report?window=${WINDOW}`}
            download={`${region.geoid}.md`}
          >
            Download Markdown
          </a>
        </p>
      </header>

      {packet.highlights.length > 0 && (
        <section>
          <h2>Where this region stands out</h2>
          <ul className="caveats">
            {packet.highlights.map((h) => (
              <li key={h.metric_id}>
                <strong>{h.label}</strong> — rank {h.rank} of {h.of} (
                {h.position === "leading" ? "best" : "worst"} end),{" "}
                {formatChange(h.pct_change)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Metrics</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Start</th>
                <th className="num">Latest</th>
                <th className="num">Change</th>
                <th className="num">Annualised</th>
                <th className="num">Rank</th>
                <th>Window</th>
              </tr>
            </thead>
            <tbody>
              {packet.metrics.map((m) => (
                <tr key={m.metric_id}>
                  <td>{m.label}</td>
                  <td className="num">{formatValue(m.start_value, m.unit)}</td>
                  <td className="num">{formatValue(m.end_value, m.unit)}</td>
                  <td className="num">{formatChange(m.pct_change)}</td>
                  <td className="num">
                    {m.cagr === null ? "—" : `${m.cagr.toFixed(1)}%/yr`}
                  </td>
                  <td className="num">
                    {m.rank === null ? "—" : `${m.rank} / ${m.of}`}
                  </td>
                  <td className="nowrap">
                    {m.window_start} → {m.window_end}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Rank 1 is the better end of the cohort as the metric defines better, not
          always the largest rise.
        </p>
      </section>

      {packet.caveats.length > 0 && (
        <section>
          <h2>Caveats</h2>
          <ul className="caveats">
            {packet.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Sources</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Publisher</th>
                <th>Vintage</th>
                <th>Retrieved</th>
                <th>Licence</th>
              </tr>
            </thead>
            <tbody>
              {packet.sources.map((s) => (
                <tr key={`${s.source_id}-${s.vintage}`}>
                  <td>{s.name}</td>
                  <td>{s.publisher}</td>
                  <td className="nowrap">{s.vintage}</td>
                  <td className="nowrap">{s.fetched_at.slice(0, 10)}</td>
                  <td>{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="muted">
        Generated from analysis packet {packet.packet_version} for region{" "}
        {region.region_id} (GEOID {region.geoid}). Every figure is read from the housing
        warehouse and produced by the sources above, subject to the caveats. Nothing in
        this report is model-generated.
      </footer>
    </main>
  );
}
