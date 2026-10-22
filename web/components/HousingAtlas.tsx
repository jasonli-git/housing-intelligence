"use client";

import { Glossed } from "@/components/Glossed";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { fit, scene, view } from "@/lib/globe";
import { WORLD_LAND } from "@/lib/worldLand";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { atlasColor, atlasQuintileColor, atlasReading, coarserLayer, LAYER_ZOOM, layerForZoom, MAX_ZOOM, quintileBreaks, atlasValue, ATLAS_COLORS, ATLAS_LEVELS, compareHref, loadAtlasMeasure, type AtlasCounty, type AtlasEntry, type AtlasLevel, type AtlasMeasure, type AtlasMode } from "@/lib/housingAtlas";
import { GROUPS } from "@/lib/groups";
import { MAX_PLACES } from "@/lib/compare";
import { formatChange, formatMetric } from "@/lib/format";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";
import { periodLabel, windowLabel } from "@/lib/periods";
import { WINDOWS, windowNote } from "@/lib/windows";
import { regionPath } from "@/lib/placeRoutes";
import { useAtlasCamera } from "./useAtlasCamera";

const FRIENDLY:Record<string,string> = {zhvi_sfr:"Typical home price",zori_all:"Typical asking rent",acs_median_hh_income:"Household income",acs_renter_cost_burden:"Renters under housing-cost pressure",pep_population:"Population"};

type Level = "states" | AtlasLevel;
const isLevel=(value:string|null):value is Level=>value==="states"||ATLAS_LEVELS.some(l=>l.key===value);

