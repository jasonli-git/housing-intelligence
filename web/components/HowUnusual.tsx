import type { Persistence } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";
import { againstUsual, leadSentence, spellsSentence } from "@/lib/persistence";

const FHFA = "https://www.fhfa.gov/data/hpi/datasets?tab=additional-data";
const SAIPE = "https://www.census.gov/programs-surveys/saipe.html";

/** Each year's distance from the usual level, as bars either side of it. */
function History({ data }: { data: Persistence }) {
  const points = data.series;
  if (points.length < 2) return null;
  const width = 640;
  const height = 160;
  const pad = 22;
  const span = Math.max(...points.map((p) => Math.abs(p.vs_median)), 1);
  const mid = height / 2;
  const step = (width - pad * 2) / (data.last_year - data.first_year + 1);
  const y = (v: number) => mid - (v / span) * (mid - 14);
  return (
    <figure className="persistence-history">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Home prices against income each year from ${data.first_year} to ${data.last_year}, above or below the usual level`}>
        <line x1={pad} x2={width - pad} y1={mid} y2={mid} className="persistence-median" />
        {points.map((p) => {
          const x = pad + (p.year - data.first_year) * step;
          const top = Math.min(y(p.vs_median), mid);
          return (
            <rect
              key={p.year}
              x={x + 1}
              width={Math.max(step - 2, 1)}
              y={top}
              height={Math.max(Math.abs(y(p.vs_median) - mid), 1)}
              className={p.year === data.last_year ? "persistence-bar latest" : p.vs_median > 0 ? "persistence-bar above" : "persistence-bar below"}
            >
              <title>{`${p.year}: ${againstUsual(p.vs_median)} the usual level`}</title>
            </rect>
          );
        })}
        <text x={pad} y={height - 4} className="persistence-axis">{data.first_year}</text>
        <text x={width - pad} y={height - 4} textAnchor="end" className="persistence-axis">{data.last_year}</text>
      </svg>
      <figcaption className="sales-note">The line is the usual level: the middle year of all {data.years}. Bars above it are years when homes cost more against income than usual.</figcaption>
    </figure>
  );
}

/**
 * Is today's price pressure unusual (Milestone 52, ARCHITECTURE #348)? Where home prices
 * against income sit against the place's own past, and how long earlier spells this high
 * lasted. Counties and the state; a description of the past, never a forecast.
 */
export function HowUnusual({ name, data, exhibit = false }: { name: string; data: Persistence | null; exhibit?: boolean }) {
  if (!data) return null;
  const lead = leadSentence(data, name);
  const spells = spellsSentence(data);
  return (
    <section className={`section sales how-unusual${exhibit ? " history-exhibit" : ""}`} aria-labelledby="how-unusual-heading">
      <div className="section-head">
        <h2 id="how-unusual-heading">{exhibit ? "Home prices against income" : "Is this unusual for here?"}</h2>
      </div>
      {/* SPEC principle 11: say what kind of figure this is where it is read. */}
      <p className="sales-note">{exhibit ? "New Jersey against its own history. Calculated from price and income estimates—not counted." : "Calculated here from two published estimates — a house price index and yearly income estimates — not counted."}</p>
      {data.withheld ? (
        <p className="sales-note">No long-run comparison is shown for {name}. {data.withheld}</p>
      ) : (
        <>
          {lead && <p className="sales-lead">{exhibit ? `${data.last_year}: ${againstUsual(data.vs_median!)} the usual level since ${data.first_year}.` : lead}</p>}
          {data.vs_median_low !== null && data.vs_median_high !== null && Math.round(data.vs_median_low) !== Math.round(data.vs_median_high) && (
            <p className="sales-note">Income is an estimate: within its margin, today is between {againstUsual(data.vs_median_low)} and {againstUsual(data.vs_median_high)} the usual level.</p>
          )}
          {!exhibit && spells && <p className="sales-note">{spells}</p>}
          {!exhibit && data.above_median_since !== null && data.above_median_since < data.last_year && (
            <p className="sales-note">It has been above its usual level every year since {data.above_median_since}.</p>
          )}
          <History data={data} />
          <p className="sales-note">{exhibit ? "Historical comparison—not a forecast." : "This describes the past. How an earlier spell ended says nothing certain about how this one will."}</p>
        </>
      )}
      <ReaderDetails title="How this is worked out">
        {exhibit && !data.withheld && <>{lead && <p className="sales-note">{lead}</p>}{spells && <p className="sales-note">{spells}</p>}{data.above_median_since !== null && data.above_median_since < data.last_year && <p className="sales-note">Above its usual level every year since {data.above_median_since}.</p>}</>}
        <p className="sales-note">
          Each year, <a href={FHFA}>FHFA’s house price index</a> for {name} divided by the
          Census Bureau’s <a href={SAIPE}>estimate of median household income</a>, compared with the
          middle year of every year since {data.first_year}. An index, not dollars: it compares {name} with
          its own past only, never with another place.
          {data.missing_years.length > 0 && <> No income estimate was published for {data.missing_years.join(", ")}, so a spell is never counted across those years.</>}
          {data.validation && <> Checked against the price-to-income figure elsewhere on this page: from {data.validation.from} to {data.validation.to} the two moved {data.validation.agrees ? "the same way" : "opposite ways"}.</>}
        </p>
      </ReaderDetails>
    </section>
  );
}
