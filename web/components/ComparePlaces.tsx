"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import { Term } from "@/components/Term";
import type { Packet, PacketLevel } from "@/lib/api";
import { ownershipInputs, utilityTotal } from "@/lib/budgetScenario";
import { COMPARE_SECTIONS, levelOf, MAX_PLACES, parsePlaces, placesQuery } from "@/lib/compare";
import { formatMetric, formatValue } from "@/lib/format";
import { homePrice } from "@/lib/homePrice";
import { eachMonth } from "@/lib/ownership";
import { periodLabel } from "@/lib/periods";
import { regionPath } from "@/lib/placeRoutes";
import type { SearchEntry } from "@/lib/search";
import { marginLabel } from "@/lib/uncertainty";

/**
 * Places side by side (TODO "A compare page shared by its link"). The address holds the
 * choice and each place's published packet supplies its figures, so the page stores
 * nothing and publishes nothing per comparison (`lib/compare.ts`).
 */

type Loaded = { id: number; packet: Packet | null };

async function loadPacket(artifactUrl: string, id: number): Promise<Packet | null> {
  try {
    const response = await fetch(`${artifactUrl}/regions/${id}/packet/5y.json`);
    return response.ok ? ((await response.json()) as Packet) : null;
  } catch {
    return null;
  }
}

function Figure({ level }: { level: PacketLevel | null }) {
  if (!level) return <span className="compare-missing">Not published</span>;
  const margin = level.survey ? marginLabel(level.value, level.margin_of_error ?? null, level.unit, level.metric_id) : null;
  return (
    <>
      <strong>{formatMetric(level.value, level.unit, level.metric_id)}</strong>
      <small>
        {periodLabel(level.period_end, level.metric_id)}
        {margin ? ` · ${margin}` : ""}
      </small>
    </>
  );
}

/** The month to own the typical home at the national rate, 20% down, as the place page works it out. */
function ownMonth(packet: Packet, ratePct: number): { value: number; partial: boolean } | null {
  const levels = packet.levels;
  const home = homePrice(levels);
  if (!home) return null;
  const value = (id: string) => levelOf(levels, id)?.value ?? null;
  const month = eachMonth(
    ownershipInputs({
      state: packet.region.state_code,
      price: home.value,
      ratePct,
      taxYear: value("modiv_median_tax_bill"),
      insuranceYear: value("acs_median_home_insurance"),
      utilitiesMonth: utilityTotal(value("acs_median_electricity"), value("acs_median_gas"), value("acs_median_water_sewer")),
      rentMonth: value("zori_all"),
    }),
  );
  return { value: month.total, partial: month.missing.length > 0 };
}

export function ComparePlaces({ artifactUrl, rate }: { artifactUrl: string; rate: { value: number; asOf: string } }) {
  const [ids, setIds] = useState<number[]>([]);
  const [places, setPlaces] = useState<Loaded[]>([]);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);

  useEffect(() => {
    setIds(parsePlaces(window.location.search));
    fetch("/search.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((list: SearchEntry[] | null) => setEntries((list ?? []).filter((e) => e.level !== "state")))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all(ids.map(async (id) => ({ id, packet: await loadPacket(artifactUrl, id) }))).then((loaded) => {
      if (live) setPlaces(loaded);
    });
    return () => {
      live = false;
    };
  }, [artifactUrl, ids]);

  const update = (next: number[]) => {
    setIds(next);
    const url = new URL(window.location.href);
    url.search = placesQuery(next);
    window.history.replaceState(null, "", url);
  };
  const add = (entry: SearchEntry) => {
    if (!ids.includes(entry.id) && ids.length < MAX_PLACES) update([...ids, entry.id]);
  };
  const remove = (id: number) => update(ids.filter((other) => other !== id));
  const shown = places.filter((place) => ids.includes(place.id));

  return (
    <div className="compare-places" data-count={shown.length}>
      <div className="compare-picker">
        {ids.length < MAX_PLACES ? (
          <>
            <p className="compare-picker-label" aria-hidden="true">{ids.length ? `Add a place (${ids.length} of ${MAX_PLACES})` : "Choose a place to start"}</p>
            <PlacePicker
              entries={entries}
              onPick={add}
              label={ids.length ? "Add another place" : "Choose a place to start"}
              placeholder="Search a county, town or ZIP code"
              name="compare-place"
              className="compare-picker-field"
            />
          </>
        ) : (
          <p className="meta">Four places is the most this page sets side by side. Remove one to add another.</p>
        )}
        <p className="compare-share">
          The places you choose are kept in this page’s address, so you can bookmark it or send it. Nothing is
          saved in your browser.
        </p>
      </div>

      {ids.length === 0 && <p className="meta">Pick up to four counties, towns or ZIP codes to set side by side.</p>}

      {shown.length > 0 && (
        <div className="compare-scroll" role="region" aria-label="Places compared" tabIndex={0}>
          <table className="compare-table">
            <caption className="visually-hidden">The places you chose, figure by figure</caption>
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Figure</span></th>
                {shown.map(({ id, packet }) => (
                  <th scope="col" key={id}>
                    {packet ? <Link href={regionPath(id)}>{packet.region.label}</Link> : <span>Place {id}</span>}
                    <button type="button" className="compare-remove" onClick={() => remove(id)} aria-label={`Remove ${packet?.region.label ?? `place ${id}`}`}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARE_SECTIONS.map((section) => (
              <tbody key={section.title}>
                <tr className="compare-section">
                  <th scope="rowgroup" colSpan={shown.length + 1}>{section.title}</th>
                </tr>
                {section.rows.map((row) => {
                  if ("cost" in row) {
                    return (
                      <tr key="own">
                        <th scope="row">
                          <Term id="cost_to_own" title="The month to own" definition={`The typical home at ${rate.value.toFixed(2)}%, the national 30-year rate (${rate.asOf}), 20% down, with property tax, insurance, utilities and upkeep where published — as each place’s own page works it out.`}>
                            Monthly cost to own
                          </Term>
                        </th>
                        {shown.map(({ id, packet }) => {
                          const own = packet ? ownMonth(packet, rate.value) : null;
                          return (
                            <td key={id}>
                              {own ? (
                                <>
                                  <strong>{formatValue(own.value, "usd")}</strong>
                                  <small>{own.partial ? "partial: some costs unpublished" : `at ${rate.value.toFixed(2)}%, 20% down`}</small>
                                </>
                              ) : (
                                <span className="compare-missing">No home price</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                  const label = row.label ?? row.metric;
                  return (
                    <tr key={row.metric}>
                      <th scope="row"><Term id={row.metric}>{label}</Term></th>
                      {shown.map(({ id, packet }) => (
                        <td key={id}>{packet ? <Figure level={levelOf(packet.levels, row.metric)} /> : <span className="compare-missing">Could not load</span>}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