export function HousingAtlas({entries,artifactUrl,counties,stateMeasures,states}:{entries:AtlasEntry[];artifactUrl:string;counties:AtlasCounty[];stateMeasures:AtlasMeasure[];states:(AtlasCounty&{code:string})[]}) {
  // The United States, then New Jersey's counties: the whole-globe view was removed
  // 2026-10-20 (#398), since every figure is in the United States, and the map stopped
  // turning as a globe (#398) — both levels are one fitted frame, panned and zoomed flat,
  // as the home page's map is.
  const [level,setLevel]=useState<Level>("states");
  const [stateGeometry,setStateGeometry]=useState<PackedOutline[]>([]);
  const [metric,setMetric]=useState(stateMeasures.find(m=>m.metric_id==="zhvi_sfr")?.metric_id??stateMeasures[0].metric_id);
  const [mode,setMode]=useState<AtlasMode>("latest");
  const [selected,setSelected]=useState<number|null>(null);
  // Places chosen for the compare page, which compares up to four on every measure: the
  // atlas's own two-place difference was retired for it (Director Note "Visualizing the
  // data", 2026-10-22).
  const [picks,setPicks]=useState<number[]>([]);
  const [outlinesByLevel,setOutlinesByLevel]=useState<Partial<Record<AtlasLevel,PackedOutline[]>>>({});
  const [loaded,setLoaded]=useState<Record<string,AtlasMeasure|"loading"|"failed">>({});
  const [failed,setFailed]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [descending,setDescending]=useState(true);
  const [viewport,setRawViewport]=useState({scale:1,x:0,y:0});
  // The SVG takes the stage's own shape, 1000 units tall, and the map is fitted to the
  // open area inside it — below the controls and left of the comparison panel on a wide
  // screen, the whole stage on a phone — so it is drawn as large as it can be seen (#399).
  // Until the stage is measured, the old 900×1000 frame.
  const [frame,setFrame]=useState({width:900,height:1000,box:{x:0,y:0,w:900,h:1000}});
  const frameRef=useRef(frame.box);
  frameRef.current=frame.box;
  // The drawn map's extent in the open area, before zoom (#398). A dimension the map
  // fits in stays centred; one it overflows can be panned only until an edge reaches the
  // area's, so the map cannot be dragged away from view.
  const extent=useRef<[number,number,number,number]|null>(null);
  const bounded=useCallback((v:{scale:number;x:number;y:number})=>{
    const scale=Math.max(.8,Math.min(MAX_ZOOM,v.scale)), e=extent.current, box=frameRef.current;
    if(!e)return {...v,scale};
    const place=(lo:number,hi:number,offset:number,size:number)=>{const a=scale*lo,b=scale*hi;return b-a<=size?(size-a-b)/2:Math.min(-a,Math.max(size-b,offset));};
    return {scale,x:place(e[0],e[2],v.x,box.w),y:place(e[1],e[3],v.y,box.h)};
  },[]);
  const setViewport=useCallback((next:{scale:number;x:number;y:number}|((current:{scale:number;x:number;y:number})=>{scale:number;x:number;y:number}))=>setRawViewport(current=>bounded(typeof next==="function"?next(current):next)),[bounded]);
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
      const nextLevel:Level=isLevel(next)?next:"states";
      const ids=nextLevel==="states"?stateMeasures.map(m=>m.metric_id):entries.filter(e=>e.levels.includes(nextLevel)).map(e=>e.metric_id);
      const requestedMeasure=params.get("measure");
      const picked=requestedMeasure&&ids.includes(requestedMeasure)?requestedMeasure:ids.includes("zhvi_sfr")?"zhvi_sfr":ids[0];
      const requested=params.get("view") as AtlasMode;
      setLevel(nextLevel);setMetric(picked);setMode(requested&&WINDOWS.some(w=>w.key===requested)?requested:"latest");
      const id=Number(params.get("place"));
      setSelected(params.has("place")&&Number.isFinite(id)?id:null);
      setPicks((params.get("compare")??"").split(",").map(Number).filter(n=>Number.isInteger(n)&&n>0).slice(0,MAX_PLACES));
      const scale=Number(params.get("zoom")),x=Number(params.get("x")),y=Number(params.get("y"));
      // A zoom outside the layer's band would switch layers on arrival: start inside it.
      const zoomed=params.has("zoom")&&Number.isFinite(scale)?Math.max(.8,Math.min(MAX_ZOOM,scale)):LAYER_ZOOM[nextLevel];
      const fits=layerForZoom(nextLevel,zoomed)===nextLevel;
      setViewport({scale:fits?zoomed:LAYER_ZOOM[nextLevel],x:fits&&Number.isFinite(x)?x:0,y:fits&&Number.isFinite(y)?y:0});
      setRestored(true);
    };
    restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[entries,stateMeasures]);
  useEffect(()=>{
    if(!restored)return;
    const timer=window.setTimeout(()=>{
      const url=new URL(window.location.href);
      const params=url.searchParams;
      params.set("level",level);params.set("measure",metric);params.set("view",mode);
      if(selected!==null)params.set("place",String(selected));else params.delete("place");
      if(picks.length)params.set("compare",picks.join(","));else params.delete("compare");
      params.delete("pin");params.delete("lon");params.delete("lat");params.set("zoom",String(viewport.scale));params.set("x",String(viewport.x));params.set("y",String(viewport.y));
      window.history.replaceState(null,"",url);
    },150);
    return()=>window.clearTimeout(timer);
  },[restored,level,metric,mode,selected,picks,viewport]);
  const resizing=useRef<{x:number;width:number}|null>(null);
  const svg=useRef<SVGSVGElement>(null);
  const table=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;x:number;y:number;start:typeof viewport}|null>(null);
  const moved=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/states.json",{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((file:{outlines:PackedOutline[]})=>setStateGeometry(file.outlines)).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!restored||level==="states"||outlinesByLevel[level]?.length)return;
    const controller=new AbortController();
    setFailed(false);
    const file=ATLAS_LEVELS.find(l=>l.key===level)!.outlines;
    fetch(file,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((body:{outlines:PackedOutline[]})=>{if(!body.outlines.length)throw new Error();setOutlinesByLevel(current=>({...current,[level]:body.outlines}));}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[restored,level,outlinesByLevel]);
  // A New Jersey measure's figures, read when it is first chosen at a level.
  useEffect(()=>{
    if(!restored||level==="states")return;
    const key=`${level}/${metric}`, entry=entries.find(e=>e.metric_id===metric);
    if(!entry||loaded[key])return;
    setLoaded(current=>({...current,[key]:"loading"}));
    loadAtlasMeasure(artifactUrl,entry,level,WINDOWS.map(w=>w.key)).then(m=>setLoaded(current=>({...current,[key]:m}))).catch(()=>setLoaded(current=>({...current,[key]:"failed"})));
  },[restored,level,metric,entries,loaded,artifactUrl]);
  const stateOutlinesAll=useMemo(()=>unpack(stateGeometry),[stateGeometry]);
  // The lower 48, as the home page frames them: Alaska, Hawaii and Puerto Rico stay in the
  // table but would shrink the frame to a sliver.
  const contiguous=useMemo(()=>stateOutlinesAll.filter(o=>!["AK","HI","PR"].includes(String(o.id))),[stateOutlinesAll]);
  const {box}=frame;
  const statesFrame=useMemo(()=>contiguous.length?fit(contiguous,{width:box.w,height:box.h,padding:.94}):{lon:-96,lat:38,scale:1150},[contiguous,box.w,box.h]);
  // New Jersey's counties keep their hand-set centre, scaled from the 900×1000 frame.
  const countyScale=19000*Math.min(box.w/900,box.h/1000);
  const nj=level!=="states";
  const targetCamera=useMemo(()=>({lon:nj?-74.65:statesFrame.lon,lat:nj?40.15:statesFrame.lat,scale:nj?countyScale:statesFrame.scale,zoom:viewport.scale,x:viewport.x,y:viewport.y}),[level,statesFrame,countyScale,viewport]);
  const camera=useAtlasCamera(targetCamera,dragging||!restored);
  // The projection only: pan and zoom are the group's transform, so the outlines are not
  // re-projected on every frame of a pan.
  const perspective=useMemo(()=>view({lon:camera.lon,lat:camera.lat,scale:camera.scale,width:box.w,height:box.h}),[camera.lon,camera.lat,camera.scale,box.w,box.h]);
  const levelGeometry=level==="states"?null:outlinesByLevel[level]??null;
  const njOutlines=useMemo(()=>unpack(levelGeometry??[]),[levelGeometry]);
  const stateOutlines=contiguous;
  const shapes=useMemo(()=>scene(perspective,nj?njOutlines:stateOutlines,()=>0),[perspective,nj,njOutlines,stateOutlines]);
  // The extent the pan is held to: every point of the outlines as they will sit when the
  // camera arrives, not as it draws them mid-flight. Measured from the moving camera, the
  // bound moved the target and the target moved the camera, and New Jersey's 564 small
  // town outlines kept that loop from settling (2026-10-22).
  const restingShapes=useMemo(()=>scene(view({lon:targetCamera.lon,lat:targetCamera.lat,scale:targetCamera.scale,width:box.w,height:box.h}),nj?njOutlines:stateOutlines,()=>0),[targetCamera.lon,targetCamera.lat,targetCamera.scale,box.w,box.h,nj,njOutlines,stateOutlines]);
  useEffect(()=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const shape of restingShapes){const n=shape.base.match(/-?\d+(?:\.\d+)?/g)??[];for(let i=0;i+1<n.length;i+=2){const x=Number(n[i]),y=Number(n[i+1]);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
    extent.current=Number.isFinite(minX)?[minX,minY,maxX,maxY]:null;
    // The same object when nothing moved, or the camera would retarget and redraw forever.
    setRawViewport(current=>{const next=bounded(current);return next.scale===current.scale&&next.x===current.x&&next.y===current.y?current:next;});
  },[restingShapes,bounded]);
  const stage=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=stage.current;
    if(!element||typeof ResizeObserver==="undefined")return;
    const atlas=element.closest(".housing-atlas");
    const measure=()=>{
      const area=(svg.current??element).getBoundingClientRect();
      if(!area.width||!area.height)return;
      const unit=1000/area.height, width=Math.round(area.width*unit);
      let left=0,top=0,right=area.width,bottom=area.height;
      // Wide screens float the controls over the map's top left, the legend along its
      // bottom and the comparison down its right; phones stack them outside it.
      if(window.matchMedia("(min-width: 901px)").matches){
        const controls=atlas?.querySelector(".atlas-controls")?.getBoundingClientRect();
        const results=atlas?.querySelector(".atlas-results")?.getBoundingClientRect();
        if(controls)top=controls.bottom-area.top;
        const legend=atlas?.querySelector(".atlas-legend")?.getBoundingClientRect();
        if(results)right=results.left-area.left;
        left=16;bottom=legend?legend.top-area.top-8:bottom-24;
      }
      const next={x:left*unit,y:top*unit,w:Math.max(200,(right-left)*unit),h:Math.max(200,(bottom-top)*unit)};
      setFrame(current=>current.width===width&&Math.abs(current.box.x-next.x)<1&&Math.abs(current.box.y-next.y)<1&&Math.abs(current.box.w-next.w)<1&&Math.abs(current.box.h-next.h)<1?current:{width,height:1000,box:next});
    };
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    if(svg.current)observer.observe(svg.current);
    for(const panel of atlas?.querySelectorAll(".atlas-controls, .atlas-results, .atlas-legend")??[])observer.observe(panel);
    measure();
    return()=>observer.disconnect();
  },[]);
  // The low-resolution world silhouette is useful at globe scale, not parcel-close zoom.
  const land=useMemo(()=>nj?[]:scene(perspective,WORLD_LAND,()=>0),[perspective,nj]);
  const levelInfo=ATLAS_LEVELS.find(l=>l.key===level);
  const destinations:AtlasCounty[]=level==="county"?counties:nj?(levelGeometry??[]).map(o=>({id:Number(o.id),name:level==="municipality"?(o.label??o.name):`ZIP ${o.name}`})):stateGeometry.length?stateGeometry.map((outline,index)=>({id:states.find(s=>s.code===outline.id)?.id??-(index+1),name:outline.name,code:String(outline.id)})):states;
  const levelEntries=nj?entries.filter(e=>e.levels.includes(level as AtlasLevel)):[];
  const loadedMeasure=nj?loaded[`${level}/${metric}`]:undefined;
  const entry=levelEntries.find(e=>e.metric_id===metric)??levelEntries[0];
  const pending:AtlasMeasure|null=entry?{metric_id:entry.metric_id,label:entry.label,unit:entry.unit,direction:entry.direction,definition:entry.definition,source:entry.source,sourceUrl:entry.sourceUrl,windows:{},latest:{start:null,end:entry.lastPeriod[level as AtlasLevel]??null,periods:{},rows:[]}}:null;
  const measure:AtlasMeasure=nj?(typeof loadedMeasure==="object"?loadedMeasure:pending!):stateMeasures.find(m=>m.metric_id===metric)??stateMeasures[0];
  const measureStatus=nj&&typeof loadedMeasure!=="object"?(loadedMeasure==="failed"?"This measure’s figures could not be loaded.":"Loading figures…"):"";
  const chooseMeasure=(next:string)=>{setMetric(next);setMoreMeasures(false);measureLauncher.current?.focus();};
  const togglePick=(id:number)=>setPicks(current=>current.includes(id)?current.filter(p=>p!==id):current.length>=MAX_PLACES?current:[...current,id]);
  const reading=atlasReading(measure,mode);
  const rows=new Map(reading?.rows.map(row=>[row.id,row]));
  const figures=destinations.map(county=>({county,row:rows.get(county.id),value:atlasValue(rows.get(county.id),mode)}));
  const values=figures.flatMap(f=>f.value===null?[]:[f.value]);
  const legendColors=values.length&&values.every(value=>value===values[0])?[ATLAS_COLORS[2]]:ATLAS_COLORS;
  // Towns and ZIP codes are shaded by fifths; counties and states keep the linear scale.
  const byFifths=level==="municipality"||level==="zip";
  const breaks=useMemo(()=>byFifths?quintileBreaks(values):[],[byFifths,values]);
  const fill=(value:number|null)=>byFifths?atlasQuintileColor(value,breaks):atlasColor(value,values);
  const ordered=[...figures].sort((a,b)=>a.value===null ? b.value===null?a.county.name.localeCompare(b.county.name):1 : b.value===null ? -1 : (descending ? b.value-a.value : a.value-b.value)||a.county.name.localeCompare(b.county.name));
  const visibleRows=ordered.filter(f=>!nj||f.county.name.toLowerCase().includes(countySearch.trim().toLowerCase()));
  const shading=mode!=="latest"?"Darker = a larger percentage change.":({zhvi_sfr:"Darker = higher typical home prices.",zori_all:"Darker = higher typical asking rents.",acs_median_hh_income:"Darker = higher household incomes.",acs_renter_cost_burden:"Darker = more renters spending over 30% of income on housing.",pep_population:"Darker = more residents.",acs_median_gross_rent:"Darker = higher surveyed rents, including utilities.",acs_median_home_value:"Darker = higher surveyed home values.",permits_total_units:"Darker = more homes permitted—not completed."} as Record<string,string>)[measure.metric_id]??"Darker = a higher figure.";
  const choice=figures.find(f=>f.county.id===selected);
  const outlineOnly=Boolean(choice&&choice.county.id<0);
  const pickedPlaces=picks.map(id=>({id,name:destinations.find(d=>d.id===id)?.name??`Place ${id}`}));
  const format=(value:number|null)=>value===null?mode==="latest"?"Not published":"No comparable figure":mode==="latest"?formatMetric(value,measure.unit,metric):formatChange(value);
  const margin=(id:number)=>{const row=rows.get(id);return mode==="latest" ? row?.latest!=null ? marginLabel(row.latest,row.latestMargin??null,measure.unit,metric) : "" : changeMarginLabel(row?.changeMargin??null,metric);};
  const dates=mode==="latest" ? [...new Set(Object.values(measure.latest.periods))].sort() : [];
  const dateLabel=mode==="latest" ? dates.length>1?`Dates vary: ${periodLabel(dates[0],metric)} – ${periodLabel(dates.at(-1)!,metric)}`:dates.length?periodLabel(dates[0],metric):"No published dates" : reading?.start&&reading.end ? windowLabel(reading.start,reading.end,metric) : "No published window";
  const select=(id:number)=>{
    setSelected(id);
    const path=svg.current?.querySelector<SVGPathElement>(`[data-county="${id}"]`);
    if(path) {
      const box=path.getBBox();
      setViewport(current=>{const scale=level==="county"?Math.max(current.scale,1.35):nj?Math.max(current.scale,2.4):Math.min(6,Math.max(1.35,Math.min(420/box.width,420/box.height)));return {scale,x:frameRef.current.w/2-(box.x+box.width/2)*scale,y:frameRef.current.h/2-(box.y+box.height/2)*scale};});
    }
    const row=table.current?.querySelector<HTMLElement>(`[data-county-row="${id}"]`);
    if(row&&table.current) {
      const panel=table.current.getBoundingClientRect(), rect=row.getBoundingClientRect();
      if(rect.top<panel.top+45) table.current.scrollTop-=panel.top+45-rect.top;
      else if(rect.bottom>panel.bottom) table.current.scrollTop+=rect.bottom-panel.bottom;
    }
  };
  const zoom=(factor:number)=>setViewport(current=>{
    const scale=Math.min(MAX_ZOOM,Math.max(.8,current.scale*factor)), ratio=scale/current.scale;
    const cx=frameRef.current.w/2, cy=frameRef.current.h/2;
    return {scale,x:cx-(cx-current.x)*ratio,y:cy-(cy-current.y)*ratio};
  });
  // On phones the catalogue hangs from the controls, whose place on the page varies with
  // the title above them: it is held to the room left below it, so it never runs off the
  // bottom of the screen. Wide screens keep the stylesheet's height.
  const fitPicker=useCallback((node:HTMLDivElement|null)=>{
    if(!node||!window.matchMedia("(max-width: 900px)").matches)return;
    node.style.maxHeight=`${Math.max(240,window.innerHeight-node.getBoundingClientRect().top-12)}px`;
  },[]);
  // A layer entered by a control, not by zooming: shown at the middle of its zoom band.
  const centredAt=(scale:number)=>{const cx=frameRef.current.w/2,cy=frameRef.current.h/2;return {scale,x:cx-cx*scale,y:cy-cy*scale};};
  const changeLevel=(next:Level)=>{setLevel(next);setSelected(null);setViewport(next==="states"||next==="county"?{scale:1,x:0,y:0}:centredAt(LAYER_ZOOM[next]));const ids=next==="states"?stateMeasures.map(m=>m.metric_id):entries.filter(e=>e.levels.includes(next)).map(e=>e.metric_id);if(!ids.includes(metric))setMetric(ids.includes("zhvi_sfr")?"zhvi_sfr":ids[0]);if(next!==level&&(next==="states"||level==="states"))setPicks([]);};
  // Zooming far enough in or out moves one layer finer or coarser. Between New Jersey's
  // layers the view stays where it is; to and from the United States it is reframed.
  useEffect(()=>{
    if(!restored)return;
    const next=layerForZoom(level,viewport.scale);
    if(next===level)return;
    if(next==="states"||level==="states"){changeLevel(next);return;}
    setLevel(next);setSelected(null);setCountySearch("");
    const ids=entries.filter(e=>e.levels.includes(next)).map(e=>e.metric_id);
    if(!ids.includes(metric))setMetric(ids.includes("zhvi_sfr")?"zhvi_sfr":ids[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[viewport.scale,restored]);
  // A window the chosen measure does not have is not offered, so fall back to the latest.
  useEffect(()=>{if(!measureStatus&&mode!=="latest"&&!measure.windows[mode])setMode("latest");},[measureStatus,mode,measure]);
  const outward=coarserLayer(level);
  const layerNames:Record<Level,string>={states:"the United States",county:"New Jersey’s counties",municipality:"New Jersey’s towns",zip:"New Jersey’s ZIP codes"};
  const finerHint:Record<Level,string|null>={states:"Zoom in on New Jersey for its counties",county:"Zoom in for towns",municipality:"Zoom in for ZIP codes",zip:null};
  return <section className="housing-atlas" aria-label="Housing atlas map and comparison" data-level={level} style={{"--atlas-panel-width":`${panelWidth}px`,"--atlas-sheet-height":`${sheetHeight}px`} as CSSProperties}>
    <div className="atlas-controls" ref={controls}>
      <div className="atlas-layer-row"><span className="atlas-layer-name">Showing {layerNames[level]}{finerHint[level]?<small> · {finerHint[level]}</small>:null}</span>{outward&&<button type="button" className="atlas-exit" onClick={()=>{setCountySearch("");changeLevel(outward);}}><span aria-hidden="true">←</span> Out to {outward==="states"?"the United States":outward==="county"?"counties":"towns"}</button>}</div>
      <div className="atlas-filter-row"><label className="atlas-measure-field"><span>Measure</span><div className="atlas-measure-control"><select aria-label="Measure" value={measure.metric_id} onChange={e=>setMetric(e.target.value)}>{nj?GROUPS.map(g=>{const inGroup=levelEntries.filter(e=>e.group===g.title);return inGroup.length?<optgroup key={g.key} label={g.title}>{inGroup.map(e=><option key={e.metric_id} value={e.metric_id}>{FRIENDLY[e.metric_id]??e.label}</option>)}</optgroup>:null;}):stateMeasures.filter(m=>m.latest.rows.length>0||Object.keys(m.windows).length>0).map(m=><option key={m.metric_id} value={m.metric_id}>{FRIENDLY[m.metric_id]??m.label}</option>)}</select><button ref={measureLauncher} className="atlas-catalogue-button" type="button" aria-label="Browse all measures" title="Browse all measures" aria-expanded={moreMeasures} aria-controls="atlas-measure-picker" onClick={()=>{setMoreMeasures(!moreMeasures);setMeasureSearch("");}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg><span>All</span></button></div></label>
      <label className="atlas-view-field"><span>Time</span><select aria-label="View" value={mode} onChange={e=>setMode(e.target.value as AtlasMode)}><option value="latest">Latest figure</option>{WINDOWS.filter(w=>measure.windows[w.key]||mode===w.key).map(w=><option key={w.key} value={w.key}>{w.label} · change</option>)}</select></label></div>
      {moreMeasures&&<div id="atlas-measure-picker" className="atlas-measure-picker" ref={fitPicker} role="region" aria-label="Measure catalogue">
        <header><div><small>MEASURES</small><h2>Choose a measure</h2></div><button type="button" aria-label="Close measures" onClick={()=>{setMoreMeasures(false);measureLauncher.current?.focus({preventScroll:true});}}>×</button></header>
        <label>Search measures<input ref={measureSearchInput} type="search" value={measureSearch} onChange={e=>setMeasureSearch(e.target.value)} placeholder="Rent, income, building…"/></label>
        {(()=>{
          const q=measureSearch.trim().toLowerCase();
          const pool=nj?levelEntries.map(e=>({id:e.metric_id,name:FRIENDLY[e.metric_id]??e.label,definition:e.definition,group:e.group})):stateMeasures.filter(m=>m.latest.rows.length>0||Object.keys(m.windows).length>0).map(m=>({id:m.metric_id,name:FRIENDLY[m.metric_id]??m.label,definition:m.definition,group:"State figures"}));
          const matches=pool.filter(m=>`${m.name} ${m.definition}`.toLowerCase().includes(q));
          const groups=[...GROUPS.map(g=>g.title),"State figures"];
          return matches.length?<>{groups.map((group,index)=>{const inGroup=matches.filter(m=>m.group===group);return inGroup.length?<div className="atlas-measure-group" key={group} data-category={index%3}><h3>{group} <small>{inGroup.length}</small></h3>{inGroup.map(m=><button type="button" key={m.id} aria-pressed={m.id===measure.metric_id} onClick={()=>chooseMeasure(m.id)}><b>{m.name}<span aria-hidden="true">{m.id===measure.metric_id?"✓":"↗"}</span></b><span>{m.definition}</span></button>)}</div>:null;})}</>:<p>No matching measures. Try rent, income or building.</p>;
        })()}
      </div>}
      <div className="atlas-control-footer"><span className="atlas-coverage"><i aria-hidden="true"/>{nj?`${measureStatus||`${values.length}/${destinations.length} ${levelInfo!.plural} with figures`} · ${levelEntries.length} measures`:"Figures: New Jersey · other states: outlines"}</span><button className="atlas-share-button" type="button" onClick={async()=>{try{const url=new URL(window.location.href);const params=url.searchParams;params.set("level",level);params.set("measure",metric);params.set("view",mode);if(selected!==null)params.set("place",String(selected));else params.delete("place");if(picks.length)params.set("compare",picks.join(","));else params.delete("compare");params.delete("pin");params.delete("lon");params.delete("lat");params.set("zoom",String(viewport.scale));params.set("x",String(viewport.x));params.set("y",String(viewport.y));await navigator.clipboard.writeText(url.href);setShareStatus("Link copied");}catch{setShareStatus("Copy this page’s address to share this view");}}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/></svg>Share view</button><span className="atlas-share-status" role="status">{shareStatus}</span></div>
    </div>
    <div className="atlas-workspace">
      <div ref={stage} className="atlas-map-stage">
        <svg ref={svg} className="atlas-county-map" viewBox={`0 0 ${frame.width} ${frame.height}`} tabIndex={0} role="group" aria-label={`${nj?`New Jersey ${levelInfo!.noun} map. Drag or arrow keys to pan`:"United States map. Drag or arrow keys to pan"}; plus and minus zoom. Shapes select the matching table row.`}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=({ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();setViewport(v=>({...v,x:v.x+delta[0],y:v.y+delta[1]}));}else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}else if(e.key==="-"){e.preventDefault();zoom(.8);}}}
          onPointerDown={e=>{if(e.button!==0)return;setDragging(true);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:viewport};moved.current=false;}}
          onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(moved.current){const pixels=Math.min(rect.width/frame.width,rect.height/frame.height);setViewport({...d.start,x:d.start.x+dx/pixels,y:d.start.y+dy/pixels});}}}
          onPointerUp={e=>{setDragging(false);drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{setDragging(false);drag.current=null;moved.current=true;}}>
          <defs><pattern id="atlas-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8f939c"/><path d="M0 8L8 0" stroke="#d5d8de" strokeWidth="2"/></pattern><filter id="atlas-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter></defs>
          <rect className="atlas-ocean" width={frame.width} height={frame.height}/><rect width={frame.width} height={frame.height} filter="url(#atlas-grain)" opacity=".035" pointerEvents="none"/>
          {/* Canada and Mexico sit apart from the states, so the states' lift is theirs alone. */}
          <g className="atlas-context" transform={`translate(${box.x+camera.x} ${box.y+camera.y}) scale(${camera.zoom})`} aria-hidden="true">
            {land.map(shape=><path className="atlas-context-land" key={`land-${shape.id}`} d={shape.base} pointerEvents="none"/>)}
          </g>
          <g className="atlas-map-geography" data-camera={`${camera.lon},${camera.lat},${camera.scale}`} transform={`translate(${box.x+camera.x} ${box.y+camera.y}) scale(${camera.zoom})`}>
            {shapes.map(shape=>{const county=nj?destinations.find(c=>c.id===Number(shape.id)):destinations.find(c=>c.name===shape.name), id=county?.id, value=atlasValue(id===undefined?undefined:rows.get(id),mode);return county&&id!==undefined?<path key={id} data-county={id} data-state={!nj?String(shape.id):undefined} data-selected={selected===id} data-pinned={picks.includes(id)} data-empty={!nj&&value===null} d={shape.base} fill={fill(value)} tabIndex={0} role="button" aria-label={`${county.name}: ${format(value)}. Select ${nj?levelInfo!.noun:"state"}`} aria-pressed={selected===id} onClick={()=>{if(!moved.current)select(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(id);}}}><title>{county.name} · {format(value)}</title></path>:null;})}
          </g>
        </svg>
        {!(nj?levelGeometry??[]:stateGeometry).length&&<p className="atlas-map-status" role="status">{failed?"Map unavailable. Published figures remain in the table.":"Drawing the atlas…"}</p>}
        <div className="atlas-map-buttons" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>setViewport(level==="states"||level==="county"?{scale:1,x:0,y:0}:centredAt(LAYER_ZOOM[level]))}>Reset</button></div>
        <div className="atlas-legend"><span>{format(values.length?Math.min(...values):null)}</span><div role="img" aria-label="Color scale for published area figures">{legendColors.map(color=><i key={color} style={{background:color}}/>)}</div><span>{format(values.length?Math.max(...values):null)}</span><small>{values.length===1?"Only one published area; no cross-area comparison yet":shading}</small>{byFifths&&breaks.length>0&&<small>Each shade is a fifth of {levelInfo!.plural}: {breaks.map(b=>format(b)).join(" · ")}</small>}<small><i className="atlas-missing-key"/>{nj?"No figure for this view":"Outline only: no figures yet"} · higher is not necessarily better</small></div>
        <small className="atlas-map-credit">Boundaries: Census TIGER/Line · world silhouette: Natural Earth · area figures, not individual homes</small>
      </div>
      <div className="atlas-panel-resizer" role="separator" tabIndex={0} aria-label="Resize comparison panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={panelWidth}
        onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setPanelWidth(w=>Math.max(320,Math.min(560,w+(e.key==="ArrowLeft"?20:-20))));}}}
        onPointerDown={e=>{resizing.current={x:e.clientX,width:panelWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(resizing.current)setPanelWidth(Math.max(320,Math.min(560,resizing.current.width+resizing.current.x-e.clientX)));}}
        onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} />
      <aside ref={results} className="atlas-results" aria-label="Place comparison results" data-expanded={expanded}>
        <div className="atlas-results-head"><h2>{nj?`All ${levelInfo!.plural}, ranked`:"All states, ranked"}</h2><button className="atlas-sheet-toggle" type="button" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}>{expanded?"Close table":nj?`All ${levelInfo!.plural}, ranked`:"All states, ranked"}</button></div>
        {choice&&<button className="atlas-clear-selection" type="button" onClick={()=>setSelected(null)}>Clear selection ×</button>}
{nj&&choice&&choice.county.id>0&&<button className="atlas-pin-button" type="button" aria-pressed={picks.includes(choice.county.id)} disabled={!picks.includes(choice.county.id)&&picks.length>=MAX_PLACES} onClick={()=>togglePick(choice.county.id)}>{picks.includes(choice.county.id)?"Remove from comparison":picks.length>=MAX_PLACES?`Comparison full (${MAX_PLACES})`:"Add to comparison"}</button>}
        {nj&&picks.length>0&&<div className="atlas-comparison" aria-label="Places chosen to compare"><header><b>To compare · {picks.length} of {MAX_PLACES}</b><button type="button" aria-label="Clear the comparison" onClick={()=>setPicks([])}>×</button></header><ul className="atlas-compare-chips">{pickedPlaces.map(p=><li key={p.id}><button type="button" onClick={()=>select(p.id)}>{p.name}</button><button type="button" aria-label={`Remove ${p.name}`} onClick={()=>togglePick(p.id)}>×</button></li>)}</ul><Link className="atlas-compare-go" href={compareHref(picks)}>{picks.length===1?"Open it on the compare page →":`Compare ${picks.length} places on every measure →`}</Link><small>Counties, towns and ZIP codes can be compared together.</small></div>}
        {!nj&&<p className="atlas-state-coverage">New Jersey only. Other states: outlines, not figures.</p>}
        {outlineOnly&&<p className="atlas-outline-status" role="status">Boundary only · figures not yet supported</p>}
        <div className="atlas-selected" aria-live="polite" data-active={Boolean(choice)}><div key={`${selected}-${metric}-${mode}`} className="atlas-selection-content">{choice?<><h3>{choice.county.name}</h3><strong>{format(choice.value)}</strong><small>{margin(choice.county.id)}{mode==="latest"&&measure.latest.periods[choice.county.id]?` · ${periodLabel(measure.latest.periods[choice.county.id],metric)}`:""}</small>{nj?<Link className="destination-county" href={regionPath(choice.county.id)}>Open place page →</Link>:choice.county.id===states.find(s=>s.code==="NJ")?.id?<><button type="button" className="atlas-drill" onClick={()=>changeLevel("county")}>Explore New Jersey counties →</button><Link href="/states/new-jersey">Open state page →</Link></>:<p>State and county figures are not available here yet.</p>}</>:<p>Select a {nj?levelInfo!.noun:"state"} on the map or in the table.</p>}</div></div>
        <div className="atlas-reading"><b>{FRIENDLY[measure.metric_id]??measure.label}</b><span>{measureStatus||<>{mode==="latest"?"Latest figure":"Percentage change"} · {dateLabel}</>}</span><p className="atlas-how-to-read">{measure.definition}</p></div>
        {nj&&<div className="atlas-county-finder"><label>Find a {levelInfo!.noun}<input type="search" value={countySearch} onChange={e=>setCountySearch(e.target.value)} placeholder={level==="zip"?"ZIP code":`${levelInfo!.noun[0].toUpperCase()}${levelInfo!.noun.slice(1)} name`}/></label>{countySearch&&<small role="status">{visibleRows.length} matching · map still shows all {levelInfo!.plural}</small>}</div>}
