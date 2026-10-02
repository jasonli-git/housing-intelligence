import type { Observation, PacketLevel } from "@/lib/api";
import { byYear, constructionYears, fiveYears } from "@/lib/construction";
import { formatValue } from "@/lib/format";

/**
 * Is it adding homes, or only approving them (Milestone 39, ARCHITECTURE #300)? Permits
 * from the Census Bureau beside DCA's certificates of occupancy and demolitions: two
 * five-year totals, then the years one by one.
 *
 * What the page owes a reader here, each a sentence below: completions trail permits by a
 * year or more, so the two totals are not a rate; a year a town did not report is missing,
 * not zero; a county's total covers only its towns that reported; 2025 is preliminary;
 * and the stages before a permit — proposed, approved — are not published statewide.
 */
export function HomesAdded({
  name,
  level,
  permitted,
  completed,
  demolished,
  net,
  levels,
}: {
  name: string;
  level: string;
  permitted: Observation[];
  completed: Observation[];
  demolished: Observation[];
  net: Observation[];
  levels: PacketLevel[];
}) {
  const rows = constructionYears({ permitted, completed, demolished, net });
  if (rows.length === 0) return null;
  const window = fiveYears(rows, byYear(permitted));
  const count = (value: number | null) => (value === null ? "not reported" : formatValue(value, "count"));
  const find = (id: string) => levels.find((l) => l.metric_id === id);
  const perThousand = find("nj_net_units_per_1000");
  const coverage = find("nj_certificates_reporting_share");
  const demolitionCoverage = find("nj_demolitions_reporting_share");
  const preliminary = rows.find((r) => r.preliminary);

  return (
    <section className="section sales homes-added" aria-labelledby="homes-added-heading">
      <div className="section-head">
        <h2 id="homes-added-heading">Is it adding homes?</h2>
      </div>
      {window ? (
        <p className="sales-lead">
          From {window.first} to {window.last}, {name} permitted{" "}
          <b>{formatValue(window.permitted, "count")}</b> homes and certified{" "}
          <b>{formatValue(window.completed, "count")}</b> as complete
          {window.reported < 5 ? ` (in the ${window.reported} of those years its office reported)` : ""}
          {window.demolished !== null && window.net !== null ? (
            <>
              ; {formatValue(window.demolished, "count")} were demolished, so{" "}
              <b>{formatValue(window.net, "count")}</b> net homes were added
            </>
          ) : null}
          .
        </p>
      ) : (
        <p className="sales-lead">
          {name}’s construction office has reported too few years to compare five of them.
        </p>
      )}
      {perThousand && (
        <p className="sales-note">
          In {perThousand.period_end.slice(0, 4)} it added {perThousand.value.toFixed(1)} net
          homes for every 1,000 already standing.
        </p>
      )}
      <div className="scroll-x">
        <table className="change-places homes-added-years">
          <caption className="visually-hidden">Homes permitted, completed and demolished in {name}, by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">Permitted</th>
              <th scope="col" className="num">Completed</th>
              <th scope="col" className="num">Demolished</th>
              <th scope="col" className="num">Net added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <th scope="row">
                  {r.year}
                  {r.preliminary ? " (preliminary)" : ""}
                </th>
                <td className="num">{r.permitted === null ? "—" : formatValue(r.permitted, "count")}</td>
                <td className="num">{count(r.completed)}</td>
                <td className="num">{count(r.demolished)}</td>
                <td className="num">{r.net === null ? "—" : formatValue(r.net, "count")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sales-note">
        A permit is permission to build; a certificate of occupancy says a home is finished
        and ready to live in. Completions trail permits by a year or more, and some permits
        are never built, so the two totals are not a completion rate. Proposed and approved
        projects — planning-board decisions — are not published statewide, so this starts
        at the permit.
        {level === "municipality"
          ? rows.some((r) => r.completed === null || r.demolished === null)
            ? " A year marked “not reported” is one this town’s construction office sent no figures for: missing, not zero."
            : ""
          : coverage
            ? ` Totals cover only the towns that reported: ${Math.round(coverage.value * 100)}% of ${name}’s towns for completions in ${coverage.period_end.slice(0, 4)}${demolitionCoverage ? `, ${Math.round(demolitionCoverage.value * 100)}% for demolitions` : ""}.`
            : ""}
      </p>
      <p className="sales-note">
        Permits: U.S. Census Bureau. Completions and demolitions: New Jersey Department of
        Community Affairs’ Construction Reporter.
        {preliminary
          ? ` ${preliminary.year} is preliminary, from DCA’s December year-to-date report: its yearly summary has not been published, and its monthly reports stop at January 2026 while DCA reworks the program.`
          : ""}
      </p>
    </section>
  );
}
