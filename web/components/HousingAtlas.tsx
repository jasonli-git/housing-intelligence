"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { scene, view } from "@/lib/globe";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { atlasColor, atlasReading, atlasValue, ATLAS_COLORS, type AtlasCounty, type AtlasMeasure, type AtlasMode } from "@/lib/housingAtlas";
import { formatChange, formatMetric } from "@/lib/format";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";
import { periodLabel, windowLabel } from "@/lib/periods";
import { WINDOWS, windowNote } from "@/lib/windows";
import { regionPath } from "@/lib/placeRoutes";

export function HousingAtlas({measures,counties}:{measures:AtlasMeasure[];counties:AtlasCounty[]}) {
  const [metric,setMetric]=useState(measures.find(m=>m.metric_id==="zhvi_sfr")?.metric_id??measures[0].metric_id);
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
  const drag=useRef<{id:number;x:number;y:number;start:typeof viewport}|null>(null);
  const moved=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/atlas/counties.json",{signal:controller.signal}).then(r=>{if(!r.ok) throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>{if(!file.outlines.length) throw new Error();setGeometry(file.outlines);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[]);
  const shapes=useMemo(()=>scene(view({lon:-74.65,lat:40.15,scale:19000,width:900,height:1000}),unpack(geometry),()=>0),[geometry]);
  const measure=measures.find(m=>m.metric_id===metric)!;
  const reading=atlasReading(measure,mode);
  const rows=new Map(reading?.rows.map(row=>[row.id,row]));
  const figures=counties.map(county=>({county,row:rows.get(county.id),value:atlasValue(rows.get(county.id),mode)}));
  const values=figures.flatMap(f=>f.value===null?[]:[f.value]);
  const ordered=[...figures].sort((a,b)=>a.value===null ? b.value===null?a.county.name.localeCompare(b.county.name):1 : b.value===null ? -1 : (descending ? b.value-a.value : a.value-b.value)||a.county.name.localeCompare(b.county.name));
  const choice=figures.find(f=>f.county.id===selected);
  const format=(value:number|null)=>value===null?mode==="latest"?"Not published":"No comparable figure":mode==="latest"?formatMetric(value,measure.unit,metric):formatChange(value);
  const margin=(id:number)=>{const row=rows.get(id);return mode==="latest" ? row?.latest!=null ? marginLabel(row.latest,row.latestMargin??null,measure.unit,metric) : "" : changeMarginLabel(row?.changeMargin??null,metric);};
  const dates=mode==="latest" ? [...new Set(Object.values(measure.latest.periods))].sort() : [];
  const dateLabel=mode==="latest" ? dates.length>1?`Dates vary: ${periodLabel(dates[0],metric)} – ${periodLabel(dates.at(-1)!,metric)}`:dates.length?periodLabel(dates[0],metric):"No published dates" : reading?.start&&reading.end ? windowLabel(reading.start,reading.end,metric) : "No published window";
  const select=(id:number)=>{
    setSelected(id);
    const path=svg.current?.querySelector<SVGPathElement>(`[data-county="${id}"]`);
    if(path) {
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
  return <section className="housing-atlas" aria-label="New Jersey county housing atlas" style={{"--atlas-panel-width":`${panelWidth}px`} as CSSProperties}>
    <div className="atlas-controls">
      <label>Measure<select aria-label="Measure" value={metric} onChange={e=>{const next=measures.find(m=>m.metric_id===e.target.value)!;setMetric(next.metric_id);if(mode!=="latest"&&!next.windows[mode])setMode("latest");}}>{measures.map(m=><option key={m.metric_id} value={m.metric_id}>{m.label}</option>)}</select></label>
      <label>View<select aria-label="View" value={mode} onChange={e=>setMode(e.target.value as AtlasMode)}><option value="latest">Latest figure</option>{WINDOWS.map(w=><option key={w.key} value={w.key} disabled={!measure.windows[w.key]}>{w.label} · change</option>)}</select></label>
      <span className="atlas-coverage">NJ · Counties <b>{values.length}/{counties.length} published</b></span>
    </div>
    <div className="atlas-workspace">
      <div className="atlas-map-stage">
        <svg ref={svg} className="atlas-county-map" viewBox="0 0 900 1000" tabIndex={0} role="group" aria-label="New Jersey county map. Drag to pan; arrow keys pan, plus and minus zoom. County shapes select the matching table row."
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=({ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();setViewport(v=>({...v,x:v.x+delta[0],y:v.y+delta[1]}));}else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}else if(e.key==="-"){e.preventDefault();zoom(.8);}}}
          onPointerDown={e=>{if(e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:viewport};moved.current=false;}}
          onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(moved.current){const pixels=Math.min(rect.width/900,rect.height/1000);setViewport({...d.start,x:d.start.x+dx/pixels,y:d.start.y+dy/pixels});}}}
          onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{drag.current=null;moved.current=true;}}>
          <defs><pattern id="atlas-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#839096"/><path d="M0 8L8 0" stroke="#cbd4d7" strokeWidth="2"/></pattern><filter id="atlas-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter></defs>
          <rect className="atlas-ocean" width="900" height="1000"/><rect width="900" height="1000" filter="url(#atlas-grain)" opacity=".035" pointerEvents="none"/>
          <g className="atlas-map-geography" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
            {shapes.map(shape=>{const id=Number(shape.id), county=counties.find(c=>c.id===id), value=atlasValue(rows.get(id),mode);return county?<path key={id} data-county={id} data-selected={selected===id} d={shape.base} fill={atlasColor(value,values)} tabIndex={0} role="button" aria-label={`${county.name}: ${format(value)}. Select county`} aria-pressed={selected===id} onClick={()=>{if(!moved.current)select(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(id);}}}><title>{county.name} · {format(value)}</title></path>:null;})}
          </g>
        </svg>
        {!geometry.length&&<p className="atlas-map-status" role="status">{failed?"Map unavailable. All county figures remain in the table.":"Drawing New Jersey…"}</p>}
        <div className="atlas-map-buttons" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>setViewport({scale:1,x:0,y:0})}>Reset</button></div>
        <div className="atlas-legend"><span>{format(values.length?Math.min(...values):null)}</span><div role="img" aria-label="Color scale: lower to higher county figures">{ATLAS_COLORS.map(color=><i key={color} style={{background:color}}/>)}</div><span>{format(values.length?Math.max(...values):null)}</span><small><i className="atlas-missing-key"/> Unavailable for this view · darker means higher, not better</small></div>
        <small className="atlas-map-credit">County boundaries: Census TIGER/Line · area figures, not individual homes</small>
      </div>
      <div className="atlas-panel-resizer" role="separator" tabIndex={0} aria-label="Resize comparison panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={panelWidth}
        onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setPanelWidth(w=>Math.max(320,Math.min(560,w+(e.key==="ArrowLeft"?20:-20))));}}}
        onPointerDown={e=>{resizing.current={x:e.clientX,width:panelWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(resizing.current)setPanelWidth(Math.max(320,Math.min(560,resizing.current.width+resizing.current.x-e.clientX)));}}
        onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} />
      <aside className="atlas-results" aria-label="County results" data-expanded={expanded}>
        <div className="atlas-results-head"><h2>Compare counties</h2><button className="atlas-sheet-toggle" type="button" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}>{expanded?"Close table":"Show table"}</button></div>
        <div className="atlas-selected" aria-live="polite">{choice?<><h3>{choice.county.name}</h3><strong>{format(choice.value)}</strong><small>{margin(choice.county.id)}{mode==="latest"&&measure.latest.periods[choice.county.id]?` · ${periodLabel(measure.latest.periods[choice.county.id],metric)}`:""}</small><Link className="destination-county" href={regionPath(choice.county.id)}>Open place page →</Link></>:<p>Select a county on the map or in the table.</p>}</div>
        <div className="atlas-reading"><b>{measure.label}</b><span>{mode==="latest"?"Latest figure":"Percentage change"} · {dateLabel}</span></div>
        <div className="atlas-table-wrap" ref={table} id="atlas-table" tabIndex={0} role="region" aria-label="County comparison table, scroll for all counties"><table><thead><tr><th scope="col">County</th><th scope="col"><button type="button" onClick={()=>setDescending(!descending)} aria-label={`Sort figures ${descending?"low to high":"high to low"}`}>Figure {descending?"↓":"↑"}</button></th></tr></thead><tbody>{ordered.map(({county,value})=><tr key={county.id} data-county-row={county.id} data-selected={selected===county.id}><th scope="row"><button type="button" aria-label={`Select ${county.name}`} aria-pressed={selected===county.id} onClick={()=>select(county.id)}>{county.name.replace(/ County$/,"")}</button></th><td>{format(value)}{margin(county.id)&&<small>{margin(county.id)}</small>}{mode==="latest"&&dates.length>1&&<small>{measure.latest.periods[county.id]?periodLabel(measure.latest.periods[county.id],metric):""}</small>}</td></tr>)}</tbody></table></div>
        <details className="atlas-notes"><summary>About this measure & sources</summary><p>{measure.definition}</p>{measure.sourceUrl?<a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source} ↗</a>:<p>{measure.source}</p>}<p>{MARGIN_NOTE}</p>{mode!=="latest"&&windowNote(mode,metric,measure.windows).map(note=><p key={note}>{note}</p>)}<p>Shading uses a linear scale from the lowest to highest published county figure. The scale changes with the measure and window. Missing values are hatched; unavailable periods are disabled. A county figure does not describe every neighborhood or property.</p></details>
      </aside>
    </div>
  </section>;
}
