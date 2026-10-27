"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlacePicker } from "./PlacePicker";
import { PlaceStoryChart } from "./PlaceStoryChart";
import { GroundAndWater } from "./GroundAndWater";
import { GettingAround } from "./GettingAround";
import { IndexedComparison } from "./IndexedComparison";
import { PaycheckExhibit } from "./ExhibitCharts";
import { HomeSales } from "./HomeSales";
import { IncomePressure } from "./IncomePressure";
import { MortgageLending } from "./MortgageLending";
import { HomesAdded } from "./HomesAdded";
import { WhoIsMoving } from "./WhoIsMoving";
import { regionPath } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, placeStoryName, storyHistoryMetrics, storyPlaceId, type PlaceStoryRecord } from "@/lib/placeStories";
import type { HousingPressure, Migration, Packet, Observation, WaterSystems, WorkDestinations } from "@/lib/api";
import type { SearchEntry } from "@/lib/search";
import styles from "./PlaceStories.module.css";

async function optionalJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(url, { signal });
  return response.ok ? response.json() : null;
}

export function PlaceStoryFocus({ initial, artifactUrl }: { initial: PlaceStoryRecord; artifactUrl: string }) {
  const [record, setRecord] = useState<PlaceStoryRecord | null>(null);
  const [message, setMessage] = useState("Choose a town, county or ZIP to explore its records.");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  const choose = useCallback(async () => {
    const token = ++request.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const id = storyPlaceId(location.search);
    setRecord(null);
    if (id === null) { setMessage(new URLSearchParams(location.search).has("place") ? "Invalid place selection. Choose a place below." : "Choose a town, county or ZIP to explore its records."); return; }
    setMessage("Loading this place’s records…");
    try {
      let next: PlaceStoryRecord;
      if (id === initial.place.region_id) next = initial;
      else {
        const base = `${artifactUrl}/regions/${id}`;
        const [packet, water, destinations, observations, pressure, migration] = await Promise.all([
          optionalJson<Packet>(`${base}/packet/5y.json`, abort.signal),
          initial.topic === "water" ? optionalJson<WaterSystems>(`${base}/water-systems.json`, abort.signal) : null,
          initial.topic === "commute" ? optionalJson<WorkDestinations>(`${base}/work-destinations.json`, abort.signal) : null,
          storyHistoryMetrics(initial.topic).length ? optionalJson<{ total: number; observations: Observation[] }>(`${base}/metrics.json`, abort.signal) : null,
          initial.topic === "pressure" ? optionalJson<HousingPressure>(`${base}/housing-pressure.json`, abort.signal) : null,
          initial.topic === "migration" ? optionalJson<Migration>(`${base}/migration.json`, abort.signal) : null,
        ]);
        if (!packet || packet.region?.region_id !== id || !Array.isArray(packet.levels) || !["county", "municipality", "zip"].includes(packet.region.level)) throw new Error("No supported place packet");
        const history = observations && Array.isArray(observations.observations) && observations.total === observations.observations.length
          ? storyHistoryMetrics(initial.topic).map(metricId => ({ metricId, observations: observations.observations.filter(o => o.metric_id === metricId) })) : [];
        next = makePlaceStoryRecord(initial.topic, { region_id: id, name: packet.region.name, level: packet.region.level, state_code: packet.region.state_code, geoid: packet.region.geoid }, packet.levels, { metrics: initial.topic === "market" ? packet.metrics : [], history, water, destinations, pressure, migration });
      }
      if (token !== request.current) return;
      setRecord(next); setMessage("");
      window.dispatchEvent(new CustomEvent("place-story-change", { detail: next.place.region_id }));
    } catch {
      if (token === request.current) setMessage("These local records could not be loaded. Nothing has been substituted from another place.");
    }
  }, [initial, artifactUrl]);
  useEffect(() => {
    void choose();
    const follow = () => { void choose(); };
    window.addEventListener("popstate", follow);
    return () => { ++request.current; controller.current?.abort(); window.removeEventListener("popstate", follow); };
  }, [choose]);
  function pick(entry: SearchEntry) {
    const url = new URL(location.href); url.searchParams.set("place", String(entry.id));
    history.pushState(null, "", url); void choose();
  }
  function loadEntries() {
    if (entries) return;
    fetch("/search.json").then(r => r.ok ? r.json() : Promise.reject()).then((rows: SearchEntry[]) => setEntries(rows.filter(r => ["county", "municipality", "zip"].includes(r.level)))).catch(() => setFailed(true));
  }
  const name = record ? placeStoryName(record) : "";
  return <section className={styles.focus} data-place-story-focus data-selected={Boolean(record)} data-story-topic={initial.topic} aria-label="Explore a place in this story">
    <div className={styles.focusTop}><h2>{record ? `Exploring ${name}` : "Explore a place"}</h2>{record && <Link href={`${regionPath(record.place.region_id)}${record.place.region_id === initial.place.region_id ? "#place-story-gallery" : ""}`}>Back to {name} ↗</Link>}</div>
    <PlacePicker key={record?.place.region_id ?? "unselected"} entries={entries} onFocus={loadEntries} onPick={pick} keepPicked initialQuery={name} failed={failed} className={styles.picker} label="Focus this story on a town, county or ZIP" placeholder="Town, county or ZIP" name={`story-place-${initial.topic}`} />
    {message && <p className={styles.notice} role="status">{message}</p>}
    {record && <>
      <PlaceStoryChart record={record} />
      <div className={styles.focusBody}>
        {record.topic === "commute" && <GettingAround name={name} level={record.place.level} levels={record.levels} destinations={record.destinations} />}
        {record.topic === "water" && <GroundAndWater name={name} levels={record.levels} water={record.water} scope="water" />}
        {record.topic === "sales" && <HomeSales name={name} level={record.place.level} geoid={record.place.geoid ?? ""} levels={record.levels} showLookup={false} portrait />}
        {record.topic === "pressure" && <IncomePressure data={record.pressure ?? null} />}
        {record.topic === "lending" && <MortgageLending name={name} levels={record.levels} />}
        {record.topic === "building" && <HomesAdded name={name} level={record.place.level} levels={record.levels} exhibit
          permitted={record.history.find(s => s.metricId === "permits_total_units")?.observations ?? []}
          completed={record.history.find(s => s.metricId === "nj_units_certified")?.observations ?? []}
          demolished={record.history.find(s => s.metricId === "nj_units_demolished")?.observations ?? []}
          net={record.history.find(s => s.metricId === "nj_net_units_added")?.observations ?? []} />}
        {record.topic === "migration" && record.migration && <WhoIsMoving name={name} data={record.migration} exhibit />}
        {record.topic === "market" && <>
          <h2>Prices and paychecks over time</h2>
          <PaycheckExhibit metrics={record.metrics} />
          {record.history.some(s => s.observations.length >= 2) ? <IndexedComparison series={record.history.map(s => ({ metricId: s.metricId, label: s.metricId === "zhvi_sfr" ? "Home values" : s.metricId === "zori_all" ? "Market rent" : "Household income", points: s.observations.map(o => ({ date: o.period_end, value: o.value })) }))} /> : <p className={styles.notice}>Long-run series are unavailable for this selection.</p>}
        </>}
        <p className={styles.notice}><Link href={`${regionPath(record.place.region_id)}/report`}>Every figure, source and download for {name} ↗</Link></p>
      </div>
    </>}
    <noscript><p>Place selection needs JavaScript. The statewide story and source links remain available below.</p></noscript>
  </section>;
}
