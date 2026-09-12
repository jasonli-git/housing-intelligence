import Link from "next/link";
import { Fragment } from "react";

import { Glossed } from "@/components/Glossed";
import { ChangeCell, Marks, NoteRows, TableNotes } from "@/components/Ledger";
import { PrintButton } from "@/components/PrintButton";
import { api, artifactUrl, type Packet, regionsWithData } from "@/lib/api";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { formatChange, formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, windowLabel } from "@/lib/periods";
import { isRestricted } from "@/lib/sources";

const WINDOW = "5y";

/**
 * Which end of its cohort a highlight sits at, in words its metric can support: `best`
 * and `worst` only where the metric's direction defines a good end. A neutral metric —
 * home value, a Fair Market Rent, a homeownership or vacancy rate — ranks largest first
 * with no judgement attached. Mirrors `_end` in `hip/packets/report.py`.
 */
function rankEnd(position: string, direction: string | undefined): string {
  const leading = position === "leading";
  if (direction === "neutral") return leading ? "top" : "bottom";
  return leading ? "best" : "worst";
}

/** IRS migration vintages are tax-year pairs: "1718" is 2017–18. */
function vintage(sourceId: string, value: string): string {
  return sourceId === "irs_migration" && /^\d{4}$/.test(value)
    ? `20${value.slice(0, 2)}–${value.slice(2)}`
    : value;
}

type SourceGroup = {
  source_id: string;
  name: string;
  publisher: string;
  license: string;
  vintages: string[];
  fetched: string;
};

/** A packet's releases folded to one row per source, its vintages listed together. */
function bySource(sources: Packet["sources"]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const s of sources) {
    const group = groups.get(s.source_id) ?? {
      source_id: s.source_id,
      name: s.name,
      publisher: s.publisher,
      license: s.license,
      vintages: [],
      fetched: s.fetched_at,
    };
    group.vintages.push(vintage(s.source_id, s.vintage));
    if (s.fetched_at > group.fetched) group.fetched = s.fetched_at;
    groups.set(s.source_id, group);
  }
  return [...groups.values()];
}

/**
 * Which region reports exist: every region carrying data except the state, whose page
 * folded into the New Jersey page (ARCHITECTURE #127).
 *
 * Under `output: "export"` this is what tells Next how many pages to write; without it
 * a dynamic segment has no enumeration and the export fails.
 */
export async function generateStaticParams() {
  const regions = await regionsWithData();
  return regions.filter((r) => r.level !== "state").map((r) => ({ id: String(r.region_id) }));
}

