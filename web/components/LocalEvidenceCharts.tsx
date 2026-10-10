import type { Observation, PacketLevel } from "@/lib/api";
import { constructionYears } from "@/lib/construction";
import { workPicture } from "@/lib/gettingAround";

export function LocalEvidenceCharts({ name, level, levels, series }: { name: string; level: string; levels: PacketLevel[]; series: Observation[][] }) {
  const rows = constructionYears({ permitted: series[0], completed: series[1], demolished: series[2], net: series[3] }).reverse();
  const max = Math.max(1, ...rows.flatMap(r => [r.completed ?? 0, r.demolished ?? 0]));
  const shareIds = ["lodes_work_home_county_share", "lodes_work_other_nj_share", "lodes_work_nyc_share", "lodes_work_pennsylvania_share", "lodes_work_other_state_share"];
  const shares = shareIds.map(id => levels.find(row => row.metric_id === id)?.value);
  const completeWork = shares.every(value => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1)
    && Math.abs(shares.reduce<number>((sum, value) => sum + (value ?? 0), 0) - 1) < .001;
  const work = level === "county" && completeWork ? workPicture(levels, level, name) : null;
  return <section className="local-evidence-charts" aria-label="Building and work patterns">
    {rows.length > 0 && <figure><figcaption>Homes added and removed <small>Annual reported completions and demolitions · not permits</small></figcaption>
      <p className="chart-key">■ Completed · ▧ Demolished</p>
      {rows.map(r => <div className="construction-chart-row" key={r.year}><strong>{r.year}{r.preliminary ? "*" : ""}</strong><div>{([['Completed', r.completed], ['Demolished', r.demolished]] as const).map(([label, value]) => <div className="evidence-bar-row" key={label}><span className="visually-hidden">{label}</span><i aria-hidden="true" data-kind={label} style={{ width: `${(value ?? 0) / max * 100}%` }}/><span>{value === null ? "Not reported" : value.toLocaleString('en-US')}</span></div>)}</div><small>Net {r.net === null ? "not reported" : r.net.toLocaleString('en-US')}</small></div>)}
      <p className="table-note">NJ DCA construction records. Totals cover reporting towns only; missing reports are not zero. Net counts towns reporting both measures, while each bar covers its own reporters—so county totals may not subtract to the displayed net. * Preliminary. See building detail for coverage and sources.</p></figure>}
    {work && <figure><figcaption>Where residents work <small>{work.year} · shares of jobs held by residents, not people or commuters</small></figcaption>{work.shares.map(s => <div className="work-chart-row" key={s.key}><span>{s.label}</span><div className="evidence-bar-row"><i aria-hidden="true" style={{width: `${s.share * 100}%`}}/><strong>{(s.share * 100).toFixed(1)}%</strong></div></div>)}<p className="table-note">Census LODES. Excludes self-employed jobs; multiple jobs can count one person more than once. See commuting detail for the full coverage and source.</p></figure>}
  </section>;
}
