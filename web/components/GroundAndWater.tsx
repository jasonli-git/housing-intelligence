import type { PacketLevel, WaterSystems } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";
import { formatValue } from "@/lib/format";
import { shareText, systemReportUrl } from "@/lib/hazards";
import { pfasResult, publisherUrl, resolutionText } from "@/lib/infrastructure";
import { waterQualityReport } from "@/lib/waterReports";

/** NJDEP's map of every known contaminated site, with what each one is. */
const SITES_MAP = "https://experience.arcgis.com/experience/f26272f8a41c4aeea77ac6f9b3c80ebb";
/** NJDEP's Drinking Water Watch: every system's samples, including New Jersey's PFAS limits. */
const DRINKING_WATER_WATCH = "https://www9.state.nj.us/DEP_WaterWatch_public/";

/**
 * What's in the ground and the water (Milestone 40, ARCHITECTURE #303-#304)? NJDEP's open
 * contaminated-site cases, counted three ways and never scored, and the community water
 * systems serving the place with their health-based violations over five years. What the
 * page owes a reader: a count is not a risk; a violation is a period the water broke a
 * rule, not a measure of it today; New Jersey's own PFAS limits are not in EPA's records;
 * and a home off every system is most likely on a private well.
 */
export function GroundAndWater({
  name,
  levels,
  water,
}: {
  name: string;
  levels: PacketLevel[];
  water: WaterSystems | null;
}) {
  const value = (id: string) => levels.find((l) => l.metric_id === id)?.value ?? null;
  const open = value("njdep_sites_open");
  const controlled = value("njdep_sites_post_remedy");
  const tanks = value("njdep_sites_heating_oil");
  const publicShare = value("water_homes_share_public");
  if (open === null && publicShare === null && !water) return null;
  const count = (n: number) => formatValue(n, "count");

  return (
    <section className="section sales ground-water" aria-labelledby="ground-water-heading">
      <div className="section-head">
        <h2 id="ground-water-heading">What’s in the ground and the water?</h2>
      </div>

      {open !== null && (
        <p className="sales-lead">
          New Jersey lists <b>{count(open)}</b> contaminated site{open === 1 ? "" : "s"} in{" "}
          {name} whose cleanup is under way or not yet begun
          {controlled !== null ? `, ${count(controlled)} cleaned up with controls that stay` : ""}
          {tanks !== null ? `, and ${count(tanks)} leaking home heating-oil tank${tanks === 1 ? "" : "s"} being cleaned up` : ""}
          . A count says nothing about one home: what each site is, and where, is on{" "}
          <a href={SITES_MAP} target="_blank" rel="noreferrer">
            NJDEP’s map
          </a>
          .
        </p>
      )}

      {publicShare !== null && (
        <p className="sales-note">
          Of the homes here, {shareText(publicShare)} are on public water.
          {publicShare < 0.99
            ? " Most of the rest draw from private wells, which federal drinking water law does not cover; New Jersey requires a well to be tested when a home is sold or leased."
            : ""}
        </p>
      )}

      {water && water.systems.length > 0 && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
          <table className="change-places water-systems">
            <caption className="visually-hidden">
              Water systems serving {name}, with health-based violations {water.first_year}–
              {water.last_year}
            </caption>
            <thead>
              <tr>
                <th scope="col">Water system</th>
                <th scope="col" className="num">Homes here</th>
                <th scope="col" className="num">
                  Violations {water.first_year}–{water.last_year}
                </th>
                <th scope="col">Most recent</th>
              </tr>
            </thead>
            <tbody>
              {water.systems.map((s) => (
                <tr key={s.pwsid}>
                  <th scope="row">
                    <a href={systemReportUrl(s.pwsid)} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                  </th>
                  <td className="num">{shareText(s.share_of_homes)}</td>
                  <td className="num">{s.violations === 0 ? "none" : count(s.violations)}
                    <div className="sales-note">{resolutionText(s)}</div>
                  </td>
                  <td>
                    {s.latest_violation && s.latest_violation_what
                      ? `${s.latest_violation_what}, ${s.latest_violation.slice(0, 7)}`
                      : "—"}
                    {s.latest_violation && <div className="sales-note">
                      {s.latest_return_to_compliance
                        ? `Return to compliance reported ${s.latest_return_to_compliance}`
                        : "No return-to-compliance date recorded for this violation"}
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {water && <ReaderDetails title="Lead pipes and measured PFAS · by water system">
        <p className="sales-note">System records, not one home’s tap water. No sample or inventory is not a clean result.</p>
        {water.systems.map((s) => {
          const lead = s.lead_inventory?.payload;
          const url = publisherUrl(lead?.inventory_url);
          const report = waterQualityReport(s.pwsid);
          return <details className="reader-details" key={s.pwsid}>
            <summary>{s.name}</summary>
            <div className="reader-details-body">
              {report ? <p className="sales-note"><a href={report.url} target="_blank" rel="noreferrer">Read this system’s annual water-quality report</a> · system ID matched {report.verified}. Ask the supplier for current results; an annual report is not live testing.</p>
                : <p className="sales-note">No direct annual-report link verified for this system. <a href="https://ordspub.epa.gov/ords/safewater/f?p=136:103::::103:P103_STATE:NJ" target="_blank" rel="noreferrer">Search EPA’s New Jersey report directory</a> using {s.pwsid} / {s.name}, or ask the supplier.</p>}
              {lead ? <>
                <p className="sales-note">Service-line inventory, submission {lead.submission_year}{lead.category_updated ? ` · category data updated ${lead.category_updated}` : ""}.</p>
                <dl className="utility-reliability">
                  {([["Lead", lead.lead], ["Galvanized", lead.galvanized], ["Lead connectors", lead.lead_connectors], ["Material unknown", lead.unknown], ["Non-lead", lead.non_lead]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null ? "Not reported" : count(value)}</dd></div>)}
                </dl>
                {url && <p className="sales-note"><a href={url} target="_blank" rel="noreferrer">Supplier’s service-line inventory</a></p>}
              </> : <p className="sales-note">No service-line inventory matched to this system.</p>}
              {(s.pfas_samples?.length ?? 0) > 0 ? <>
                <p className="sales-note">UCMR 5 entry-point samples, not current tap-water testing. Highest single measurements—not regulatory averages or violations.</p>
                <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally"><table className="change-places">
                  <caption>Measured PFAS · ng/L (parts per trillion)</caption>
                  <thead><tr><th scope="col">Chemical</th><th scope="col">Results</th><th scope="col">Sample dates</th><th scope="col">EPA reference</th></tr></thead>
                  <tbody>{s.pfas_samples!.map((r) => <tr key={r.record_id}>
                    <th scope="row">{r.payload.contaminant}</th>
                    <td>{pfasResult(r.payload)}<div className="sales-note">{r.payload.detections} detections in {r.payload.samples} results</div></td>
                    <td>{r.payload.first_sample}–{r.payload.last_sample}</td>
                    <td>{r.payload.reference_ng_l === null ? "Not compared here" : <>{r.payload.reference_ng_l} ng/L · {r.payload.samples_above_reference} single result{r.payload.samples_above_reference === 1 ? "" : "s"} above</>}</td>
                  </tr>)}</tbody>
                </table></div>
              </> : <p className="sales-note">No UCMR 5 entry-point samples matched. Many small systems and all private wells are outside this dataset.</p>}
            </div>
          </details>;
        })}
        <p className="sales-note">NJ requires lead-line identification and replacement by 2031; extensions may apply. <a href="https://dep.nj.gov/lead/replacement/">NJDEP replacement programme</a>. These counts do not measure lead concentration.</p>
        <p className="sales-note">The current public system-inventory map reaches submission 2024. <a href="https://dep.nj.gov/lead/map/">NJDEP’s 2025 statewide totals</a> are newer, but cannot replace an individual system’s record.</p>
        <p className="sales-note">EPA references shown for PFOA and PFOS only (4 ng/L, reviewed October 2026); proposals affect other PFAS rules. Compliance uses running annual averages, not the maxima above. <a href="https://www.epa.gov/sdwa/and-polyfluoroalkyl-substances-pfas">EPA rules</a> · <a href="https://www.epa.gov/dwucmr/fifth-unregulated-contaminant-monitoring-rule-data-finder">EPA UCMR Data Finder</a>. <a href="https://www.epa.gov/ccr">Find an annual water-quality report</a>, or ask the supplier for its Consumer Confidence Report and current results.</p>
      </ReaderDetails>}

      {water && (
        <p className="sales-note reader-takeaway">
          These are system-wide past violations, not today’s water quality or a count of affected homes. A missing resolution date does not prove the issue is still unresolved. For current New Jersey results, check{" "}
          <a href={DRINKING_WATER_WATCH} target="_blank" rel="noreferrer">Drinking Water Watch</a>.
        </p>
      )}
      <ReaderDetails title="Water records and sources">
      {water && (
        <p className="sales-note">
          A health-based violation is a contaminant over its legal limit, or treatment the
          law requires not done, in a period that began from {water.first_year} to{" "}
          {water.last_year}. It is a period the water broke a rule, not a measure of the
          water today; each system’s name opens EPA’s record of what happened and what was
          done. New Jersey’s own limits on PFAS are not in EPA’s records:{" "}
          <a href={DRINKING_WATER_WATCH} target="_blank" rel="noreferrer">
            Drinking Water Watch
          </a>{" "}
          has them.
        </p>
      )}

      <p className="sales-note">
        Sites and service areas: New Jersey Department of Environmental Protection.
        Violations: EPA’s Safe Drinking Water Information System. Homes served are estimated
        from the 2020 Census.
      </p>
      </ReaderDetails>
    </section>
  );
}
