import type { Observation, PacketLevel } from "@/lib/api";
import { FLOOD_MAP } from "@/lib/costRules";
import { formatValue } from "@/lib/format";
import { claimsSummary, floodLevels, shareText, unmapped } from "@/lib/hazards";

/**
 * Is it at risk of flooding (Milestone 40, ARCHITECTURE #301-#302)? Three answers kept
 * apart, as the roadmap set them: where FEMA's map in force puts the homes, where New
 * Jersey's sea-level-rise planning line puts them, and where floods have actually been
 * paid for. What the page owes a reader, each a sentence below: outside a zone is never
 * "safe"; a share is of homes, estimated, not of land; where FEMA's digital map does not
 * reach, no share is given and the page says so; and an address is checked on FEMA's own
 * map, which a seller or landlord must now disclose.
 */
/** New Jersey's lookup for the flood disclosure P.L. 2023, c. 93 requires, by address. */
const FLOOD_DISCLOSURE_URL = "https://flooddisclosure.nj.gov/";

export function FloodRisk({
  name,
  levels,
  claims,
  paid,
  claimsPlace,
}: {
  name: string;
  levels: PacketLevel[];
  claims: Observation[];
  paid: Observation[];
  /** Whose claims these are, when not the region's own: a town reads its county's. */
  claimsPlace: string | null;
}) {
  const flood = floodLevels(levels);
  const history = claimsSummary(claims, paid);
  if (flood.mapped === null && !history) return null;
  const count = (n: number) => formatValue(n, "count");

  return (
    <section className="section sales flood-risk" aria-labelledby="flood-risk-heading">
      <div className="section-head">
        <h2 id="flood-risk-heading">Is it at risk of flooding?</h2>
      </div>

      {flood.high !== null ? (
        <p className="sales-lead">
          About <b>{shareText(flood.high)}</b> of {name}’s homes
          {flood.homes ? ` (${count(flood.homes)})` : ""} are in FEMA’s 1%-a-year flood zone,
          where a flood has at least a one-in-four chance over a 30-year mortgage and a
          federally backed mortgage requires flood insurance
          {flood.moderate !== null && flood.moderate > 0
            ? `; ${shareText(flood.moderate)} more are in the 0.2% zone`
            : ""}
          .
        </p>
      ) : unmapped(flood) ? (
        <p className="sales-lead">
          FEMA’s digital flood map covers only {shareText(flood.mapped ?? 0)} of {name}’s
          homes, so no share in its flood zones is given here: a share over the rest would
          read as dry. FEMA’s older paper maps still apply there.
        </p>
      ) : null}

      {flood.tidal !== null && (
        <p className="sales-note">
          {flood.tidal > 0 ? (
            <>
              With four feet of sea-level rise, New Jersey’s planning line for coastal
              building puts {shareText(flood.tidal)} of homes in the tidal flood area.
            </>
          ) : (
            <>New Jersey’s tidal planning line, with four feet of sea-level rise, reaches none of its homes.</>
          )}{" "}
          It is an approximate layer for the 2026 REAL rules, not a flood map in force.
        </p>
      )}

      {history && (
        <p className="sales-note">
          {claimsPlace ? `In ${claimsPlace}, ` : ""}the National Flood Insurance Program paid
          on {count(history.claims)} flood claims from {history.first} to {history.last}, a
          total of {formatValue(history.paid, "usd")}
          {history.partial.claims > 0
            ? `, and on ${count(history.partial.claims)} so far in ${history.partialYear}`
            : ""}
          . The worst years since {history.since}:{" "}
          {history.worst.map((y) => `${y.year} (${count(y.claims)})`).join(", ")}. Only
          insured owners claim, so this counts insured loss, not every flooded home
          {claimsPlace ? "; FEMA does not place claims in towns precisely enough to count them here" : ""}
          .
        </p>
      )}

      <p className="sales-note">
        Outside a flood zone is not safe from flooding: many claims come from outside one,
        and the map shows where FEMA has studied, not every street that floods. A share is
        of homes counted in 2020, each block’s homes taken as spread evenly over it. For one
        address, use{" "}
        <a href={FLOOD_DISCLOSURE_URL} target="_blank" rel="noreferrer">
          New Jersey’s flood disclosure lookup
        </a>{" "}
        or{" "}
        <a href={FLOOD_MAP.url} target="_blank" rel="noreferrer">
          FEMA’s map
        </a>
        . Since 2024 a seller must say on the disclosure statement, and a landlord must tell a
        tenant, whether a home is in FEMA’s 1% or 0.2% zone and any flooding they know of.
      </p>
      <p className="sales-note">
        Flood zones: FEMA’s National Flood Hazard Layer. Tidal area: New Jersey Department of
        Environmental Protection. Claims: FEMA’s OpenFEMA, not endorsed by FEMA.
      </p>
    </section>
  );
}