<div className="atlas-table-wrap" ref={table} id="atlas-table" tabIndex={0} role="region" aria-label={`${nj?levelInfo!.label:"States"} ranked, scroll for all places`}><table><thead><tr><th scope="col">{nj?levelInfo!.label.replace(/s$/,""):"State"}</th><th scope="col"><button type="button" onClick={()=>setDescending(!descending)} aria-label={`Sort figures ${descending?"low to high":"high to low"}`}>Figure {descending?"↓":"↑"}</button></th></tr></thead><tbody>{visibleRows.map(({county,value})=><tr key={county.id} data-county-row={county.id} data-selected={selected===county.id} data-pinned={picks.includes(county.id)}><th scope="row"><button type="button" aria-label={`Select ${county.name}`} aria-pressed={selected===county.id} onClick={()=>select(county.id)}>{county.name.replace(/ County$/,"")}</button></th><td>{format(value)}{margin(county.id)&&<small>{margin(county.id)}</small>}{mode==="latest"&&dates.length>1&&<small>{measure.latest.periods[county.id]?periodLabel(measure.latest.periods[county.id],metric):""}</small>}</td></tr>)}</tbody></table></div>
        <details className="atlas-notes"><summary>About this measure & sources</summary><p>{measure.definition}</p>{measure.sourceUrl?<a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source} ↗</a>:<p>{measure.source}</p>}<p><Glossed text={MARGIN_NOTE} /></p>{mode!=="latest"&&windowNote(mode,metric,measure.windows).map(note=><p key={note}>{note}</p>)}<p>The linear scale resets with each measure and period. Hatched areas have no figure; unavailable periods are disabled. Area figures do not describe an individual property.</p></details>
      </aside>
    </div>
  </section>;
}
