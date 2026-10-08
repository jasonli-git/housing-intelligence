import type { Utilities as UtilityData } from "@/lib/api";
import { bundledPrice, publisherUrl } from "@/lib/infrastructure";
import { ReaderDetails } from "@/components/ReaderDetails";

const TERRITORIES = "https://www.arcgis.com/home/item.html?id=d23845cc51454ee59affd226cff3fcd5";
const EIA = "https://www.eia.gov/electricity/data/eia861/";
const LEAD = "https://data.openei.org/submissions/6219";
const BPU = "https://www.nj.gov/bpu/about/divisions/reliability/";
const BPU_SEARCH = "https://publicaccess.bpu.state.nj.us/";
const JCPL_BPU = "https://nj.gov/bpu/pdf/boardorders/2025/20250813/2B%20ORDER%20JCP%26L%20Reliability%20Levels.pdf";

/** A compact way into company-wide records, not another cost calculator. */
export function Utilities({ data }: { data: UtilityData | null }) {
  if (!data) return null;
  const energy = data.energy_context?.payload;
  return <section className="section sales utility-context" aria-labelledby="utilities-heading">
    <div className="section-head"><h2 id="utilities-heading">Utilities around here</h2></div>
    <p className="sales-note">Approximate service areas—not a promise about one address. Split areas list more than one provider.</p>
    {data.providers.length === 0 && <p className="sales-note">No providers matched this map copy. That does not mean service is unavailable; confirm the address with the supplier.</p>}
    {data.providers.map((p) => {
      const electric = p.electricity?.payload;
      const price = electric ? bundledPrice(electric) : null;
      return <div className="utility-provider" key={`${p.fuel}:${p.provider}`}>
        <p><b>{p.provider}</b> <span className="meta">{p.fuel === "gas" ? "Gas" : "Electricity"}</span></p>
        {electric ? <>
          <p className="sales-note">{electric.year} residential bundled average: {price ? <><b>{(price.dollarsPerKwh * 100).toFixed(1)}¢/kWh</b>{price.imputed ? " (includes estimated data)" : ""}</> : "not reported"}. Not today’s tariff or your bill.</p>
          <ReaderDetails title={`${electric.year} outage records · ${electric.method ?? "method not reported"}`}>
            <dl className="utility-reliability">
              <div><dt>Minutes without power per customer, all events (SAIDI)</dt><dd>{electric.saidi_all ?? "Not reported"}</dd></div>
              <div><dt>Interruptions per customer, all events (SAIFI)</dt><dd>{electric.saifi_all ?? "Not reported"}</dd></div>
              <div><dt>Minutes excluding major-event days</dt><dd>{electric.saidi_normal ?? "Not reported"}</dd></div>
              <div><dt>Interruptions excluding major-event days</dt><dd>{electric.saifi_normal ?? "Not reported"}</dd></div>
            </dl>
            <p className="sales-note">Utility-wide New Jersey averages across customer classes, not town-specific outages or a prediction. <a href={EIA}>EIA annual records</a>.</p>
            {(p.regulatory_reliability?.length ?? 0) > 0 ? <>
              <h3>NJ BPU reported performance</h3>
              <dl className="utility-reliability">
                {p.regulatory_reliability!.map((r) => <div key={r.record_id}>
                  <dt>{r.payload.year} actual · company-wide</dt>
                  <dd>{r.payload.caidi_minutes} minutes per interruption (CAIDI) · {r.payload.saifi} interruptions per customer (SAIFI)</dd>
                </div>)}
              </dl>
              <p className="sales-note">CAIDI is the average restoration time for customer interruptions—not annual minutes per customer (SAIDI). Each year is the company-wide actual the utility reported against <a href={BPU}>BPU’s minimum reliability levels</a>{p.regulatory_reliability!.some((r) => r.payload.basis.includes("major events excluded")) && ", with major events excluded"}, so it is not the same basis as EIA’s figures above. {p.regulatory_reliability!.some((r) => r.source_id === "nj_bpu_reports") && <>From the utility’s annual system performance reports to BPU, released under public-records request {p.regulatory_reliability!.find((r) => r.payload.opra_request)?.payload.opra_request}. </>}{p.regulatory_reliability!.some((r) => r.source_id === "nj_bpu_reliability") && <>Earlier years from <a href={publisherUrl(p.regulatory_reliability!.find((r) => r.source_id === "nj_bpu_reliability")!.payload.url) ?? JCPL_BPU}>BPU’s August 2025 order, Tables 1–3</a>. </>}Not today’s outage status or this town’s own record.</p>
            </> : <p className="sales-note">BPU annual figures are not imported for this supplier. <a href={p.electricity?.record_id === "963" ? BPU_SEARCH : BPU}>{p.electricity?.record_id === "963" ? "Search BPU public filings" : "BPU reliability oversight"}</a>{p.electricity?.record_id === "963" && " by document title or docket; a newer filing may not appear in search results"}.</p>}
          </ReaderDetails>
        </> : p.fuel === "electric" && <p className="sales-note">No verified EIA company match; price and outages not filled in.</p>}
      </div>;
    })}
    {energy && <p className="sales-note">{energy.burden === null ? <>{energy.name}: energy estimate withheld because the source has signed reporting weights or costs.</> : <>{energy.name} energy context: about <b>{(energy.burden * 100).toFixed(0)}%</b> of average income went to home energy, based on {energy.acs_window} data calibrated to {energy.year}. This is county context, not one household’s burden.</>}</p>}
    <ReaderDetails title="Sources and how to use these figures">
      <p className="sales-note"><a href={TERRITORIES}>NJDEP’s territory maps</a> were drawn from small-scale maps. Confirm the provider at the address. Names are matched explicitly to EIA IDs; unmatched providers stay unmatched. Gas prices are not inferred from electricity sales.</p>
      <p className="sales-note">Electricity prices divide residential bundled revenue by bundled sales volume. Delivery-only and energy-only sales are excluded. Reliability is the utility’s reported method, with and without major events.</p>
      {energy && <p className="sales-note">Energy context derived here from <a href={LEAD}>DOE/NREL LEAD (2024 release)</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Each cost component uses its own reporting weight; the ratio compares county mean annual energy costs with county mean income. Neither a median household nor an average of individual household burdens. Not added to the cost cards.</p>}
      <p className="sales-note">Territory copy read {data.providers[0]?.territory.fetched_at.slice(0, 10) ?? "date unavailable"}. Download date is not a measurement date.</p>
    </ReaderDetails>
  </section>;
}
