"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { scene, view } from "@/lib/globe";
import { WORLD_LAND } from "@/lib/worldLand";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { atlasColor, atlasReading, atlasValue, ATLAS_COLORS, type AtlasCounty, type AtlasMeasure, type AtlasMode } from "@/lib/housingAtlas";
import { formatChange, formatMetric } from "@/lib/format";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";
import { periodLabel, windowLabel } from "@/lib/periods";
import { WINDOWS, windowNote } from "@/lib/windows";
import { regionPath } from "@/lib/placeRoutes";

export function HousingAtlas({measures,counties,stateMeasures,states}:{measures:AtlasMeasure[];counties:AtlasCounty[];stateMeasures:AtlasMeasure[];states:(AtlasCounty&{code:string})[]}) {
  const [level,setLevel]=useState<"globe"|"states"|"county">("globe");
  const [rotation,setRotation]=useState({lon:-96,lat:30});
  const [stateGeometry,setStateGeometry]=useState<PackedOutline[]>([]);
  const [metric,setMetric]=useState(stateMeasures.find(m=>m.metric_id==="zhvi_sfr")?.metric_id??stateMeasures[0].metric_id);
  const [mode,setMode]=useState<AtlasMode>("latest");
  const [selected,setSelected]=useState<number|null>(null);
  const [geometry,setGeometry]=useState<PackedOutline[]>([]);
  const [failed,setFailed]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [descending,setDescending]=useState(true);
  const [viewport,setViewport]=useState({scale:1,x:0,y:0});
  const [panelWidth,setPanelWidth]=useState(370);
  const resizing=useRef<{x:number;width:number}|null>(null);
  const svg=useRef<SVGSVGElement>(null);
  const table=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;x:number;y:number;start:typeof viewport;rotation:typeof rotation}|null>(null);
  const moved=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/atlas/counties.json",{signal:controller.signal}).then(r=>{if(!r.ok) throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>{if(!file.outlines.length) throw new Error();setGeometry(file.outlines);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    fetch("/states.json",{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>setStateGeometry(file.outlines)).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[]);
  const perspective=useMemo(()=>view({lon:level==="county"?-74.65:rotation.lon,lat:level==="county"?40.15:rotation.lat,scale:level==="county"?19000:(level==="globe"?370:1150)*viewport.scale,width:900,height:1000}),[level,rotation,viewport.scale]);
  const countyOutlines=useMemo(()=>unpack(geometry),[geometry]);
  const stateOutlines=useMemo(()=>unpack(stateGeometry),[stateGeometry]);
  const shapes=useMemo(()=>scene(perspective,level==="county"?countyOutlines:stateOutlines,()=>0),[perspective,level,countyOutlines,stateOutlines]);
  const land=useMemo(()=>scene(perspective,WORLD_LAND,()=>0),[perspective]);
  const destinations=level==="county"?counties:stateGeometry.length?stateGeometry.map((outline,index)=>({id:states.find(s=>s.code===outline.id)?.id??-(index+1),name:outline.name,code:String(outline.id)})):states;
  const availableMeasures=level==="county"?measures:stateMeasures;
  const measure=availableMeasures.find(m=>m.metric_id===metric)??availableMeasures[0];
  const reading=atlasReading(measure,mode);
  const rows=new Map(reading?.rows.map(row=>[row.id,row]));
  const figures=destinations.map(county=>({county,row:rows.get(county.id),value:atlasValue(rows.get(county.id),mode)}));
  const values=figures.flatMap(f=>f.value===null?[]:[f.value]);
  const legendColors=values.length&&values.every(value=>value===values[0])?[ATLAS_COLORS[2]]:ATLAS_COLORS;
  const ordered=[...figures].sort((a,b)=>a.value===null ? b.value===null?a.county.name.localeCompare(b.county.name):1 : b.value===null ? -1 : (descending ? b.value-a.value : a.value-b.value)||a.county.name.localeCompare(b.county.name));
  const choice=figures.find(f=>f.county.id===selected);
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
  const changeLevel=(next:typeof level)=>{setLevel(next);setSelected(null);setViewport({scale:1,x:0,y:0});setRotation({lon:-96,lat:next==="globe"?30:38});const list=next==="county"?measures:stateMeasures;if(!list.some(m=>m.metric_id===metric))setMetric(list[0].metric_id);setMode("latest");};
  return <section className="housing-atlas" aria-label="Housing atlas globe and comparison" data-level={level} style={{"--atlas-panel-width":`${panelWidth}px`} as CSSProperties}>
    <div className="atlas-controls">
      <div className="atlas-levels" role="group" aria-label="Map geography"><button type="button" aria-pressed={level==="globe"} onClick={()=>changeLevel("globe")}>Globe</button><button type="button" aria-pressed={level==="states"} onClick={()=>changeLevel("states")}>US states</button><button type="button" aria-pressed={level==="county"} onClick={()=>changeLevel("county")}>NJ counties</button></div>
      <label>Measure<select aria-label="Measure" value={measure.metric_id} onChange={e=>{const next=availableMeasures.find(m=>m.metric_id===e.target.value)!;setMetric(next.metric_id);if(mode!=="latest"&&!next.windows[mode])setMode("latest");}}>{availableMeasures.map(m=><option key={m.metric_id} value={m.metric_id}>{m.label}</option>)}</select></label>
      <label>View<select aria-label="View" value={mode} onChange={e=>setMode(e.target.value as AtlasMode)}><option value="latest">Latest figure</option>{WINDOWS.map(w=><option key={w.key} value={w.key} disabled={!measure.windows[w.key]}>{w.label} · change</option>)}</select></label>
      <span className="atlas-coverage">{level==="county"?"New Jersey counties":"US states & territories"}<b>{values.length}/{destinations.length} published</b></span>
    </div>
    <div className="atlas-workspace">
      <div className="atlas-map-stage">
        <svg ref={svg} className="atlas-county-map" viewBox="0 0 900 1000" tabIndex={0} role="group" aria-label={`${level==="county"?"New Jersey county map. Drag or arrow keys to pan":"World globe. Drag or arrow keys to rotate"}; plus and minus zoom. Shapes select the matching table row.`}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=({ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();if(level==="county")setViewport(v=>({...v,x:v.x+delta[0],y:v.y+delta[1]}));else setRotation(r=>({lon:r.lon+delta[0]/9,lat:Math.max(-85,Math.min(85,r.lat+delta[1]/9))}));}else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}else if(e.key==="-"){e.preventDefault();zoom(.8);}}}
          onPointerDown={e=>{if(e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:viewport,rotation};moved.current=false;}}
          onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(moved.current){const pixels=Math.min(rect.width/900,rect.height/1000);if(level==="county")setViewport({...d.start,x:d.start.x+dx/pixels,y:d.start.y+dy/pixels});else setRotation({lon:d.rotation.lon-dx/pixels*.15,lat:Math.max(-85,Math.min(85,d.rotation.lat+dy/pixels*.15))});}}}
          onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{drag.current=null;moved.current=true;}}>
          <defs><radialGradient id="atlas-sphere" cx="35%" cy="28%"><stop offset="0" stopColor="#42677a"/><stop offset=".7" stopColor="#1d3b50"/><stop offset="1" stopColor="#0c2032"/></radialGradient><pattern id="atlas-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#839096"/><path d="M0 8L8 0" stroke="#cbd4d7" strokeWidth="2"/></pattern><filter id="atlas-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter></defs>
          <rect className="atlas-ocean" width="900" height="1000"/><rect width="900" height="1000" filter="url(#atlas-grain)" opacity=".035" pointerEvents="none"/>
          {level!=="county"&&<circle className="atlas-globe-ocean" cx="450" cy="500" r={perspective.camera.scale} fill="url(#atlas-sphere)"/>}
          <g className="atlas-map-geography" data-rotation={`${rotation.lon},${rotation.lat}`} transform={level==="county"?`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`:"translate(0 0) scale(1)"}>
            {land.map(shape=><path className="atlas-context-land" key={`land-${shape.id}`} d={shape.base} pointerEvents="none"/>)}
            {shapes.map(shape=>{const county=level==="county"?counties.find(c=>c.id===Number(shape.id)):destinations.find(c=>c.name===shape.name), id=county?.id, value=atlasValue(id===undefined?undefined:rows.get(id),mode);return county&&id!==undefined?<path key={id} data-county={id} data-state={level!=="county"?String(shape.id):undefined} data-selected={selected===id} d={shape.base} fill={atlasColor(value,values)} tabIndex={0} role="button" aria-label={`${county.name}: ${format(value)}. Select ${level==="county"?"county":"state"}`} aria-pressed={selected===id} onClick={()=>{if(!moved.current)select(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(id);}}}><title>{county.name} · {format(value)}</title></path>:null;})}
          </g>
        </svg>
        {!(level==="county"?geometry:stateGeometry).length&&<p className="atlas-map-status" role="status">{failed?"Map unavailable. Published figures remain in the table.":"Drawing the atlas…"}</p>}
        <div className="atlas-map-buttons" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>{setViewport({scale:1,x:0,y:0});if(level!=="county")setRotation({lon:-96,lat:level==="globe"?30:38});}}>Reset</button></div>
        <div className="atlas-legend"><span>{format(values.length?Math.min(...values):null)}</span><div role="img" aria-label="Color scale for published area figures">{legendColors.map(color=><i key={color} style={{background:color}}/>)}</div><span>{format(values.length?Math.max(...values):null)}</span><small><i className="atlas-missing-key"/> {values.length===1?"Only one published area; no cross-state comparison yet":"Unavailable for this view · darker means higher, not better"}</small></div>
        <small className="atlas-map-credit">Boundaries: Census TIGER/Line · world silhouette: Natural Earth · area figures, not individual homes</small>
      </div>
      <div className="atlas-panel-resizer" role="separator" tabIndex={0} aria-label="Resize comparison panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={panelWidth}
        onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setPanelWidth(w=>Math.max(320,Math.min(560,w+(e.key==="ArrowLeft"?20:-20))));}}}
        onPointerDown={e=>{resizing.current={x:e.clientX,width:panelWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(resizing.current)setPanelWidth(Math.max(320,Math.min(560,resizing.current.width+resizing.current.x-e.clientX)));}}
        onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} />
      <aside className="atlas-results" aria-label="County results" data-expanded={expanded}>
        <div className="atlas-results-head"><h2>Compare {level==="county"?"counties":"states"}</h2><button className="atlas-sheet-toggle" type="button" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}>{expanded?"Close table":"Show table"}</button></div>
        {level!=="county"&&<p className="atlas-state-coverage">Detailed figures currently cover New Jersey only. Other states are available to explore geographically.</p>}
        <div className="atlas-selected" aria-live="polite">{choice?<><h3>{choice.county.name}</h3><strong>{format(choice.value)}</strong><small>{margin(choice.county.id)}{mode==="latest"&&measure.latest.periods[choice.county.id]?` · ${periodLabel(measure.latest.periods[choice.county.id],metric)}`:""}</small>{level==="county"?<Link className="destination-county" href={regionPath(choice.county.id)}>Open place page →</Link>:choice.county.id===states.find(s=>s.code==="NJ")?.id?<><button type="button" className="atlas-drill" onClick={()=>changeLevel("county")}>Explore New Jersey counties →</button><Link href="/states/new-jersey">Open state page →</Link></>:<p>State and county figures are not available here yet.</p>}</>:<p>Select a {level==="county"?"county":"state"} on the map or in the table.</p>}</div>
        <div className="atlas-reading"><b>{measure.label}</b><span>{mode==="latest"?"Latest figure":"Percentage change"} · {dateLabel}</span></div>
        <div className="atlas-table-wrap" ref={table} id="atlas-table" tabIndex={0} role="region" aria-label={`${level==="county"?"County":"State"} comparison table, scroll for all places`}><table><thead><tr><th scope="col">{level==="county"?"County":"State"}</th><th scope="col"><button type="button" onClick={()=>setDescending(!descending)} aria-label={`Sort figures ${descending?"low to high":"high to low"}`}>Figure {descending?"↓":"↑"}</button></th></tr></thead><tbody>{ordered.map(({county,value})=><tr key={county.id} data-county-row={county.id} data-selected={selected===county.id}><th scope="row"><button type="button" aria-label={`Select ${county.name}`} aria-pressed={selected===county.id} onClick={()=>select(county.id)}>{county.name.replace(/ County$/,"")}</button></th><td>{format(value)}{margin(county.id)&&<small>{margin(county.id)}</small>}{mode==="latest"&&dates.length>1&&<small>{measure.latest.periods[county.id]?periodLabel(measure.latest.periods[county.id],metric):""}</small>}</td></tr>)}</tbody></table></div>
        <details className="atlas-notes"><summary>About this measure & sources</summary><p>{measure.definition}</p>{measure.sourceUrl?<a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source} ↗</a>:<p>{measure.source}</p>}<p>{MARGIN_NOTE}</p>{mode!=="latest"&&windowNote(mode,metric,measure.windows).map(note=><p key={note}>{note}</p>)}<p>Shading uses a linear scale from the lowest to highest published county figure. The scale changes with the measure and window. Missing values are hatched; unavailable periods are disabled. A county figure does not describe every neighborhood or property.</p></details>
      </aside>
    </div>
  </section>;
}
