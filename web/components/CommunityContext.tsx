import type { CommunityContext as CommunityData } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";

const SPR = "https://www.nj.gov/education/schoolperformance/";
const BOUNDARIES = "https://www.arcgis.com/home/item.html?id=26a2a9f9cf0a472d865b367f88833336";
const FCC = "https://broadbandmap.fcc.gov/";

/** Compact components, not a neighbourhood grade, a school assignment or a safety verdict. */
export function CommunityContext({ data, level }: { data: CommunityData | null; level: string }) {
  if (!data) return null;
  const complete = data.crime.filter((r) => r.payload.complete).length;
  return <>
    <section className="section sales community-schools" aria-labelledby="community-schools-heading">
      <div className="section-head"><h2 id="community-schools-heading">Schools around here</h2></div>
      <p className="sales-note">A district is not a school assignment. Confirm the address, grade and enrollment rules with the district.</p>
      {data.districts.length ? <ReaderDetails title={`${data.districts.length} district association${data.districts.length === 1 ? "" : "s"} · see the figures`}>
        <p className="sales-note">Approximate overlaps of NJOGIS district boundaries with 2020 home-bearing census blocks. Elementary, secondary and unified districts can overlap; these are not pupil shares or legal boundaries.</p>
        {data.districts.map(({ boundary, performance }) => <div className="utility-provider" key={boundary.record_id}>
          <p><b>{boundary.payload.name}</b> <span className="meta">{boundary.payload.district_type} · {boundary.payload.district_id}</span></p>
          {performance ? <>
            <p className="sales-note">NJDOE · school year {performance.payload.school_year} · district-wide, all students.</p>
            {performance.payload.indicators.length ? <dl className="utility-reliability">
              {performance.payload.indicators.map((i) => <div key={i.id}><dt>{i.label}</dt><dd>{i.value === null ? (i.suppression ?? "Not published") : `${i.value.toFixed(1)}%`}</dd></div>)}
            </dl> : <p className="sales-note">No selected indicators published for this district and year.</p>}
            {performance.payload.notes.length > 0 && <ReaderDetails title="Publisher’s data-quality notes"><ul>{performance.payload.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></ReaderDetails>}
          </> : <p className="sales-note">No matching performance record in this release. That is not a low score.</p>}
        </div>)}
        <p className="sales-note">Test figures cover participating grades; attendance covers the district’s reported students. They are not a measure of every school or an individual child’s likely outcome. <a href={SPR} target="_blank" rel="noreferrer">NJDOE reports</a> · <a href={BOUNDARIES} target="_blank" rel="noreferrer">NJOGIS boundaries and terms</a>.</p>
      </ReaderDetails> : <p className="sales-note">No district association matched this boundary copy—not evidence that there is no school service. <a href={SPR} target="_blank" rel="noreferrer">Check NJDOE’s reports</a>.</p>}
    </section>

    <section className="section sales community-broadband" aria-labelledby="community-broadband-heading">
      <div className="section-head"><h2 id="community-broadband-heading">Internet at the address</h2></div>
      <p className="sales-note">Check <a href={FCC} target="_blank" rel="noreferrer">FCC’s National Broadband Map</a> for providers and advertised speeds at a home. Availability is not measured speed; confirm the plan with the provider.</p>
      <ReaderDetails title="Why there is no local availability figure yet"><p className="sales-note">FCC availability data have not been imported. The documented download API requires an FCC account; the location Fabric has separate licensing. Household internet subscriptions are not a substitute for availability.</p></ReaderDetails>
    </section>

    <section className="section sales community-crime" aria-labelledby="community-crime-heading">
      <div className="section-head"><h2 id="community-crime-heading">Crime records, with reporting coverage</h2></div>
      <p className="sales-note">These records cannot tell you whether a home or neighborhood is safe.</p>
      {data.crime.length ? <ReaderDetails title={`${data.crime[0].payload.year} · ${data.crime_county} agency chapter · ${complete}/${data.crime.length} listed agencies reported 12 months`}>
        <p className="sales-note">NJSP’s annual index-crime workbook, published April 2025. County chapter context{level === "municipality" ? ", not this town’s crime rate" : ""}. The denominator is agencies listed in this workbook, not every agency or every resident. State Police’s separate chapter is not added here.</p>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Agency crime reporting table, scroll horizontally">
          <table className="change-places"><thead><tr><th scope="col">Agency</th><th scope="col" className="num">Months reported</th><th scope="col" className="num">Index offenses</th></tr></thead>
            <tbody>{data.crime.map(({ payload: a }) => <tr key={a.ori}><th scope="row">{a.agency}</th><td className="num">{a.months_reported}/12</td><td className="num">{a.complete ? a.reported_offenses.toLocaleString("en-US") : "Incomplete reporting"}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="sales-note">Index offenses: murder, rape, robbery, aggravated assault, burglary, larceny and motor-vehicle theft. No report is not zero. No annual total is shown for an incomplete reporter; no county sum or safety ranking is computed. Agency jurisdictions can differ from town boundaries. <a href={data.crime[0].payload.url} target="_blank" rel="noreferrer">Source workbook</a>.</p>
      </ReaderDetails> : <p className="sales-note">No agency reporting context is attached to this geography{level === "zip" ? "; ZIP areas do not identify a police jurisdiction" : ""}. That does not mean zero crime.</p>}
    </section>

    <section className="section sales community-health" aria-labelledby="community-health-heading">
      <div className="section-head"><h2 id="community-health-heading">Health context—not a home’s diagnosis</h2></div>
      {data.health.length ? <ReaderDetails title={`${data.health_area} · ${data.health_level === "zip" ? "ZIP area" : data.health_level} estimates`}>
        {level === "municipality" && <p className="sales-note">These are the county’s estimates, not measurements of this town.</p>}
        {data.health.map(({ payload: h }) => <div className="utility-provider" key={h.measure}>
          <p><b>{h.value === null ? "Not published" : `${h.value.toFixed(1)}%`}</b> · {h.label}</p>
          <p className="sales-note">{h.year} measurement basis · CDC PLACES {h.release} release{h.value !== null && h.low !== null && h.high !== null ? ` · 95% interval ${h.low.toFixed(1)}–${h.high.toFixed(1)}%` : ""}. <a href={h.url} target="_blank" rel="noreferrer">Source</a>.</p>
        </div>)}
        <p className="sales-note">Model-based crude prevalence, not a direct local headcount or medical advice. Estimates depend on the survey, census and statistical model. Do not compare releases as trends or use them to judge a local policy; the 95% intervals are not the 90% survey margins used elsewhere on this site.</p>
      </ReaderDetails> : <p className="sales-note">No selected health estimates are loaded for this geography. No neighboring estimate is substituted.</p>}
    </section>
  </>;
}
