"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { scene, view } from "@/lib/globe";
import { WORLD_LAND } from "@/lib/worldLand";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { atlasColor, atlasDifference, atlasReading, atlasValue, ATLAS_COLORS, type AtlasCounty, type AtlasMeasure, type AtlasMode } from "@/lib/housingAtlas";
import { formatChange, formatMetric } from "@/lib/format";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";
import { periodLabel, windowLabel } from "@/lib/periods";
import { WINDOWS, windowNote } from "@/lib/windows";
import { regionPath } from "@/lib/placeRoutes";
import { useAtlasCamera } from "./useAtlasCamera";

const EVERYDAY = new Set(["zhvi_sfr","zori_all","acs_median_hh_income","acs_renter_cost_burden","pep_population"]);
const FRIENDLY:Record<string,string> = {zhvi_sfr:"Typical home price",zori_all:"Typical asking rent",acs_median_hh_income:"Household income",acs_renter_cost_burden:"Renters under housing-cost pressure",pep_population:"Population"};

export function HousingAtlas({measures,counties,stateMeasures,states}:{measures:AtlasMeasure[];counties:AtlasCounty[];stateMeasures:AtlasMeasure[];states:(AtlasCounty&{code:string})[]}) {
  const [level,setLevel]=useState<"globe"|"states"|"county">("globe");
  const [rotation,setRotation]=useState({lon:-96,lat:30});
  const [stateGeometry,setStateGeometry]=useState<PackedOutline[]>([]);
  const [metric,setMetric]=useState(stateMeasures.find(m=>m.metric_id==="zhvi_sfr")?.metric_id??stateMeasures[0].metric_id);
  const [mode,setMode]=useState<AtlasMode>("latest");
  const [selected,setSelected]=useState<number|null>(null);
  const [pinned,setPinned]=useState<number|null>(null);
  const [geometry,setGeometry]=useState<PackedOutline[]>([]);
  const [failed,setFailed]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [descending,setDescending]=useState(true);
  const [viewport,setViewport]=useState({scale:1,x:0,y:0});
  const [panelWidth,setPanelWidth]=useState(370);
  const [moreMeasures,setMoreMeasures]=useState(false);
  const [measureSearch,setMeasureSearch]=useState("");
  const [restored,setRestored]=useState(false);
  const [shareStatus,setShareStatus]=useState("");
  const [countySearch,setCountySearch]=useState("");
  const [sheetHeight,setSheetHeight]=useState(190);
  const results=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!results.current)return;
    const observer=new ResizeObserver(()=>setSheetHeight(Math.ceil(results.current?.getBoundingClientRect().height??190)));
    observer.observe(results.current);return()=>observer.disconnect();
  },[]);
  const [dragging,setDragging]=useState(false);
  const controls=useRef<HTMLDivElement>(null);
  const measureLauncher=useRef<HTMLButtonElement>(null);
  const measureSearchInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!moreMeasures)return;
    measureSearchInput.current?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMoreMeasures(false);measureLauncher.current?.focus();}};
    const outside=(event:PointerEvent)=>{if(!controls.current?.contains(event.target as Node))setMoreMeasures(false);};
    document.addEventListener("keydown",key);document.addEventListener("pointerdown",outside);
    return()=>{document.removeEventListener("keydown",key);document.removeEventListener("pointerdown",outside);};
  },[moreMeasures]);
  useEffect(()=>{
    const restore=()=>{
      const params=new URLSearchParams(window.location.search);
      const next=params.get("level");
      const nextLevel=next==="county"||next==="states"?next:"globe";
      const list=nextLevel==="county"?measures:stateMeasures;
      const picked=list.find(m=>m.metric_id===params.get("measure"))??list[0];
      const requested=params.get("view") as AtlasMode;
      setLevel(nextLevel);setMetric(picked.metric_id);setMode(requested&&requested!=="latest"&&picked.windows[requested]?requested:"latest");
      const id=Number(params.get("place"));
      setSelected(params.has("place")&&Number.isFinite(id)?id:null);
      const pin=Number(params.get("pin"));
      setPinned(params.has("pin")&&(nextLevel==="county"?counties:states).some(area=>area.id===pin)?pin:null);
      const lon=Number(params.get("lon")),lat=Number(params.get("lat")),scale=Number(params.get("zoom")),x=Number(params.get("x")),y=Number(params.get("y"));
      setRotation({lon:params.has("lon")&&Number.isFinite(lon)?lon:-96,lat:params.has("lat")&&Number.isFinite(lat)?Math.max(-85,Math.min(85,lat)):30});
      setViewport({scale:params.has("zoom")&&Number.isFinite(scale)?Math.max(.8,Math.min(6,scale)):1,x:Number.isFinite(x)?x:0,y:Number.isFinite(y)?y:0});
      setRestored(true);
    };
    restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[measures,stateMeasures,counties,states]);
  useEffect(()=>{
    if(!restored)return;
    const timer=window.setTimeout(()=>{
      const url=new URL(window.location.href);
      const params=url.searchParams;
      params.set("level",level);params.set("measure",metric);params.set("view",mode);
      if(selected!==null)params.set("place",String(selected));else params.delete("place");
      if(pinned!==null)params.set("pin",String(pinned));else params.delete("pin");
      params.set("lon",String(rotation.lon));params.set("lat",String(rotation.lat));params.set("zoom",String(viewport.scale));params.set("x",String(viewport.x));params.set("y",String(viewport.y));
      window.history.replaceState(null,"",url);
    },150);
    return()=>window.clearTimeout(timer);
  },[restored,level,metric,mode,selected,pinned,rotation,viewport]);
  const resizing=useRef<{x:number;width:number}|null>(null);
  const svg=useRef<SVGSVGElement>(null);
  const table=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;x:number;y:number;start:typeof viewport;rotation:typeof rotation}|null>(null);
  const moved=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/states.json",{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>setStateGeometry(file.outlines)).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!restored||level!=="county"||geometry.length)return;
    const controller=new AbortController();
    setFailed(false);
    fetch("/atlas/counties.json",{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>{if(!file.outlines.length)throw new Error();setGeometry(file.outlines);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[restored,level,geometry.length]);
  const targetCamera=useMemo(()=>({lon:level==="county"?-74.65:rotation.lon,lat:level==="county"?40.15:rotation.lat,scale:level==="county"?19000:(level==="globe"?370:1150)*viewport.scale,zoom:viewport.scale,x:viewport.x,y:viewport.y}),[level,rotation,viewport]);
  const camera=useAtlasCamera(targetCamera,dragging||!restored);
  const perspective=useMemo(()=>view({...camera,width:900,height:1000}),[camera]);
  const countyOutlines=useMemo(()=>unpack(geometry),[geometry]);
  const stateOutlines=useMemo(()=>unpack(stateGeometry),[stateGeometry]);
  const shapes=useMemo(()=>scene(perspective,level==="county"?countyOutlines:stateOutlines,()=>0),[perspective,level,countyOutlines,stateOutlines]);
  // The low-resolution world silhouette is useful at globe scale, not parcel-close zoom.
  const land=useMemo(()=>level==="county"?[]:scene(perspective,WORLD_LAND,()=>0),[perspective,level]);
  const destinations=level==="county"?counties:stateGeometry.length?stateGeometry.map((outline,index)=>({id:states.find(s=>s.code===outline.id)?.id??-(index+1),name:outline.name,code:String(outline.id)})):states;
  const availableMeasures=level==="county"?measures:stateMeasures;
  const measure=availableMeasures.find(m=>m.metric_id===metric)??availableMeasures[0];
  const chooseMeasure=(next:AtlasMeasure)=>{setMetric(next.metric_id);if(mode!=="latest"&&!next.windows[mode])setMode("latest");setMoreMeasures(false);measureLauncher.current?.focus();};
  const reading=atlasReading(measure,mode);
  const rows=new Map(reading?.rows.map(row=>[row.id,row]));
  const figures=destinations.map(county=>({county,row:rows.get(county.id),value:atlasValue(rows.get(county.id),mode)}));
  const values=figures.flatMap(f=>f.value===null?[]:[f.value]);
  const legendColors=values.length&&values.every(value=>value===values[0])?[ATLAS_COLORS[2]]:ATLAS_COLORS;
  const ordered=[...figures].sort((a,b)=>a.value===null ? b.value===null?a.county.name.localeCompare(b.county.name):1 : b.value===null ? -1 : (descending ? b.value-a.value : a.value-b.value)||a.county.name.localeCompare(b.county.name));
  const visibleRows=ordered.filter(f=>level!=="county"||f.county.name.toLowerCase().includes(countySearch.trim().toLowerCase()));
  const shading=mode!=="latest"?"Darker = a larger percentage change.":({zhvi_sfr:"Darker = higher typical home prices.",zori_all:"Darker = higher typical asking rents.",acs_median_hh_income:"Darker = higher household incomes.",acs_renter_cost_burden:"Darker = more renters spending over 30% of income on housing.",pep_population:"Darker = more residents.",acs_median_gross_rent:"Darker = higher surveyed rents, including utilities.",acs_median_home_value:"Darker = higher surveyed home values.",permits_total_units:"Darker = more homes permitted—not completed."} as Record<string,string>)[measure.metric_id]??"Darker = a higher figure.";
  const choice=figures.find(f=>f.county.id===selected);
  const outlineOnly=Boolean(choice&&choice.county.id<0);
  const anchor=figures.find(f=>f.county.id===pinned);
  const difference=anchor&&choice&&pinned!==selected?atlasDifference(measure,mode,anchor.county.id,choice.county.id):null;
  const differenceLabel=difference?.value===null?difference.reason:difference?.value!==undefined?`${difference.value>=0?"+":"−"}${mode!=="latest"||measure.unit==="ratio"?(Math.abs(difference.value)*(mode==="latest"?100:1)).toFixed(1)+" percentage points":formatMetric(Math.abs(difference.value),measure.unit,metric)}`:null;
  const format=(value:number|null)=>value===null?mode==="latest"?"Not published":"No comparable figure":mode==="latest"?formatMetric(value,measure.unit,metric):formatChange(value);
  const margin=(id:number)=>{const row=rows.get(id);return mode==="latest" ? row?.latest!=null ? marginLabel(row.latest,row.latestMargin??null,measure.unit,metric) : "" : changeMarginLabel(row?.changeMargin??null,metric);};
  const dates=mode==="latest" ? [...new Set(Object.values(measure.latest.periods))].sort() : [];
  const dateLabel=mode==="latest" ? dates.length>1?`Dates vary: ${periodLabel(dates[0],metric)} – ${periodLabel(dates.at(-1)!,metric)}`:dates.length?periodLabel(dates[0],metric):"No published dates" : reading?.start&&reading.end ? windowLabel(reading.start,reading.end,metric) : "No published window";
  const select=(id:number)=>{
    setSelected(id);
    if(level!=="county") {
      const destination=destinations.find(s=>s.id===id);
      const shape=stateGeometry.find(s=>s.name===destination?.name);
      const flat=shape?unpack([shape])[0].rings.flat():[];
      if(flat.length) {setLevel("states");setRotation({lon:flat.filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0)/(flat.length/2),lat:flat.filter((_,i)=>i%2!==0).reduce((a,b)=>a+b,0)/(flat.length/2)});setViewport({scale:1,x:0,y:0});}
    }
    const path=svg.current?.querySelector<SVGPathElement>(`[data-county="${id}"]`);
    if(path&&level==="county") {
      const box=path.getBBox();
      setViewport(current=>{const scale=Math.max(current.scale,1.35);return {scale,x:450-(box.x+box.width/2)*scale,y:500-(box.y+box.height/2)*scale};});
    }
    const row=table.current?.querySelector<HTMLElement>(`[data-county-row="${id}"]`);
    if(row&&table.current) {
      const panel=table.current.getBoundingClientRect(), rect=row.getBoundingClientRect();
      if(rect.top<panel.top+45) table.current.scrollTop-=panel.top+45-rect.top;
      else if(rect.bottom>panel.bottom) table.current.scrollTop+=rect.bottom-panel.bottom;
    }
  };
  const zoom=(factor:number)=>setViewport(current=>{
    const scale=Math.min(6,Math.max(.8,current.scale*factor)), ratio=scale/current.scale;
    return {scale,x:450-(450-current.x)*ratio,y:500-(500-current.y)*ratio};
  });
  const changeLevel=(next:typeof level)=>{setLevel(next);setSelected(null);setPinned(null);setViewport({scale:1,x:0,y:0});setRotation({lon:-96,lat:next==="globe"?30:38});const list=next==="county"?measures:stateMeasures;if(!list.some(m=>m.metric_id===metric))setMetric(list[0].metric_id);setMode("latest");};
  return <section className="housing-atlas" aria-label="Housing atlas globe and comparison" data-level={level} style={{"--atlas-panel-width":`${panelWidth}px`,"--atlas-sheet-height":`${sheetHeight}px`} as CSSProperties}>
    <div className="atlas-controls" ref={controls}>
      <div className="atlas-levels" role="group" aria-label="Map geography"><button type="button" aria-pressed={level!=="county"&&selected!==states.find(s=>s.code==="NJ")?.id} onClick={()=>{setCountySearch("");changeLevel("states");}}>United States</button><span aria-hidden="true">›</span><button type="button" aria-pressed={level==="states"&&selected===states.find(s=>s.code==="NJ")?.id} onClick={()=>{setCountySearch("");changeLevel("states");setSelected(states.find(s=>s.code==="NJ")?.id??null);setRotation({lon:-74.65,lat:40.15});}}>New Jersey</button><span aria-hidden="true">›</span><button type="button" aria-pressed={level==="county"} onClick={()=>{setCountySearch("");changeLevel("county");}}>Counties</button><button className="atlas-globe-reset" type="button" aria-label="Globe" title="Return to globe" onClick={()=>{setCountySearch("");changeLevel("globe");}}>◎</button></div>
      <div className="atlas-filter-row"><label className="atlas-measure-field"><span>Measure</span><div className="atlas-measure-control"><select aria-label="Measure" value={measure.metric_id} onChange={e=>{setMetric(e.target.value);const next=availableMeasures.find(m=>m.metric_id===e.target.value)!;if(mode!=="latest"&&!next.windows[mode])setMode("latest");}}>{availableMeasures.filter(m=>EVERYDAY.has(m.metric_id)||m.metric_id===measure.metric_id).map(m=><option key={m.metric_id} value={m.metric_id}>{FRIENDLY[m.metric_id]??m.label}</option>)}</select><button ref={measureLauncher} className="atlas-catalogue-button" type="button" aria-label="Browse all measures" title="Browse all measures" aria-expanded={moreMeasures} aria-controls="atlas-measure-picker" onClick={()=>{setMoreMeasures(!moreMeasures);setMeasureSearch("");}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg><span>All</span></button></div></label>
      <label className="atlas-view-field"><span>Time</span><select aria-label="View" value={mode} onChange={e=>setMode(e.target.value as AtlasMode)}><option value="latest">Latest figure</option>{WINDOWS.map(w=><option key={w.key} value={w.key} disabled={!measure.windows[w.key]}>{w.label} · change</option>)}</select></label></div>
      {moreMeasures&&<div id="atlas-measure-picker" className="atlas-measure-picker" role="region" aria-label="Measure catalogue">
        <header><div><small>MEASURES</small><h2>Choose a measure</h2></div><button type="button" aria-label="Close measures" onClick={()=>{setMoreMeasures(false);measureLauncher.current?.focus({preventScroll:true});}}>×</button></header>
        <label>Search measures<input ref={measureSearchInput} type="search" value={measureSearch} onChange={e=>setMeasureSearch(e.target.value)} placeholder="Rent, income, building…"/></label>
        {["Everyday figures","Other price & rent measures","Building & supply"].map((group,index)=>{
          const matches=availableMeasures.filter(m=>(index===0?EVERYDAY.has(m.metric_id):index===2?m.metric_id.startsWith("permits_"):!EVERYDAY.has(m.metric_id)&&!m.metric_id.startsWith("permits_"))).filter(m=>`${m.label} ${FRIENDLY[m.metric_id]??""} ${m.definition}`.toLowerCase().includes(measureSearch.toLowerCase()));
          return matches.length?<div className="atlas-measure-group" key={group} data-category={index}><h3>{group}</h3>{matches.map(m=><button type="button" key={m.metric_id} aria-pressed={m.metric_id===measure.metric_id} onClick={()=>chooseMeasure(m)}><b>{FRIENDLY[m.metric_id]??m.label}<span aria-hidden="true">{m.metric_id===measure.metric_id?"✓":"↗"}</span></b><span>{m.definition}</span><small>{level==="county"?"NJ county figures":"State figures"} · {m.latest.rows.length} published areas</small></button>)}</div>:null;
        })}
        {!availableMeasures.some(m=>`${m.label} ${FRIENDLY[m.metric_id]??""} ${m.definition}`.toLowerCase().includes(measureSearch.toLowerCase()))&&<p>No matching measures. Try rent, income or building.</p>}
      </div>}
      <div className="atlas-control-footer"><span className="atlas-coverage"><i aria-hidden="true"/>{level==="county"?`${values.length}/${destinations.length} counties with figures`:"Figures: New Jersey · other states: outlines"}</span><button className="atlas-share-button" type="button" onClick={async()=>{try{const url=new URL(window.location.href);const params=url.searchParams;params.set("level",level);params.set("measure",metric);params.set("view",mode);if(selected!==null)params.set("place",String(selected));else params.delete("place");if(pinned!==null)params.set("pin",String(pinned));else params.delete("pin");params.set("lon",String(rotation.lon));params.set("lat",String(rotation.lat));params.set("zoom",String(viewport.scale));params.set("x",String(viewport.x));params.set("y",String(viewport.y));await navigator.clipboard.writeText(url.href);setShareStatus("Link copied");}catch{setShareStatus("Copy this page’s address to share this view");}}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/></svg>Share view</button><span className="atlas-share-status" role="status">{shareStatus}</span></div>
    </div>
    <div className="atlas-workspace">
      <div className="atlas-map-stage">
        <svg ref={svg} className="atlas-county-map" viewBox="0 0 900 1000" tabIndex={0} role="group" aria-label={`${level==="county"?"New Jersey county map. Drag or arrow keys to pan":"World globe. Drag or arrow keys to rotate"}; plus and minus zoom. Shapes select the matching table row.`}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=({ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();if(level==="county")setViewport(v=>({...v,x:v.x+delta[0],y:v.y+delta[1]}));else setRotation(r=>({lon:r.lon+delta[0]/9,lat:Math.max(-85,Math.min(85,r.lat+delta[1]/9))}));}else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}else if(e.key==="-"){e.preventDefault();zoom(.8);}}}
          onPointerDown={e=>{if(e.button!==0)return;setDragging(true);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:viewport,rotation};moved.current=false;}}
          onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(moved.current){const pixels=Math.min(rect.width/900,rect.height/1000);if(level==="county")setViewport({...d.start,x:d.start.x+dx/pixels,y:d.start.y+dy/pixels});else setRotation({lon:d.rotation.lon-dx/pixels*.15,lat:Math.max(-85,Math.min(85,d.rotation.lat+dy/pixels*.15))});}}}
          onPointerUp={e=>{setDragging(false);drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{setDragging(false);drag.current=null;moved.current=true;}}>
          <defs><radialGradient id="atlas-sphere" cx="35%" cy="28%"><stop offset="0" stopColor="#42677a"/><stop offset=".7" stopColor="#1d3b50"/><stop offset="1" stopColor="#0c2032"/></radialGradient><pattern id="atlas-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#839096"/><path d="M0 8L8 0" stroke="#cbd4d7" strokeWidth="2"/></pattern><filter id="atlas-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter></defs>
          <rect className="atlas-ocean" width="900" height="1000"/><rect width="900" height="1000" filter="url(#atlas-grain)" opacity=".035" pointerEvents="none"/>
          {level!=="county"&&<circle className="atlas-globe-ocean" cx="450" cy="500" r={perspective.camera.scale} fill="url(#atlas-sphere)"/>}
          <g className="atlas-map-geography" data-rotation={`${rotation.lon},${rotation.lat}`} data-camera={`${camera.lon},${camera.lat},${camera.scale}`} transform={level==="county"?`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`:"translate(0 0) scale(1)"}>
            {land.map(shape=><path className="atlas-context-land" key={`land-${shape.id}`} d={shape.base} pointerEvents="none"/>)}
            {shapes.map(shape=>{const county=level==="county"?counties.find(c=>c.id===Number(shape.id)):destinations.find(c=>c.name===shape.name), id=county?.id, value=atlasValue(id===undefined?undefined:rows.get(id),mode);return county&&id!==undefined?<path key={id} data-county={id} data-state={level!=="county"?String(shape.id):undefined} data-selected={selected===id} data-pinned={pinned===id} d={shape.base} fill={atlasColor(value,values)} tabIndex={0} role="button" aria-label={`${county.name}: ${format(value)}. Select ${level==="county"?"county":"state"}`} aria-pressed={selected===id} onClick={()=>{if(!moved.current)select(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(id);}}}><title>{county.name} · {format(value)}</title></path>:null;})}
          </g>
        </svg>
        {!(level==="county"?geometry:stateGeometry).length&&<p className="atlas-map-status" role="status">{failed?"Map unavailable. Published figures remain in the table.":"Drawing the atlas…"}</p>}
        <div className="atlas-map-buttons" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>{setViewport({scale:1,x:0,y:0});if(level!=="county")setRotation({lon:-96,lat:level==="globe"?30:38});}}>Reset</button></div>
        <div className="atlas-legend"><span>{format(values.length?Math.min(...values):null)}</span><div role="img" aria-label="Color scale for published area figures">{legendColors.map(color=><i key={color} style={{background:color}}/>)}</div><span>{format(values.length?Math.max(...values):null)}</span><small>{values.length===1?"Only one published area; no cross-area comparison yet":shading}</small><small><i className="atlas-missing-key"/>No figure for this view · higher is not necessarily better</small></div>
        <small className="atlas-map-credit">Boundaries: Census TIGER/Line · world silhouette: Natural Earth · area figures, not individual homes</small>
      </div>
      <div className="atlas-panel-resizer" role="separator" tabIndex={0} aria-label="Resize comparison panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={panelWidth}
        onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setPanelWidth(w=>Math.max(320,Math.min(560,w+(e.key==="ArrowLeft"?20:-20))));}}}
        onPointerDown={e=>{resizing.current={x:e.clientX,width:panelWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(resizing.current)setPanelWidth(Math.max(320,Math.min(560,resizing.current.width+resizing.current.x-e.clientX)));}}
        onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} />
      <aside ref={results} className="atlas-results" aria-label="Place comparison results" data-expanded={expanded}>
        <div className="atlas-results-head"><h2>Compare {level==="county"?"counties":"states"}</h2><button className="atlas-sheet-toggle" type="button" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}>{expanded?"Close table":`Compare ${level==="county"?"counties":"states"}`}</button></div>
        {choice&&<button className="atlas-clear-selection" type="button" onClick={()=>setSelected(null)}>Clear selection ×</button>}
{choice&&choice.county.id>0&&<button className="atlas-pin-button" type="button" aria-pressed={pinned===selected} onClick={()=>{setPinned(pinned===selected?null:selected);if(pinned!==selected)setExpanded(true);}}>{pinned===selected?"Unpin place":pinned!==null?"Replace pinned place":"Pin for comparison"}</button>}
        {anchor&&<div className="atlas-comparison" aria-label="Two-place comparison"><header><button type="button" onClick={()=>select(anchor.county.id)}>Pinned: {anchor.county.name}</button><button type="button" aria-label="Clear pinned place" onClick={()=>setPinned(null)}>×</button></header>{choice&&pinned!==selected?<><div className="atlas-comparison-pair">{[anchor,choice].map(area=><div key={area.county.id}><b>{area.county.name}</b><strong>{format(area.value)}</strong><small>{margin(area.county.id)}</small>{level==="county"&&<Link className="destination-county" href={regionPath(area.county.id)}>Open place →</Link>}<small>{mode==="latest"&&measure.latest.periods[area.county.id]?periodLabel(measure.latest.periods[area.county.id],metric):dateLabel}</small></div>)}</div><p>{difference?.value===null?differenceLabel:`${choice.county.name} − ${anchor.county.name}: ${differenceLabel}`}</p><small>Descriptive difference, not statistical significance.</small></>:<p>Select another place to compare.</p>}</div>}
        {level!=="county"&&<p className="atlas-state-coverage">New Jersey only. Other states: outlines, not figures.</p>}
        {outlineOnly&&<p className="atlas-outline-status" role="status">Boundary only · figures not yet supported</p>}
        <div className="atlas-selected" aria-live="polite" data-active={Boolean(choice)}><div key={`${selected}-${metric}-${mode}`} className="atlas-selection-content">{choice?<><h3>{choice.county.name}</h3><strong>{format(choice.value)}</strong><small>{margin(choice.county.id)}{mode==="latest"&&measure.latest.periods[choice.county.id]?` · ${periodLabel(measure.latest.periods[choice.county.id],metric)}`:""}</small>{level==="county"?<Link className="destination-county" href={regionPath(choice.county.id)}>Open place page →</Link>:choice.county.id===states.find(s=>s.code==="NJ")?.id?<><button type="button" className="atlas-drill" onClick={()=>changeLevel("county")}>Explore New Jersey counties →</button><Link href="/states/new-jersey">Open state page →</Link></>:<p>State and county figures are not available here yet.</p>}</>:<p>Select a {level==="county"?"county":"state"} on the map or in the table.</p>}</div></div>
        <div className="atlas-reading"><b>{FRIENDLY[measure.metric_id]??measure.label}</b><span>{mode==="latest"?"Latest figure":"Percentage change"} · {dateLabel}</span><p className="atlas-how-to-read">{measure.definition}</p></div>
        {level==="county"&&<div className="atlas-county-finder"><label>Find a county<input type="search" value={countySearch} onChange={e=>setCountySearch(e.target.value)} placeholder="County name"/></label>{countySearch&&<small role="status">{visibleRows.length} matching {visibleRows.length===1?"county":"counties"} · map still shows all counties</small>}</div>}
