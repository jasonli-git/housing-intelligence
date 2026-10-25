import { Term } from "@/components/Term";
import { NationalTrend, NationalTrendBackdrop } from "@/components/NationalTrend";
import { monthLabel, type ScoreTile } from "@/lib/nationalScoreboard";

const ARROW = { up: "▲", down: "▼", flat: "■" } as const;

/**
 * The home page's US market strip (Milestone 57): small scoreboard tiles, each its value,
 * its change from a year earlier, and a faint line of the last two years behind it.
 * Colour says whether the change makes buying or renting easier, and the tile's sentence
 * says so in words, so neither arrow nor colour is the only way to read it.
 */
export function NationalScoreboard({ tiles }: { tiles: ScoreTile[] }) {
  if (!tiles.length) return null;
  const newest = tiles.map((t) => t.trend.at(-1)?.date ?? "").sort().at(-1);
  return <section className="national-strip" aria-labelledby="national-strip-heading">
    <header className="national-strip-head">
      <h2 id="national-strip-heading"><span className="national-strip-live" aria-hidden="true" />US market</h2>
      <p>{newest ? <>Latest through {monthLabel(newest)} · </> : null}vs. a year earlier · <span className="tone-key tone-easier">easier</span> <span className="tone-key tone-harder">harder</span> for buyers and renters</p>
    </header>
    <ul className="national-strip-track" aria-label="US housing figures">
      {tiles.map((t) => <li key={t.id} className="score-tile" data-tile={t.id} data-tone={t.tone}>
        <p className="visually-hidden">{t.summary}</p>
        <div className="score-tile-top" aria-hidden="true"><span className="score-tile-label">{t.label}</span></div>
        <strong className="score-tile-value" aria-hidden="true">{t.value}</strong>
        <div className="score-tile-foot" aria-hidden="true">
          {t.change ? <span className="score-tile-change">{t.direction && <span className="score-tile-arrow">{ARROW[t.direction]}</span>}{t.change}</span> : <span className="score-tile-change score-tile-none">—</span>}
          <NationalTrendBackdrop points={t.trend} />
        </div>
        <p className="score-tile-meta"><span aria-hidden="true">{t.period} · </span><a href={t.source.href} target="_blank" rel="noreferrer noopener">{t.source.name}<span className="visually-hidden"> (source for {t.label}, opens in a new tab)</span></a></p>
      </li>)}
    </ul>
    <details className="national-history">
      <summary>History &amp; definitions</summary>
      <div className="national-history-grid">
        {tiles.map((t) => <div key={t.id}>
          <div className="national-benchmark-definition"><Term id={t.metricId}>{t.label}</Term></div>
          <NationalTrend points={t.trend} label={`${t.label}, last two years`} metricId={t.metricId} frequency={t.id === "rate" && t.metricId.endsWith("weekly") ? "Weekly" : "Monthly"} unit={t.unit} />
        </div>)}
      </div>
      <p className="national-backdrop-note">Each line uses its own scale. Home prices and rent inflation are changes from a year earlier; the rest are levels. Historical figures, not forecasts.</p>
    </details>
  </section>;
}
