import { Gloss } from "@/components/Gloss";
import type { CommunityContext, PacketLevel, WorkDestinations } from "@/lib/api";
import { lending } from "@/lib/lending";
import { commutePicture } from "@/lib/gettingAround";
import { formatValue } from "@/lib/format";
import { LearningExhibit } from "./LearningExhibit";
import { MortgageLending } from "./MortgageLending";
import { GettingAround } from "./GettingAround";
import { StateBroadband } from "./StateBroadband";

export function StateContextExhibits({ levels, destinations, community, name, level = "state", topics = ["lending","work","broadband"] }: {
  levels: PacketLevel[]; destinations: WorkDestinations | null; community: CommunityContext | null; name:string; level?:string; topics?:readonly ("lending"|"work"|"broadband")[];
}) {
  const loans = lending(levels);
  const commute = commutePicture(levels);
  const commutePeriod = levels.find(row => row.metric_id === "acs_mean_commute_minutes");
  const leading = destinations?.destinations.slice(0, 3) ?? [];
  return <>
    {topics.includes("lending") && <LearningExhibit kind="Buyer financing">
      <section aria-labelledby="state-loans-exhibit"><h2 id="state-loans-exhibit">What did buyers borrow?</h2>
        {loans ? <>
          <dl className="state-exhibit-readouts">
            {loans.loan !== null && <div><dt><Gloss>Median loan</Gloss></dt><dd>{formatValue(loans.loan, "usd")}</dd></div>}
            {loans.rate !== null && <div><dt>Median rate</dt><dd>{loans.rate.toFixed(2)}%</dd></div>}
            {loans.ltv !== null && <div><dt>Loan / home value</dt><dd>{loans.ltv.toFixed(0)}%</dd></div>}
          </dl>
          <p className="sales-note">{loans.year} purchase mortgages—not current offers or cash purchases.{loans.estimated && " Estimated from census tracts, not town-level records."}</p>
          <details><summary>Loan programmes, applications &amp; limits</summary><MortgageLending name={name} levels={levels} /></details>
        </> : <p>Mortgage records are unavailable in this snapshot.</p>}
      </section>
    </LearningExhibit>}
    {topics.includes("work") && <LearningExhibit kind="Work & transit">
      <section aria-labelledby="state-work-exhibit"><h2 id="state-work-exhibit">Where does the workday lead?</h2>
        {commute?.minutes !== null && commute?.minutes !== undefined && <p className="state-commute-lead"><strong>{Math.round(commute.minutes)} min</strong> average commute · Census survey estimate{commutePeriod && ` · ${commutePeriod.period_start?.slice(0,4) ?? ""}–${commutePeriod.period_end.slice(0,4)}`}</p>}
        {leading.length > 0 && <ol className="state-job-preview">{leading.map(d => <li key={d.rank}><span>{d.name}</span><b>{(d.share * 100).toFixed(1)}%</b><i aria-hidden="true" style={{ width:`${Math.max(0, Math.min(100, d.share * 100))}%` }} /></li>)}</ol>}
        <p className="sales-note">{destinations ? `${destinations.year} · Top reported destinations for jobs held by residents—not a count of commuters.` : "Work destinations are unavailable in this snapshot."}</p>
        <details><summary>Commute modes, transit &amp; all destinations</summary><GettingAround name={name} level={level} levels={levels} destinations={destinations} /></details>
      </section>
    </LearningExhibit>}
    {topics.includes("broadband") && (level === "state" || level === "county") && <LearningExhibit kind="Broadband"><section aria-labelledby="state-network-exhibit"><h2 id="state-network-exhibit">How connected is the {level}?</h2><StateBroadband data={community} name={name} /></section></LearningExhibit>}
  </>;
}