<div className="atlas-table-wrap" ref={table} id="atlas-table" tabIndex={0} role="region" aria-label={`${level==="county"?"County":"State"} comparison table, scroll for all places`}><table><thead><tr><th scope="col">{level==="county"?"County":"State"}</th><th scope="col"><button type="button" onClick={()=>setDescending(!descending)} aria-label={`Sort figures ${descending?"low to high":"high to low"}`}>Figure {descending?"↓":"↑"}</button></th></tr></thead><tbody>{visibleRows.map(({county,value})=><tr key={county.id} data-county-row={county.id} data-selected={selected===county.id} data-pinned={pinned===county.id}><th scope="row"><button type="button" aria-label={`Select ${county.name}`} aria-pressed={selected===county.id} onClick={()=>select(county.id)}>{county.name.replace(/ County$/,"")}</button></th><td>{format(value)}{margin(county.id)&&<small>{margin(county.id)}</small>}{mode==="latest"&&dates.length>1&&<small>{measure.latest.periods[county.id]?periodLabel(measure.latest.periods[county.id],metric):""}</small>}</td></tr>)}</tbody></table></div>
        <details className="atlas-notes"><summary>About this measure & sources</summary><p>{measure.definition}</p>{measure.sourceUrl?<a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source} ↗</a>:<p>{measure.source}</p>}<p>{MARGIN_NOTE}</p>{mode!=="latest"&&windowNote(mode,metric,measure.windows).map(note=><p key={note}>{note}</p>)}<p>The linear scale resets with each measure and period. Hatched areas have no figure; unavailable periods are disabled. Area figures do not describe an individual property.</p></details>
      </aside>
    </div>
  </section>;
}