/**
 * The exportable region report, laid out from the analysis packet.
 *
 * The same packet the API serves and `hip pack` writes, rendered for a screen and a
 * sheet of paper instead of for a model. That is the point of the contract: two media,
 * one source of numbers, no second query path to keep in step. The Markdown export
 * below is the same packet through `hip.packets.report` — and since that rendering is
 * also a model's prompt, it keeps its own formatting (shares as ratios) while this page
 * shows them as percentages (ARCHITECTURE #124).
 *
 * Caveats are lettered on the rows they qualify and set out under each table, which is
 * where "beside the figure" lands on paper (#123). The scopes come from the summary; the
 * packet stays the authority on which caveats appear.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const regionId = Number(id);
  const [packet, summary] = await Promise.all([
    api.packet(regionId, WINDOW),
    api.summary(regionId, WINDOW),
  ]);

  if (!packet) {
    return (
      <main className="shell report">
        <h1 className="page-title">No report</h1>
        <p className="meta">
          Region {id} has no analytics for the {WINDOW} window, or the API is unreachable.{" "}
          <Link href={`/regions/${id}`}>Back to the region</Link>.
        </p>
      </main>
    );
  }

  const { region, window, comparisons } = packet;
  const name = displayName(region);
  const defined = new Set<string>();
  const directions = new Map(packet.metrics.map((m) => [m.metric_id, m.direction]));
  const measureSections = groupRows(packet.metrics);
  const levelSections = groupRows(packet.levels);
  const placement = placeCaveats(
    [
      measureSections.flatMap((s) => s.rows.map((m) => m.metric_id)),
      levelSections.flatMap((s) => s.rows.map((l) => l.metric_id)),
    ],
    scopesFor(packet.caveats, summary?.caveat_scopes ?? []),
  );
  const [measures, current] = placement.tables;
  const sources = bySource(packet.sources);
  const sourceNames = new Map(sources.map((s) => [s.source_id, s.name]));
  const restricted = sources.filter(isRestricted).map((s) => s.name);

  return (
    <main className="shell report">
      <header className="page-head">
        <div>
          <p className="crumbs print-hide">
            <Link href="/">New Jersey</Link>
            {region.parent && region.parent.level !== "state" && (
              <>
                {" / "}
                <Link href={`/regions/${region.parent.region_id}`}>
                  {displayName(region.parent)}
                </Link>
              </>
            )}
            {" / "}
            <Link href={`/regions/${regionId}`}>{name}</Link>
            {" / Report"}
          </p>
          <h1 className="page-title">{region.label} — housing report</h1>
          <p className="meta">
            {packet.metrics.length} measures over the five-year change window, each ranked
            against {scopeName(comparisons.peer_scope)}’s {comparisons.peer_count}{" "}
            {peerNoun(comparisons.peer_level)}.
          </p>
          <p className="muted">
            {/* The envelope, not a span every metric covers: sources publish at different
                frequencies, so each metric resolves the window to its own dates. The
                table gives them. */}
            Between them the measures reach from {periodLabel(window.start)} to{" "}
            {periodLabel(window.end)}; each covers its own window, given in the table.
          </p>
        </div>
        <div className="actions print-hide">
          <PrintButton />
          {/*
            The published artifact path, not the API's. A static file cannot vary on
            `?window=`, so `hip publish` writes the window as a path segment; this href
            has to name the file that actually exists. In development both origins
            default to the local API, where this path is served by `hip publish`'s
            output rather than by FastAPI — so check the link against a published tree,
            not against `make api`.
          */}
          <a
            className="button"
            href={`${artifactUrl}/regions/${regionId}/report/${WINDOW}.md`}
            download={`${region.geoid}.md`}
          >
            Download Markdown
          </a>
        </div>
      </header>

      {packet.highlights.length > 0 && (
        <section className="section">
          <h2>Where {name} stands out</h2>
          <ul className="standouts">
            {packet.highlights.map((h) => (
              <li key={h.metric_id}>
                <span className="r">
                  {h.rank} / {h.of}
                  <small>{rankEnd(h.position, directions.get(h.metric_id))} end</small>
                </span>
                <span className="what">{h.label}</span>
                <span className="how">{formatChange(h.pct_change)} over its window</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Measures</h2>
        <div className="scroll-x">
          <table className="doc">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">Start</th>
                <th scope="col" className="num">Latest</th>
                <th scope="col" className="num">Change</th>
                <th scope="col" className="num">Per year</th>
                <th scope="col" className="num">Rank</th>
                <th scope="col">Window</th>
              </tr>
            </thead>
            {measureSections.map((section) => (
              <tbody key={section.key}>
                <tr className="group">
                  <th colSpan={7} scope="colgroup">
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((m) => (
                  <Fragment key={m.metric_id}>
                    <tr className={measures.inline.has(m.metric_id) ? "has-note" : undefined}>
                      <td>
                        <Glossed text={m.label} defined={defined} />
                        <Marks letters={measures.marks.get(m.metric_id)} />
                      </td>
                      <td className="num">{formatMetric(m.start_value, m.unit, m.metric_id)}</td>
                      <td className="num">{formatMetric(m.end_value, m.unit, m.metric_id)}</td>
                      <ChangeCell pct={m.pct_change} className="num" />
                      <td className="num">{m.cagr === null ? "—" : `${m.cagr.toFixed(1)}%/yr`}</td>
                      <td className="num">{m.rank === null ? "—" : `${m.rank} / ${m.of}`}</td>
                      <td className="when">
                        {windowLabel(m.window_start, m.window_end, m.metric_id)}
                      </td>
                    </tr>
                    <NoteRows id={m.metric_id} texts={measures.inline.get(m.metric_id)} span={7} />
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <TableNotes placement={measures} general={placement.general} above="the table above" />
        <p className="table-note">
          Rank 1 is the better end of the cohort where a measure defines one, and otherwise
          the largest rise.
        </p>
      </section>

      {packet.levels.length > 0 && (
        <section className="section">
          <h2>Current values</h2>
          <p className="table-note">
            Ranked by value rather than by change. HUD’s CHAS tables and the MOD-IV
            assessment records are single snapshots, so they appear only here.
          </p>
          <div className="scroll-x">
            <table className="doc">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">Value</th>
                  <th scope="col" className="num">Rank</th>
                  <th scope="col">As of</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              {levelSections.map((section) => (
                <tbody key={section.key}>
                  <tr className="group">
                    <th colSpan={5} scope="colgroup">
                      {section.title}
                    </th>
                  </tr>
                  {section.rows.map((l) => (
                    <Fragment key={l.metric_id}>
                      <tr className={current.inline.has(l.metric_id) ? "has-note" : undefined}>
                        <td>
                          <Glossed text={l.label} defined={defined} />
                          <Marks letters={current.marks.get(l.metric_id)} />
                        </td>
                        <td className="num">{formatMetric(l.value, l.unit, l.metric_id)}</td>
                        <td className="num">{l.rank === null ? "—" : `${l.rank} / ${l.of}`}</td>
                        <td className="when">{periodLabel(l.period_end, l.metric_id)}</td>
                        <td>{(l.source_id && sourceNames.get(l.source_id)) ?? l.source_id ?? "—"}</td>
                      </tr>
                      <NoteRows id={l.metric_id} texts={current.inline.get(l.metric_id)} span={5} />
                    </Fragment>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <TableNotes placement={current} above="the table above" />
        </section>
      )}

      <section className="section">
        <h2>Sources</h2>
        <div className="scroll-x">
          <table className="doc">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Publisher</th>
                <th scope="col">Vintages</th>
                <th scope="col">Retrieved</th>
                <th scope="col">Licence</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source_id}>
                  <td>{s.name}</td>
                  <td>{s.publisher}</td>
                  <td className="when">{s.vintages.join(", ")}</td>
                  <td className="when">{s.fetched.slice(0, 10)}</td>
                  <td>{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* The report's own copy of the terms: a printout leaves the licence line behind
            with the rest of the site, and a forwarded PDF is the copy most likely to
            reach someone who never saw the site. */}
        {restricted.length > 0 && (
          <p className="restriction">
            <strong>Not for commercial use.</strong> {restricted.join(" and ")}{" "}
            {restricted.length === 1 ? "is" : "are"} licensed for non-commercial use with
            attribution. Figures derived from {restricted.length === 1 ? "it" : "them"} —
            this report included — carry that restriction onward, and this site cannot grant
            terms it was not given.
          </p>
        )}
      </section>

      <footer className="muted">
        Generated from analysis packet {packet.packet_version} for region {region.region_id}{" "}
        (GEOID {region.geoid}). Every figure is read from the housing warehouse and produced
        by the sources above, subject to the notes. Nothing in this report is model-generated.
      </footer>
    </main>
  );
}
