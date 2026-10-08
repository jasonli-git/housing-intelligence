import Link from "next/link";

import type { Migration, MigrationFlow } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";
import { shareText } from "@/lib/hazards";
import { formatIncome, formatReturns, incomeSentence, latestYear, movesSentence, whose } from "@/lib/migration";

/** The IRS's own page for the county-to-county files. */
const IRS_MIGRATION = "https://www.irs.gov/statistics/soi-tax-stats-migration-data";

function Flows({ flows, caption, heading }: { flows: MigrationFlow[]; caption: string; heading: string }) {
  if (!flows.length) return null;
  return (
    <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
      <table className="change-places migration-flows">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            <th scope="col" className="num">Households</th>
            <th scope="col" className="num">Share</th>
            <th scope="col" className="num">Average income</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((f) => (
            <tr key={f.rank}>
              <th scope="row">{f.region_id !== null ? <Link href={`/regions/${f.region_id}`}>{f.name}</Link> : f.name}</th>
              <td className="num">{formatReturns(f.returns)}</td>
              <td className="num">{shareText(f.share)}</td>
              <td className="num">{f.income_per_return !== null ? formatIncome(f.income_per_return) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Who is moving here (Milestone 50, ARCHITECTURE #332-#333)? The county's households
 * moving in and out by the IRS's tax-return addresses, what they reported earning against
 * those who stayed, six years of the balance, and where movers came from and went to.
 * A town or ZIP shows its county's, and says so.
 */
export function WhoIsMoving({ name, data }: { name: string; data: Migration | null }) {
  if (!data) return null;
  const latest = latestYear(data);
  if (!latest) return null;
  const county = `${data.county_name} County`;
  const moves = movesSentence(latest, county);
  const income = incomeSentence(latest);
  const note = whose(data, name);
  const trend = data.years.filter((y) => y.net_per_1000 !== null);

  return (
    <section className="section sales who-is-moving" aria-labelledby="who-is-moving-heading">
      <div className="section-head">
        <h2 id="who-is-moving-heading">Who is moving here?</h2>
      </div>
      {note && <p className="sales-note">{note}</p>}
      {moves && <p className="sales-lead">{moves}</p>}
      {income && (
        <p className="sales-note">
          {income} Newcomers with more to spend can add to demand for homes; this shows who moved, not that
          they moved prices.
        </p>
      )}

      {trend.length > 1 && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
          <table className="change-places migration-years">
            <caption className="visually-hidden">Households moving in and out of {county}, by year</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col" className="num">Moved in</th>
                <th scope="col" className="num">Moved out</th>
                <th scope="col" className="num">Net per 1,000</th>
                <th scope="col" className="num">Arrivals’ income to stayers’</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((y) => (
                <tr key={y.year}>
                  <th scope="row">{y.year}</th>
                  <td className="num">{y.inflow_returns !== null ? formatReturns(y.inflow_returns) : "—"}</td>
                  <td className="num">{y.outflow_returns !== null ? formatReturns(y.outflow_returns) : "—"}</td>
                  <td className="num">{`${y.net_per_1000! > 0 ? "+" : ""}${y.net_per_1000!.toFixed(1)}`}</td>
                  <td className="num">{y.arrival_income_ratio !== null ? `${y.arrival_income_ratio.toFixed(2)}×` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Flows
        flows={data.arrivals}
        heading={`Where arrivals lived in ${data.flows_year ? data.flows_year - 1 : "the year before"}`}
        caption={`The ten counties sending the most households to ${county}, ${data.flows_year}`}
      />
      <Flows
        flows={data.departures}
        heading="Where leavers went"
        caption={`The ten counties receiving the most households from ${county}, ${data.flows_year}`}
      />

      <ReaderDetails title="About these figures">
        <p className="sales-note">
          From the IRS’s county-to-county migration data, which compares the addresses on federal tax returns
          filed in two years. A household here is a tax return: people who file none, such as many retirees
          and low earners, are not counted, and a couple filing separately counts twice. Incomes are adjusted
          gross income averaged over returns, so a few very high earners can lift them. From the 2022–2023
          figures the IRS matches returns across years by a new method that finds about 5% more of them, so
          a change into 2023 is partly the method. A pair of counties is published only with 20 returns or
          more. <a href={IRS_MIGRATION} target="_blank" rel="noreferrer">The IRS’s migration data ↗</a>
        </p>
      </ReaderDetails>
    </section>
  );
}
