import type { Observation, PacketLevel } from "@/lib/api";
import { workPicture } from "@/lib/gettingAround";
import { LearningExhibit } from "./LearningExhibit";

// Legacy props remain compatible; building now appears only in HomesAdded.
export function LocalEvidenceCharts({ name, level, levels, kind }: { name: string; level: string; levels: PacketLevel[]; series: Observation[][]; kind?:"building"|"work" }) {
  const shareIds = ["lodes_work_home_county_share", "lodes_work_other_nj_share", "lodes_work_nyc_share", "lodes_work_pennsylvania_share", "lodes_work_other_state_share"];
  const shares = shareIds.map(id => levels.find(row => row.metric_id === id)?.value);
  const completeWork = shares.every(value => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1)
    && Math.abs(shares.reduce<number>((sum, value) => sum + (value ?? 0), 0) - 1) < .001;
  const work = level === "county" && completeWork ? workPicture(levels, level, name) : null;
  if (kind === "building" || !work) return null;
  return <section className="local-evidence-charts" data-chart-kind="work" aria-label="Work patterns">
    <LearningExhibit kind="Job geography"><figure><figcaption>Where residents work <small>{work.year} · shares of jobs held by residents, not people or commuters</small></figcaption>{work.shares.map(s => <div className="work-chart-row" key={s.key}><span>{s.label}</span><div className="evidence-bar-row"><i aria-hidden="true" style={{width: `${s.share * 100}%`}}/><strong>{(s.share * 100).toFixed(1)}%</strong></div></div>)}<p className="table-note">Census LODES excludes self-employment; one person may hold multiple jobs. Sources in commuting detail.</p></figure></LearningExhibit>
  </section>;
}
