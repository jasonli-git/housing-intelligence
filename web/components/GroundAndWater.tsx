import type { PacketLevel, WaterSystems } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { shareText, systemReportUrl } from "@/lib/hazards";

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
        <div className="scroll-x">
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
                  <td className="num">{s.violations === 0 ? "none" : count(s.violations)}</td>
                  <td>
                    {s.latest_violation && s.latest_violation_what
                      ? `${s.latest_violation_what}, ${s.latest_violation.slice(0, 7)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </section>
  );
}
