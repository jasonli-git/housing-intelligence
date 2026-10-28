"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlacePicker } from "./PlacePicker";
import { PlaceStoryChart } from "./PlaceStoryChart";
import { CommunityContext } from "./CommunityContext";
import { GroundAndWater } from "./GroundAndWater";
import { GettingAround } from "./GettingAround";
import { IndexedComparison } from "./IndexedComparison";
import { PaycheckExhibit } from "./ExhibitCharts";
import { HomeSales } from "./HomeSales";
import { IncomePressure } from "./IncomePressure";
import { MortgageLending } from "./MortgageLending";
import { HomesAdded } from "./HomesAdded";
import { WhoIsMoving } from "./WhoIsMoving";
import { HowUnusual } from "./HowUnusual";
import { FloodRisk } from "./FloodRisk";
import { Utilities } from "./Utilities";
import { BroadbandStoryExplorer, UtilityOutageExplorer } from "./LivingStoryExplorers";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { coveredState } from "@/lib/states";
import { displayName } from "@/lib/names";
import { regionPath } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, placeStoryName, storyHistoryMetrics, storyPlaceId, type PlaceStoryRecord } from "@/lib/placeStories";
import type { CommunityContext as CommunityData, HousingPressure, Inquiry, Migration, Packet, Observation, Persistence, Utilities as UtilityData, WaterSystems, WorkDestinations } from "@/lib/api";
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
        const [packet, water, destinations, observations, pressure, migration, utilities, freshness, community] = await Promise.all([
          optionalJson<Packet>(`${base}/packet/5y.json`, abort.signal),
          initial.topic === "water" ? optionalJson<WaterSystems>(`${base}/water-systems.json`, abort.signal) : null,
          initial.topic === "commute" ? optionalJson<WorkDestinations>(`${base}/work-destinations.json`, abort.signal) : null,
          storyHistoryMetrics(initial.topic).length ? optionalJson<{ total: number; observations: Observation[] }>(`${base}/metrics.json`, abort.signal) : null,
          initial.topic === "pressure" ? optionalJson<HousingPressure>(`${base}/housing-pressure.json`, abort.signal) : null,
          initial.topic === "migration" ? optionalJson<Migration>(`${base}/migration.json`, abort.signal) : null,
          initial.topic === "utilities" ? optionalJson<UtilityData>(`${base}/utilities.json`, abort.signal) : null,
          initial.topic === "utilities" ? optionalJson<{sources:{source_id:string;inquiries?:Inquiry[]}[]}>(`${artifactUrl}/freshness.json`,abort.signal):null,
          (initial.topic === "broadband" || initial.topic === "health") ? optionalJson<CommunityData>(`${base}/community.json`,abort.signal):null,
        ]);
        if (!packet || packet.region?.region_id !== id || !Array.isArray(packet.levels) || !["county", "municipality", "zip"].includes(packet.region.level)) throw new Error("No supported place packet");
        // Only an explicit county selection or a verified county parent supplies
        // context. A ZIP without one is unsupported; do not infer from its name.
        const county = initial.topic === "past" ? packet.region.level === "county" ? { region_id: id, name: packet.region.name }
          : packet.region.parent?.level === "county" ? packet.region.parent : null : null;
        const countyHistory = county ? { region_id: county.region_id, name: `${county.name.replace(/ County$/, "")} County`, data: await optionalJson<Persistence>(`${artifactUrl}/regions/${county.region_id}/persistence.json`, abort.signal) } : null;
        const metricFiles=new Map<number,Promise<{total:number;observations:Observation[]}|null>>();
        const read=async(regionId:number,metric:string)=>{
          if(!metricFiles.has(regionId))metricFiles.set(regionId,optionalJson<{total:number;observations:Observation[]}>(`${artifactUrl}/regions/${regionId}/metrics.json`,abort.signal));
          const file=await metricFiles.get(regionId);
          if(!file||!Array.isArray(file.observations)||file.total!==file.observations.length)throw new Error("Incomplete flood observations");
          return file.observations.filter(o=>o.metric_id===metric);
        };
        const flood=initial.topic==="flood"?await loadFloodStory({region_id:id,level:packet.region.level},packet.region.parent?.level==="county"?{region_id:packet.region.parent.region_id,name:displayName(packet.region.parent)}:null,coveredState(packet.region.state_code)?.regionId??null,read):null;
        const history = observations && Array.isArray(observations.observations) && observations.total === observations.observations.length
          ? storyHistoryMetrics(initial.topic).map(metricId => ({ metricId, observations: observations.observations.filter(o => o.metric_id === metricId) })) : [];
        next = makePlaceStoryRecord(initial.topic, { region_id: id, name: packet.region.name, level: packet.region.level, state_code: packet.region.state_code, geoid: packet.region.geoid, ...(county ? { county_id: county.region_id } : {}) }, packet.levels, { metrics: initial.topic === "market" ? packet.metrics : [], history, water, destinations, pressure, migration, countyHistory, flood,utilities,utilityInquiry:freshness?.sources.find(s=>s.source_id==="nj_bpu_reports")?.inquiries?.at(-1)??null,community });
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
  const contextName = record?.topic === "past" ? record.countyHistory?.name : undefined;
  return <section className={styles.focus} data-place-story-focus data-selected={Boolean(record)} data-story-topic={initial.topic} aria-label="Explore a place in this story">
    <div className={styles.focusTop}><h2>{record ? `Exploring ${contextName ?? name}` : "Explore a place"}</h2>{record && <Link href={`${regionPath(record.place.region_id)}${record.place.region_id === initial.place.region_id ? "#place-story-gallery" : ""}`}>Back to {name} ↗</Link>}</div>
    <PlacePicker key={record?.place.region_id ?? "unselected"} entries={entries} onFocus={loadEntries} onPick={pick} keepPicked initialQuery={name} failed={failed} className={styles.picker} label="Focus this story on a town, county or ZIP" placeholder="Town, county or ZIP" name={`story-place-${initial.topic}`} />
    {message && <p className={styles.notice} role="status">{message}</p>}
    {record && <>
      {record.topic === "past" && <p className={styles.notice}>{contextName ? `${contextName} history${record.place.level === "county" ? "" : ` · county context for ${name}`}. This is not a town-level comparison.` : "No verified county history is available for this selection."}</p>}
      <PlaceStoryChart record={record} />
      <div className={styles.focusBody}>
        {record.topic === "commute" && <GettingAround name={name} level={record.place.level} levels={record.levels} destinations={record.destinations} />}
        {record.topic === "water" && <GroundAndWater name={name} levels={record.levels} water={record.water} scope="water" />}
        {record.topic === "health" && <CommunityContext data={record.community??null} level={record.place.level} topics={["health"]}/>}
        {record.topic === "sites" && <GroundAndWater name={name} levels={record.levels} water={null} scope="sites"/>}
        {record.topic === "utilities" && <><UtilityOutageExplorer key={record.place.region_id} data={record.utilities??null}/><Utilities data={record.utilities??null} bpuInquiry={record.utilityInquiry??undefined}/></>}
        {record.topic === "broadband" && <BroadbandStoryExplorer key={record.place.region_id} data={record.community??null} level={record.place.level}/>}
        {record.topic === "flood" && <FloodRisk name={name} levels={record.levels} claims={record.flood?.claims??[]} paid={record.flood?.paid??[]} unplaced={record.flood?.unplaced??[]} newestYear={record.flood?.newest??null} claimsPlace={record.flood?.place??null} estimated={record.flood?.estimated??false} unseparable={record.flood?.unseparable??false}/>}
        {record.topic === "sales" && <HomeSales name={name} level={record.place.level} geoid={record.place.geoid ?? ""} levels={record.levels} showLookup={false} portrait />}
        {record.topic === "pressure" && <IncomePressure data={record.pressure ?? null} />}
        {record.topic === "lending" && <MortgageLending name={name} levels={record.levels} />}
        {record.topic === "building" && <HomesAdded name={name} level={record.place.level} levels={record.levels} exhibit
          permitted={record.history.find(s => s.metricId === "permits_total_units")?.observations ?? []}
          completed={record.history.find(s => s.metricId === "nj_units_certified")?.observations ?? []}
          demolished={record.history.find(s => s.metricId === "nj_units_demolished")?.observations ?? []}
          net={record.history.find(s => s.metricId === "nj_net_units_added")?.observations ?? []} />}
        {record.topic === "migration" && record.migration && <WhoIsMoving name={name} data={record.migration} exhibit />}
        {record.topic === "past" && record.countyHistory?.data && <HowUnusual key={record.countyHistory.region_id} name={record.countyHistory.name} data={record.countyHistory.data} interactive />}
        {record.topic === "market" && <>
          <h2>Prices and paychecks over time</h2>
          <PaycheckExhibit metrics={record.metrics} />
          {record.history.some(s => s.observations.length >= 2) ? <IndexedComparison series={record.history.map(s => ({ metricId: s.metricId, label: s.metricId === "zhvi_sfr" ? "Home values" : s.metricId === "zori_all" ? "Market rent" : "Household income", points: s.observations.map(o => ({ date: o.period_end, value: o.value })) }))} /> : <p className={styles.notice}>Long-run series are unavailable for this selection.</p>}
        </>}
        <p className={styles.notice}><Link href={`${regionPath(record.topic === "past" && record.countyHistory ? record.countyHistory.region_id : record.place.region_id)}/report`}>Every figure, source and download for {contextName ?? name} ↗</Link></p>
      </div>
    </>}
    <noscript><p>Place selection needs JavaScript. The statewide story and source links remain available below.</p></noscript>
  </section>;
}
