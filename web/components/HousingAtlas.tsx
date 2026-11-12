"use client";

import { Glossed } from "@/components/Glossed";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { fit, rotate, scene, screen, view } from "@/lib/globe";
import { ATLAS_CITIES, NJ_NEIGHBOURS } from "@/lib/njNeighbours";
import { WORLD_LAND } from "@/lib/worldLand";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { atlasColor, atlasQuintileColor, atlasRank, atlasReading, layerForZoom, MAX_ZOOM, quintileBreaks, atlasValue, ATLAS_COLORS, ATLAS_LEVELS, compareHref, loadAtlasMeasure, type AtlasCounty, type AtlasEntry, type AtlasLevel, type AtlasMeasure, type AtlasMode } from "@/lib/housingAtlas";
import { GROUPS } from "@/lib/groups";
import { MAX_PLACES } from "@/lib/compare";
import { formatChange, formatMetric } from "@/lib/format";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";
import { periodLabel, windowLabel } from "@/lib/periods";
import { WINDOWS, windowNote } from "@/lib/windows";
import { regionPath } from "@/lib/placeRoutes";
import { ordinal } from "@/lib/ranks";
import { useAtlasCamera } from "./useAtlasCamera";
import { AtlasPreview } from "./AtlasPreview";
import { BudgetCard, BudgetLine, useAtlasBudget, type AtlasBudgetData } from "./AtlasBudget";
import { formatValue } from "@/lib/format";
import { catalogueIds, SUGGESTED, suggestionIds, variantSetOf } from "@/lib/atlasCatalogue";

const FRIENDLY:Record<string,string> = {sr1a_median_sale_price:"Median home sale price",zhvi_sfr:"Typical home price",zori_all:"Typical asking rent",acs_median_hh_income:"Household income",acs_renter_cost_burden:"Renters under housing-cost pressure",pep_population:"Population"};

type Level = "states" | AtlasLevel;
const isLevel=(value:string|null):value is Level=>value==="states"||ATLAS_LEVELS.some(l=>l.key===value);
// The atlas opens on New Jersey's towns and what homes there sold for (#492; Zillow's
// estimate, the first opening measure, left 176 of 564 towns hatched): every figure is in
// New Jersey, and a first view of the United States showed 49 states with nothing to read
// (review of 2026-11-09). The country stays one click away.
const OPENING_LEVEL:AtlasLevel="municipality";
const OPENING_MEASURE="sr1a_median_sale_price";
const PANELS_KEY="atlas-panels";
// The two home values (lib/atlasCatalogue.ts VARIANTS) are never mixed on one map; a town
// Zillow leaves out shows the Census figure in its card instead, labelled as the survey's.
const FALLBACK_OF:Record<string,string>={zhvi_sfr:"acs_median_home_value"};

export function HousingAtlas({bar,entries,artifactUrl,counties,stateMeasures,states,budgetData}:{budgetData?:AtlasBudgetData;bar?:ReactNode;entries:AtlasEntry[];artifactUrl:string;counties:AtlasCounty[];stateMeasures:AtlasMeasure[];states:(AtlasCounty&{code:string})[]}) {
  // The United States, then New Jersey's counties: the whole-globe view was removed
  // 2026-10-20 (#398), since every figure is in the United States, and the map stopped
  // turning as a globe (#398) — both levels are one fitted frame, panned and zoomed flat,
  // as the home page's map is.
  const [level,setLevel]=useState<Level>(OPENING_LEVEL);
  // The New Jersey layer last shown, which zooming in on the state reopens.
  const [stateLayer,setStateLayer]=useState<AtlasLevel>(OPENING_LEVEL);
  const [stateGeometry,setStateGeometry]=useState<PackedOutline[]>([]);
  const [metric,setMetric]=useState(entries.find(e=>e.metric_id===OPENING_MEASURE&&e.levels.includes(OPENING_LEVEL))?.metric_id??entries.find(e=>e.levels.includes(OPENING_LEVEL))?.metric_id??stateMeasures[0].metric_id);
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
  // (#496) the Budget explorer as a filter on the map (components/AtlasBudget.tsx).
  const budget=useAtlasBudget(budgetData,level,metric);
  const [sortBy,setSortBy]=useState<"figure"|"cost">("figure");
  const [budgetOpen,setBudgetOpen]=useState(false);
  // On a phone the card starts as its one-line summary, so the map stays in view.
  useEffect(()=>{if(budget.on&&!window.matchMedia("(max-width: 900px)").matches)setBudgetOpen(true);},[budget.on]);
  // The budget card sits under the controls card, so it follows that card's height.
  const [controlsHeight,setControlsHeight]=useState(0);
  // Put away, the controls leave a chip in their place; the budget card sits under that instead.
  const [chipHeight,setChipHeight]=useState(0);
  // Watched rather than read once: the chip is hidden at phone width and appears when the
  // window widens, without the controls changing state.
  const chipRef=useMemo(()=>{let ro:ResizeObserver|null=null;return(el:HTMLElement|null)=>{ro?.disconnect();ro=null;if(!el){setChipHeight(0);return;}ro=new ResizeObserver(()=>setChipHeight(el.offsetHeight));ro.observe(el);};},[]);
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
  // The catalogue's tiles carry only a name; the one pointed at or focused is defined in
  // a line above them, at a size that can be read (owner, 2026-11-09).
  const [aboutMeasure,setAboutMeasure]=useState<{name:string;definition:string}|null>(null);
  // Search waits behind a magnifier (owner, 2026-11-09): the catalogue is for browsing.
  const [searchOpen,setSearchOpen]=useState(false);
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
  // Which cards float over the map (owner, 2026-11-09): each can be put away to a chip,
  // and "map only" puts away everything, the bar included, so the map has the whole
  // screen. Kept per reader in this browser; a phone starts with the controls put away.
  const [panels,setPanels]=useState({controls:true,results:true});
  const [mapOnly,setMapOnly]=useState(false);
  const [panelsRead,setPanelsRead]=useState(false);
  useEffect(()=>{
    let stored:{controls?:unknown;results?:unknown;mapOnly?:unknown}|null=null;
    try{stored=JSON.parse(window.localStorage.getItem(PANELS_KEY)??"null");}catch{stored=null;}
    if(stored&&typeof stored==="object"){
      setPanels({controls:stored.controls!==false,results:stored.results!==false});
      setMapOnly(stored.mapOnly===true);
    }else if(window.matchMedia("(max-width: 900px)").matches)setPanels(p=>({...p,controls:false}));
    setPanelsRead(true);
  },[]);
  useEffect(()=>{
    if(!panelsRead)return;
    try{window.localStorage.setItem(PANELS_KEY,JSON.stringify({...panels,mapOnly}));}catch{/* private window: the choice lasts this visit */}
  },[panels,mapOnly,panelsRead]);
  const [dragging,setDragging]=useState(false);
  const controls=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=controls.current;if(!el)return;const ro=new ResizeObserver(()=>setControlsHeight(el.offsetHeight));ro.observe(el);return()=>ro.disconnect();},[]);
  const measureLauncher=useRef<HTMLButtonElement>(null);
  const measureSearchInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!moreMeasures)return;
    // The catalogue takes focus, not its search: on a touch screen focusing the search
    // raised the keyboard over the catalogue it had just opened (owner, 2026-11-09). Typing
    // a letter on a keyboard opens the search with it.
    document.getElementById("atlas-measure-picker")?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMoreMeasures(false);measureLauncher.current?.focus();}};
    const outside=(event:PointerEvent)=>{if(!controls.current?.contains(event.target as Node))setMoreMeasures(false);};
    document.addEventListener("keydown",key);document.addEventListener("pointerdown",outside);
    return()=>{document.removeEventListener("keydown",key);document.removeEventListener("pointerdown",outside);};
  },[moreMeasures]);
  useEffect(()=>{
    const restore=()=>{
      const params=new URLSearchParams(window.location.search);
      const next=params.get("level");
      const nextLevel:Level=isLevel(next)?next:OPENING_LEVEL;
      const ids=nextLevel==="states"?stateMeasures.map(m=>m.metric_id):entries.filter(e=>e.levels.includes(nextLevel)).map(e=>e.metric_id);
      const requestedMeasure=params.get("measure");
      const picked=requestedMeasure&&ids.includes(requestedMeasure)?requestedMeasure:ids.includes(OPENING_MEASURE)?OPENING_MEASURE:ids[0];
      const requested=params.get("view") as AtlasMode;
      setLevel(nextLevel);setMetric(picked);setMode(requested&&WINDOWS.some(w=>w.key===requested)?requested:"latest");
      const id=Number(params.get("place"));
      setSelected(params.has("place")&&Number.isFinite(id)?id:null);
      setPicks((params.get("compare")??"").split(",").map(Number).filter(n=>Number.isInteger(n)&&n>0).slice(0,MAX_PLACES));
      const scale=Number(params.get("zoom")),x=Number(params.get("x")),y=Number(params.get("y"));
      // A zoom that would switch layers on arrival starts the view whole instead.
      const zoomed=params.has("zoom")&&Number.isFinite(scale)?Math.max(.8,Math.min(MAX_ZOOM,scale)):1;
      const fits=layerForZoom(nextLevel,zoomed,nextLevel==="states"?"county":nextLevel)===nextLevel;
      if(nextLevel!=="states")setStateLayer(nextLevel);
      setViewport({scale:fits?zoomed:1,x:fits&&Number.isFinite(x)?x:0,y:fits&&Number.isFinite(y)?y:0});
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
    // The chosen measure, and the one its card falls back to for a town it leaves out.
    for(const id of [metric,...(FALLBACK_OF[metric]?[FALLBACK_OF[metric]]:[])]){
      const key=`${level}/${id}`, entry=entries.find(e=>e.metric_id===id&&e.levels.includes(level));
      if(!entry||loaded[key])continue;
      setLoaded(current=>({...current,[key]:"loading"}));
      loadAtlasMeasure(artifactUrl,entry,level,id===metric?WINDOWS.map(w=>w.key):[]).then(m=>setLoaded(current=>({...current,[key]:m}))).catch(()=>setLoaded(current=>({...current,[key]:"failed"})));
    }
  },[restored,level,metric,entries,loaded,artifactUrl]);
  const stateOutlinesAll=useMemo(()=>unpack(stateGeometry),[stateGeometry]);
  // The lower 48, as the home page frames them: Alaska, Hawaii and Puerto Rico stay in the
  // table but would shrink the frame to a sliver.
  const contiguous=useMemo(()=>stateOutlinesAll.filter(o=>!["AK","HI","PR"].includes(String(o.id))),[stateOutlinesAll]);
  const {box}=frame;
  const statesFrame=useMemo(()=>contiguous.length?fit(contiguous,{width:box.w,height:box.h,padding:.94}):{lon:-96,lat:38,scale:1150},[contiguous,box.w,box.h]);
  // New Jersey's counties keep their hand-set centre, scaled from the 900×1000 frame.
  // New Jersey fills the open area, whichever layer is shown: fitted to its own outlines as
  // the nation is to the states', rather than a hand-set centre and scale that left much
  // of the frame empty (owner, 2026-10-22).
  const njSource=level==="states"?null:outlinesByLevel[level]??outlinesByLevel.county??null;
  const njFitOutlines=useMemo(()=>unpack(njSource??[]),[njSource]);
  const njFrame=useMemo(()=>njFitOutlines.length?fit(njFitOutlines,{width:box.w,height:box.h,padding:.97}):{lon:-74.65,lat:40.15,scale:19000*Math.min(box.w/900,box.h/1000)},[njFitOutlines,box.w,box.h]);
  const nj=level!=="states";
  const targetCamera=useMemo(()=>({lon:nj?njFrame.lon:statesFrame.lon,lat:nj?njFrame.lat:statesFrame.lat,scale:nj?njFrame.scale:statesFrame.scale,zoom:viewport.scale,x:viewport.x,y:viewport.y}),[nj,statesFrame,njFrame,viewport]);
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
      // The map is the whole screen and every card floats on it (owner, 2026-11-09), so it
      // is drawn into the open area the visible cards leave. A card put away measures
      // nothing. On a wide screen New Jersey is tall and narrow, so it takes the full
      // height beside the left-hand cards (owner, 2026-10-22); the wide nation keeps the
      // strip below them. On a phone the map sits between the bar and the bottom sheet,
      // and a card opened over it for a moment does not move it.
      const shown=(selector:string)=>{const r=atlas?.querySelector(selector)?.getBoundingClientRect();return r&&r.width&&r.height?r:null;};
      const barBox=shown(".atlas-bar"), chips=shown(".atlas-controls-chip"), controlsBox=shown(".atlas-controls"), resultsBox=shown(".atlas-results"), legendBox=shown(".atlas-legend");
      const gap=12;
      const below=(...boxes:(DOMRect|null)[])=>Math.max(0,...boxes.filter((b):b is DOMRect=>b!==null).map(b=>b.bottom-area.top+gap));
      if(window.matchMedia("(min-width: 901px)").matches){
        if(resultsBox)right=resultsBox.left-area.left-gap;else right=area.width-gap;
        if(atlas?.getAttribute("data-level")!=="states"){
          // With the controls put away the state centres in the open screen; the legend
          // then sits by Delaware Bay, where the state has no land.
          const side=controlsBox?[controlsBox,legendBox].filter((b):b is DOMRect=>b!==null):[];
          left=side.length?Math.max(...side.map(b=>b.right-area.left))+gap:gap;
          top=below(barBox);bottom=area.height-gap;
        }else{
          left=gap;top=below(barBox,controlsBox,chips);bottom=legendBox?legendBox.top-area.top-gap:area.height-gap*2;
        }
      }else{
        // The zoom buttons stand in a column down the right; the map keeps clear of it.
        const buttons=shown(".atlas-map-buttons");
        left=8;right=buttons?buttons.left-area.left-6:area.width-8;
        // The chip row is held whether or not the chip shows, so opening the controls
        // over the map does not move it.
        top=barBox?below(barBox):below(chips);
        const sheet=resultsBox&&atlas?.querySelector(".atlas-results")?.getAttribute("data-expanded")!=="true"?resultsBox:null;
        const floor=[sheet,legendBox].filter((b):b is DOMRect=>b!==null).map(b=>b.top-area.top-gap);
        bottom=floor.length?Math.min(...floor):area.height-gap;
      }
      const next={x:left*unit,y:top*unit,w:Math.max(200,(right-left)*unit),h:Math.max(200,(bottom-top)*unit)};
      setFrame(current=>current.width===width&&Math.abs(current.box.x-next.x)<1&&Math.abs(current.box.y-next.y)<1&&Math.abs(current.box.w-next.w)<1&&Math.abs(current.box.h-next.h)<1?current:{width,height:1000,box:next});
    };
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    if(svg.current)observer.observe(svg.current);
    for(const panel of atlas?.querySelectorAll(".atlas-bar, .atlas-controls-chip, .atlas-controls, .atlas-results, .atlas-legend")??[])observer.observe(panel);
    measure();
    return()=>observer.disconnect();
  },[level,panels,mapOnly,expanded]);
  // The low-resolution world silhouette is useful at globe scale, not parcel-close zoom.
  // Behind New Jersey, its neighbours' land, so the state sits on water; behind the
  // nation, the world's (owner, 2026-11-09).
  const land=useMemo(()=>scene(perspective,nj?NJ_NEIGHBOURS:WORLD_LAND,()=>0),[perspective,nj]);
  const cities=useMemo(()=>nj?ATLAS_CITIES.map(c=>({...c,xy:screen(perspective,rotate(perspective.camera,c.at))})):[],[perspective,nj]);
  const levelInfo=ATLAS_LEVELS.find(l=>l.key===level);
  // Everything below that depends only on the data is held between renders: a pan or a
  // zoom changes the map's transform and nothing else, and rebuilding 564 outlines and 564
  // table rows on every frame of one is what made the atlas lag (2026-11-09).
  const destinations=useMemo<AtlasCounty[]>(()=>level==="county"?counties:nj?(levelGeometry??[]).map(o=>({id:Number(o.id),name:level==="municipality"?(o.label??o.name):`ZIP ${o.name}`})):stateGeometry.length?stateGeometry.map((outline,index)=>({id:states.find(s=>s.code===outline.id)?.id??-(index+1),name:outline.name,code:String(outline.id)})):states,[level,counties,nj,levelGeometry,stateGeometry,states]);
  const destinationById=useMemo(()=>new Map(destinations.map(d=>[d.id,d])),[destinations]);
  const destinationByName=useMemo(()=>new Map(destinations.map(d=>[d.name,d])),[destinations]);
  const levelEntries=nj?entries.filter(e=>e.levels.includes(level as AtlasLevel)):[];
  const loadedMeasure=nj?loaded[`${level}/${metric}`]:undefined;
  const entry=levelEntries.find(e=>e.metric_id===metric)??levelEntries[0];
  const pending:AtlasMeasure|null=entry?{metric_id:entry.metric_id,label:entry.label,unit:entry.unit,direction:entry.direction,definition:entry.definition,source:entry.source,sourceUrl:entry.sourceUrl,windows:{},latest:{start:null,end:entry.lastPeriod[level as AtlasLevel]??null,periods:{},rows:[]}}:null;
  const measure:AtlasMeasure=nj?(typeof loadedMeasure==="object"?loadedMeasure:pending!):stateMeasures.find(m=>m.metric_id===metric)??stateMeasures[0];
  const measureStatus=nj&&typeof loadedMeasure!=="object"?(loadedMeasure==="failed"?"This measure’s figures could not be loaded.":"Loading figures…"):"";
  const chooseMeasure=(next:string)=>{setMetric(next);setMoreMeasures(false);measureLauncher.current?.focus();};
  const togglePick=(id:number)=>setPicks(current=>current.includes(id)?current.filter(p=>p!==id):current.length>=MAX_PLACES?current:[...current,id]);
  const reading=atlasReading(measure,mode);
  const rows=useMemo(()=>new Map(reading?.rows.map(row=>[row.id,row])),[reading]);
  const figures=useMemo(()=>destinations.map(county=>({county,row:rows.get(county.id),value:atlasValue(rows.get(county.id),mode)})),[destinations,rows,mode]);
  const values=useMemo(()=>figures.flatMap(f=>f.value===null?[]:[f.value]),[figures]);
  const legendColors=values.length&&values.every(value=>value===values[0])?[ATLAS_COLORS[2]]:ATLAS_COLORS;
  // Towns and ZIP codes are shaded by fifths; counties and states keep the linear scale.
  const byFifths=level==="municipality"||level==="zip";
  const breaks=useMemo(()=>byFifths?quintileBreaks(values):[],[byFifths,values]);
  const fill=(value:number|null)=>byFifths?atlasQuintileColor(value,breaks):atlasColor(value,values);
  const ordered=useMemo(()=>[...figures].sort((a,b)=>a.value===null ? b.value===null?a.county.name.localeCompare(b.county.name):1 : b.value===null ? -1 : (descending ? b.value-a.value : a.value-b.value)||a.county.name.localeCompare(b.county.name)),[figures,descending]);
  const budgeted=useMemo(()=>budget.reading?(sortBy==="cost"?[...ordered].sort((a,b)=>(budget.costOf(a.county.id)??Infinity)-(budget.costOf(b.county.id)??Infinity)):ordered).filter(f=>{const fit=budget.fitOf(f.county.id);return fit==="within"||fit==="near";}):ordered,[ordered,budget.reading,sortBy]);
  const visibleRows=useMemo(()=>budgeted.filter(f=>!nj||f.county.name.toLowerCase().includes(countySearch.trim().toLowerCase())),[budgeted,nj,countySearch]);
  const shading=mode!=="latest"?"Darker = a larger percentage change.":({sr1a_median_sale_price:"Darker = higher recorded sale prices.",zhvi_sfr:"Darker = higher typical home prices.",zori_all:"Darker = higher typical asking rents.",acs_median_hh_income:"Darker = higher household incomes.",acs_renter_cost_burden:"Darker = more renters spending over 30% of income on housing.",pep_population:"Darker = more residents.",acs_median_gross_rent:"Darker = higher surveyed rents, including utilities.",acs_median_home_value:"Darker = higher surveyed home values.",permits_total_units:"Darker = more homes permitted—not completed."} as Record<string,string>)[measure.metric_id]??"Darker = a higher figure.";
  const choice=figures.find(f=>f.county.id===selected);
  const choiceRank=choice?atlasRank(choice.value,values):null;
  const fallbackMeasure=nj&&mode==="latest"&&FALLBACK_OF[metric]?loaded[`${level}/${FALLBACK_OF[metric]}`]:undefined;
  const fallbackRow=choice&&choice.value===null&&typeof fallbackMeasure==="object"?fallbackMeasure.latest.rows.find(r=>r.id===choice.county.id&&Number.isFinite(r.latest)):undefined;
  // A survey figure the map leaves out — an older edition's, or one too uncertain to
  // place — is still named in the card, with its own survey years (2026-11-09).
  const leftOut=choice&&choice.value===null&&mode==="latest"?measure.leftOut?.[choice.county.id]:undefined;
  const surveyYears=(r:{period_start:string;period_end:string})=>r.period_start.slice(0,4)===r.period_end.slice(0,4)?r.period_end.slice(0,4):`${r.period_start.slice(0,4)}–${r.period_end.slice(0,4)}`;
  const levelIds=levelEntries.map(e=>e.metric_id);
  const catalogue=nj?catalogueIds(levelIds):[];
  const suggested=nj?SUGGESTED.flatMap(s=>{const ids=suggestionIds(s.id);const id=ids.find(i=>levelIds.includes(i));return id?[{...s,id,pressed:ids.includes(metric)}]:[];}):[];
  const variantSet=nj?variantSetOf(metric):undefined;
  const variants=variantSet?variantSet.members.filter(m=>levelIds.includes(m.id)):[];
  const rankLine=choiceRank&&choiceRank.of>1?`${choiceRank.tied?"Tied ":""}${ordinal(choiceRank.rank)} ${mode==="latest"?"highest":"largest rise"} of ${choiceRank.of} ${nj?levelInfo!.plural:"states"}`:"";
  const outlineOnly=Boolean(choice&&choice.county.id<0);
  const pickedPlaces=picks.map(id=>({id,name:destinations.find(d=>d.id===id)?.name??`Place ${id}`}));
  const format=(value:number|null)=>value===null?mode==="latest"?"Not published":"No comparable figure":mode==="latest"?formatMetric(value,measure.unit,metric):formatChange(value);
  const margin=(id:number)=>{const row=rows.get(id);return mode==="latest" ? row?.latest!=null ? marginLabel(row.latest,row.latestMargin??null,measure.unit,metric) : "" : changeMarginLabel(row?.changeMargin??null,metric);};
  const dates=useMemo(()=>mode==="latest" ? [...new Set(Object.values(measure.latest.periods))].sort() : [],[mode,measure]);
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
  // The held outlines and rows call the newest handlers, not the ones from when they were built.
  const handlers=useRef({select,togglePick});
  handlers.current={select,togglePick};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pathElements=useMemo(()=>shapes.map(shape=>{const county=nj?destinationById.get(Number(shape.id)):destinationByName.get(shape.name), id=county?.id, value=atlasValue(id===undefined?undefined:rows.get(id),mode);return county&&id!==undefined?<path key={id} data-county={id} data-state={!nj?String(shape.id):undefined} data-selected={selected===id} data-pinned={picks.includes(id)} data-budget={budget.fitOf(id)} data-empty={!nj&&value===null} d={shape.base} fill={fill(value)} tabIndex={0} role="button" aria-label={`${county.name}: ${format(value)}. Select ${nj?levelInfo!.noun:"state"}`} aria-pressed={selected===id} onClick={()=>{if(!moved.current)handlers.current.select(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();handlers.current.select(id);}}}><title>{county.name} · {format(value)}</title></path>:null;}),[shapes,nj,destinationById,destinationByName,rows,mode,selected,picks,breaks,values,byFifths,measure,metric,levelInfo,budget.reading]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tableRows=useMemo(()=>visibleRows.map(({county,value})=><tr key={county.id} data-county-row={county.id} data-selected={selected===county.id} data-pinned={picks.includes(county.id)}><th scope="row"><button type="button" aria-label={`Select ${county.name}`} aria-pressed={selected===county.id} onClick={()=>handlers.current.select(county.id)}>{county.name.replace(/ County$/,"")}</button></th>{budget.reading&&<td className="atlas-budget-cost" data-fit={budget.fitOf(county.id)}>{budget.costOf(county.id)!==null?formatValue(budget.costOf(county.id)!,"usd"):"—"}<small>{budget.costOf(county.id)!==null?(budget.fitOf(county.id)==="within"?`${formatValue(budget.line-budget.costOf(county.id)!,"usd")} to spare`:`${formatValue(budget.costOf(county.id)!-budget.line,"usd")} over`):""}</small></td>}<td>{format(value)}{margin(county.id)&&<small>{margin(county.id)}</small>}{mode==="latest"&&dates.length>1&&<small>{measure.latest.periods[county.id]?periodLabel(measure.latest.periods[county.id],metric):""}</small>}</td></tr>),[visibleRows,selected,picks,mode,measure,metric,rows,dates,budget.reading]);
  const zoom=(factor:number)=>setViewport(current=>{
    const scale=Math.min(MAX_ZOOM,Math.max(.8,current.scale*factor)), ratio=scale/current.scale;
    const cx=frameRef.current.w/2, cy=frameRef.current.h/2;
    return {scale,x:cx-(cx-current.x)*ratio,y:cy-(cy-current.y)*ratio};
  });
  // On phones the catalogue hangs from the controls, whose place on the page varies with
  // the title above them: it is held to the room left below it, so it never runs off the
  // bottom of the screen. Wide screens keep the stylesheet's height.
  const fitPicker=useCallback((node:HTMLDivElement|null)=>{
    // The catalogue runs to the bottom of the window, whatever the card's height above it.
    if(!node)return;
    node.style.maxHeight=`${Math.max(240,window.innerHeight-node.getBoundingClientRect().top-12)}px`;
  },[]);
  // Between New Jersey's layers the view is kept, so the whole state stays in sight; to and
  // from the nation it is reframed.
  const changeLevel=(next:Level)=>{const reframe=next==="states"||level==="states";setLevel(next);setSelected(null);if(next!=="states")setStateLayer(next);if(reframe)setViewport({scale:1,x:0,y:0});const ids=next==="states"?stateMeasures.map(m=>m.metric_id):entries.filter(e=>e.levels.includes(next)).map(e=>e.metric_id);if(!ids.includes(metric))setMetric(ids.includes(OPENING_MEASURE)?OPENING_MEASURE:ids[0]);if(next!==level&&(next==="states"||level==="states"))setPicks([]);};
  // Zooming in on the nation opens New Jersey; zooming out of New Jersey returns to it.
  useEffect(()=>{
    if(!restored)return;
    const next=layerForZoom(level,viewport.scale,stateLayer);
    if(next!==level)changeLevel(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[viewport.scale,restored]);
  return <section className="housing-atlas" aria-label="Housing map and comparison" data-level={level} data-mobile-view={expanded ? "list" : "map"} data-controls={panels.controls?"open":"away"} data-results={panels.results?"open":"away"} data-map-only={mapOnly} data-moving={dragging||camera!==targetCamera} style={{"--atlas-panel-width":`${panelWidth}px`,"--atlas-sheet-height":`${sheetHeight}px`} as CSSProperties}>
    {/* On a phone the measure takes the bar's middle, in place of the page's name, and
        opens the controls: the strip of chips under the bar is gone (owner, 2026-11-09). */}
    {bar&&<div className="atlas-bar-slot">{bar}<button type="button" className="atlas-bar-measure" aria-expanded={panels.controls} onClick={()=>setPanels(p=>({...p,controls:!p.controls}))}><span>{FRIENDLY[measure.metric_id]??measure.label}</span><small>{nj?levelInfo!.label:"United States"}</small><span aria-hidden="true">⌄</span></button></div>}
    <div className="atlas-chips" role="group" aria-label="Put-away panels">
      {!panels.controls&&<button type="button" ref={chipRef} className="atlas-chip atlas-controls-chip" data-named-by-suggestion={suggested.some(s=>s.pressed)} onClick={()=>setPanels(p=>({...p,controls:true}))} aria-label={`Show map controls: ${nj?levelInfo!.label:"United States"}, ${FRIENDLY[measure.metric_id]??measure.label}`}><span>{nj?levelInfo!.label:"United States"}</span><b>{FRIENDLY[measure.metric_id]??measure.label}</b><span aria-hidden="true">⌄</span></button>}
      {!panels.results&&<button type="button" className="atlas-chip atlas-results-chip" onClick={()=>setPanels(p=>({...p,results:true}))}>{choice?<><b>{choice.county.name}</b><span>{format(choice.value)}</span></>:<b>Ranking</b>}<span aria-hidden="true">›</span></button>}
    </div>
    <div className="atlas-controls" ref={controls}>
      <button type="button" className="atlas-card-hide" aria-label="Put away the map controls" title="Put away" onClick={()=>{setMoreMeasures(false);setPanels(p=>({...p,controls:false}));}}><span aria-hidden="true">–</span></button>
      {/* The card, simplified (owner, 2026-11-09): the measure is its title, the suggested
          measures are the picker with the whole catalogue one chip further, and time,
          the way out to the United States and sharing wait in a quiet footer. */}
      <h2 className="atlas-card-title"><Glossed text={FRIENDLY[measure.metric_id]??measure.label} /></h2>
      <div className="atlas-card-row">{variants.length>1&&<div className="atlas-source-switch" role="group" aria-label={variantSet!.name}>{variants.map(h=><button key={h.id} type="button" aria-pressed={metric===h.id} title={h.note} onClick={()=>{setMetric(h.id);setMode("latest");}}>{h.label}</button>)}</div>}{nj?<div className="atlas-levels" role="group" aria-label="New Jersey layer">{ATLAS_LEVELS.map(l=><button key={l.key} type="button" aria-pressed={level===l.key} onClick={()=>{setCountySearch("");changeLevel(l.key);}}>{l.label}</button>)}</div>:<span className="atlas-layer-name">The United States<small> · figures for New Jersey only. <button type="button" className="atlas-inline-link" onClick={()=>changeLevel(stateLayer)}>Open New Jersey</button></small></span>}</div>
      {/* Layer tiles (owner, 2026-11-09): each suggested measure as a small map of New
          Jersey in its own shades, so a reader sees where it is high before choosing it. */}
      <div className="atlas-tiles" role="group" aria-label="Measures">{suggested.map(s=><button key={s.id} type="button" className="atlas-tile" aria-pressed={s.pressed} onClick={()=>{setMetric(s.id);setMode("latest");setMoreMeasures(false);}}><AtlasPreview metric={s.pressed?metric:s.id}/><span>{s.label}</span></button>)}<button ref={measureLauncher} type="button" className="atlas-tile atlas-more-measures" aria-haspopup="dialog" aria-expanded={moreMeasures} aria-controls="atlas-measure-picker" aria-pressed={nj&&!suggested.some(s=>s.pressed)} onClick={()=>{setMoreMeasures(!moreMeasures);setMeasureSearch("");setSearchOpen(false);setAboutMeasure(null);}}><span className="atlas-more-face" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg><small>{nj?catalogue.length:stateMeasures.length}</small></span><span>{suggested.some(s=>s.pressed)||!nj?"More":FRIENDLY[measure.metric_id]??measure.label}</span></button></div>
      {moreMeasures&&<div id="atlas-measure-picker" className="atlas-measure-picker" ref={fitPicker} tabIndex={-1} role="region" aria-label="Measure catalogue" onKeyDown={e=>{if(!searchOpen&&e.key.length===1&&/\S/.test(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&(e.target as HTMLElement).tagName!=="INPUT"){e.preventDefault();setSearchOpen(true);setMeasureSearch(e.key);requestAnimationFrame(()=>measureSearchInput.current?.focus());}}}>
        <header><div><small>MEASURES</small><h2>Choose a measure</h2></div><button type="button" className="atlas-search-toggle" aria-label="Search measures" aria-expanded={searchOpen} aria-controls="atlas-measure-search" onClick={()=>{if(searchOpen){setSearchOpen(false);setMeasureSearch("");}else{setSearchOpen(true);requestAnimationFrame(()=>measureSearchInput.current?.focus());}}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg></button><button type="button" aria-label="Close measures" onClick={()=>{setMoreMeasures(false);measureLauncher.current?.focus({preventScroll:true});}}>×</button></header>
        {searchOpen&&<label className="atlas-measure-search">Search measures<input id="atlas-measure-search" ref={measureSearchInput} type="search" value={measureSearch} onChange={e=>setMeasureSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Escape"&&measureSearch){e.stopPropagation();e.nativeEvent.stopImmediatePropagation();setMeasureSearch("");}}} placeholder="Rent, income, building…"/></label>}
        {nj&&<p className="atlas-measure-about" aria-hidden="true">{aboutMeasure?<><b>{aboutMeasure.name}.</b> {aboutMeasure.definition}</>:"Point at a measure to read what it shows."}</p>}
        {(()=>{
          const q=measureSearch.trim().toLowerCase();
          const byId=new Map(levelEntries.map(e=>[e.metric_id,e]));
          // A tile answers for its whole variant set, so "studio" finds Rent.
          const pool=nj?catalogue.map(id=>{const e=byId.get(id)!;const set=variantSetOf(id);const also=(set?.members??[]).map(m=>`${m.label} ${byId.get(m.id)?.label??""}`).join(" ");return {id,name:FRIENDLY[id]??e.label,definition:e.definition,group:e.group,text:`${FRIENDLY[id]??e.label} ${e.label} ${e.definition} ${also}`,ids:set?set.members.map(m=>m.id):[id]};}):stateMeasures.filter(m=>m.latest.rows.length>0||Object.keys(m.windows).length>0).map(m=>({id:m.metric_id,name:FRIENDLY[m.metric_id]??m.label,definition:m.definition,group:"State figures",text:`${m.label} ${m.definition}`,ids:[m.metric_id]}));
          const matches=pool.filter(m=>m.text.toLowerCase().includes(q));
          const groups=[...GROUPS.map(g=>g.title),"State figures"];
          return matches.length?<>{groups.map((group,index)=>{const inGroup=matches.filter(m=>m.group===group);if(!inGroup.length)return null;return <div className="atlas-measure-group" key={group} data-category={index%3}><h3>{group} <small>{inGroup.length}</small></h3>{nj?<div className="atlas-tiles atlas-tiles-catalogue">{inGroup.map(m=>{const on=m.ids.includes(measure.metric_id);return <button type="button" key={m.id} className="atlas-tile" aria-pressed={on} title={m.definition} onMouseEnter={()=>setAboutMeasure(m)} onFocus={()=>setAboutMeasure(m)} onClick={()=>chooseMeasure(on?measure.metric_id:m.id)}><AtlasPreview metric={on?measure.metric_id:m.id}/><span>{m.name}</span></button>;})}</div>:inGroup.map(m=><button type="button" key={m.id} aria-pressed={m.id===measure.metric_id} onClick={()=>chooseMeasure(m.id)}><b>{m.name}<span aria-hidden="true">{m.id===measure.metric_id?"✓":"↗"}</span></b><span>{m.definition}</span></button>)}</div>;})}</>:<p>No matching measures. Try rent, income or building.</p>;
        })()}
      </div>}
      <div className="atlas-control-footer">{(mode!=="latest"||WINDOWS.some(w=>measure.windows[w.key]))&&<label className="atlas-time"><span>Time</span><select aria-label="View" value={mode} onChange={e=>setMode(e.target.value as AtlasMode)}><option value="latest">Latest figure</option>{WINDOWS.filter(w=>measure.windows[w.key]||mode===w.key).map(w=><option key={w.key} value={w.key}>{w.label} · change</option>)}</select></label>}{nj&&<button type="button" className="atlas-inline-link atlas-exit" onClick={()=>{setCountySearch("");changeLevel("states");}}><span aria-hidden="true">←</span> United States</button>}<button className="atlas-share-button" type="button" onClick={async()=>{try{const url=new URL(window.location.href);const params=url.searchParams;params.set("level",level);params.set("measure",metric);params.set("view",mode);if(selected!==null)params.set("place",String(selected));else params.delete("place");if(picks.length)params.set("compare",picks.join(","));else params.delete("compare");params.delete("pin");params.delete("lon");params.delete("lat");params.set("zoom",String(viewport.scale));params.set("x",String(viewport.x));params.set("y",String(viewport.y));budget.share(params);await navigator.clipboard.writeText(url.href);setShareStatus("Link copied");}catch{setShareStatus("Copy this page’s address to share this view");}}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/></svg>Share view</button><span className="atlas-share-status" role="status">{shareStatus}</span></div>
    </div>
    {nj&&budgetData&&<BudgetCard budget={budget} open={budgetOpen} setOpen={setBudgetOpen} controlsHeight={panels.controls?controlsHeight:chipHeight} onEnable={()=>{if(level!=="municipality"&&level!=="county")changeLevel("municipality");}} onShowTowns={()=>changeLevel("municipality")}/>}
    <div className="atlas-workspace">
      <div ref={stage} className="atlas-map-stage">
        <svg ref={svg} className="atlas-county-map" viewBox={`0 0 ${frame.width} ${frame.height}`} tabIndex={0} role="group" aria-label={`${nj?`New Jersey ${levelInfo!.noun} map. Drag or arrow keys to pan`:"United States map. Drag or arrow keys to pan"}; plus and minus zoom. Shapes select the matching table row.`}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=({ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();setViewport(v=>({...v,x:v.x+delta[0],y:v.y+delta[1]}));}else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}else if(e.key==="-"){e.preventDefault();zoom(.8);}}}
          onPointerDown={e=>{if(e.button!==0)return;setDragging(true);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:viewport};moved.current=false;}}
          onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(moved.current){const pixels=Math.min(rect.width/frame.width,rect.height/frame.height);setViewport({...d.start,x:d.start.x+dx/pixels,y:d.start.y+dy/pixels});}}}
          onPointerUp={e=>{setDragging(false);drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{setDragging(false);drag.current=null;moved.current=true;}}>
          <defs><pattern id="atlas-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8f939c"/><path d="M0 8L8 0" stroke="#d5d8de" strokeWidth="2"/></pattern><pattern id="atlas-unpriced" width="6" height="6" patternUnits="userSpaceOnUse"><rect className="atlas-unpriced-ground" width="6" height="6"/><circle className="atlas-unpriced-dot" cx="3" cy="3" r="1.1"/></pattern><filter id="atlas-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter></defs>
          <rect className="atlas-ocean" width={frame.width} height={frame.height}/><rect width={frame.width} height={frame.height} filter="url(#atlas-grain)" opacity=".035" pointerEvents="none"/>
          {/* Canada and Mexico sit apart from the states, so the states' lift is theirs alone. */}
          <g className="atlas-context" transform={`translate(${box.x+camera.x} ${box.y+camera.y}) scale(${camera.zoom})`} aria-hidden="true">
            {land.map(shape=><path className="atlas-context-land" key={`land-${shape.id}`} d={shape.base} pointerEvents="none"/>)}
          </g>
          <g className="atlas-map-geography" data-camera={`${camera.lon},${camera.lat},${camera.scale}`} transform={`translate(${box.x+camera.x} ${box.y+camera.y}) scale(${camera.zoom})`}>
            {pathElements}
          </g>
          {/* Labels stay one size at every zoom, so they sit outside the scaled group. */}
          <g className="atlas-cities" aria-hidden="true">{cities.map(c=><text key={c.name} x={Math.round(box.x+camera.x+c.xy[0]*camera.zoom)} y={Math.round(box.y+camera.y+c.xy[1]*camera.zoom)} data-beyond={c.beyond||undefined}><tspan className="atlas-city-dot" dy="0">•</tspan> {c.name}</text>)}</g>
        </svg>
        {!(nj?levelGeometry??[]:stateGeometry).length&&<p className="atlas-map-status" role="status">{failed?"Map unavailable. Published figures remain in the table.":"Drawing the atlas…"}</p>}
        <div className="atlas-map-buttons" role="group" aria-label="Map controls">{nj&&!panels.controls&&<button type="button" className="atlas-layers-button" aria-label={`Layers: ${FRIENDLY[measure.metric_id]??measure.label}`} title="Layers" onClick={()=>setPanels(p=>({...p,controls:true}))}><AtlasPreview metric={metric}/><span>Layers</span></button>}<button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>setViewport({scale:1,x:0,y:0})}>Reset</button><button type="button" className="atlas-map-only" aria-pressed={mapOnly} onClick={()=>setMapOnly(!mapOnly)} title={mapOnly?"Show the panels":"Map only: put every panel away"}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{mapOnly?<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>:<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>}</svg><span>{mapOnly?"Panels":"Map only"}</span></button></div>
        <div className="atlas-legend"><span>{format(values.length?Math.min(...values):null)}</span><div role="img" aria-label="Color scale for published area figures">{legendColors.map(color=><i key={color} style={{background:color}}/>)}</div><span>{format(values.length?Math.max(...values):null)}</span><small>{values.length===1?"Only one published area; no cross-area comparison yet":shading}</small>{byFifths&&breaks.length>0&&<small>Each shade is a fifth of {levelInfo!.plural}: {breaks.map(b=>format(b)).join(" · ")}</small>}<small><i className="atlas-missing-key"/>{nj?measureStatus||(values.length<destinations.length?`No figure: ${destinations.length-values.length} of ${destinations.length} ${levelInfo!.plural}${mode==="latest"&&measure.leftOut&&Object.keys(measure.leftOut).length?`, ${Object.keys(measure.leftOut).length} of them older or too uncertain to map`:""}`:`Every ${levelInfo!.noun} has a figure`):"Outline only: no figures yet"} · higher is not necessarily better</small></div>
        <small className="atlas-map-credit">Boundaries: Census TIGER/Line · world silhouette: Natural Earth · area figures, not individual homes</small>
      </div>
      <div className="atlas-panel-resizer" role="separator" tabIndex={0} aria-label="Resize comparison panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={panelWidth}
        onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setPanelWidth(w=>Math.max(320,Math.min(560,w+(e.key==="ArrowLeft"?20:-20))));}}}
        onPointerDown={e=>{resizing.current={x:e.clientX,width:panelWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(resizing.current)setPanelWidth(Math.max(320,Math.min(560,resizing.current.width+resizing.current.x-e.clientX)));}}
        onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} />
      <aside ref={results} className="atlas-results" aria-label="Place comparison results" data-expanded={expanded}>
        {/* A phone's sheet rests as one line — the chosen place, or the ranking's name — with
            the colour scale beside it in place of the floating legend; it pulls up for
            the list. Hidden on wider screens. */}
        <button type="button" className="atlas-peek" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}><span className="atlas-peek-text">{choice?<><b>{choice.county.name}</b><span>{format(choice.value)}</span>{rankLine&&<small>{rankLine}</small>}</>:<><b>{nj?`All ${levelInfo!.plural}, ranked`:"All states, ranked"}</b><small>Tap a {nj?levelInfo!.noun:"state"}, or pull up for the list</small></>}</span><span className="atlas-peek-scale" aria-hidden="true"><small>{format(values.length?Math.min(...values):null)}</small><i style={{background:`linear-gradient(90deg, ${legendColors.join(", ")})`}}/><small>{format(values.length?Math.max(...values):null)}</small></span></button>
        <div className="atlas-results-head"><h2>{nj?`All ${levelInfo!.plural}, ranked`:"All states, ranked"}</h2><button className="atlas-sheet-toggle" type="button" aria-expanded={expanded} aria-controls="atlas-table" onClick={()=>setExpanded(!expanded)}>{expanded?"Less":"Full list"}</button><button type="button" className="atlas-card-hide" aria-label="Put away the ranking" title="Put away" onClick={()=>{setExpanded(false);setPanels(p=>({...p,results:false}));}}><span aria-hidden="true">–</span></button></div>
        {choice&&<button className="atlas-clear-selection" type="button" onClick={()=>setSelected(null)}>Clear selection ×</button>}

        {nj&&picks.length>0&&<div className="atlas-comparison" aria-label="Places chosen to compare"><header><b>To compare · {picks.length} of {MAX_PLACES}</b><button type="button" aria-label="Clear the comparison" onClick={()=>setPicks([])}>×</button></header><ul className="atlas-compare-chips">{pickedPlaces.map(p=><li key={p.id}><button type="button" onClick={()=>select(p.id)}>{p.name}</button><button type="button" aria-label={`Remove ${p.name}`} onClick={()=>togglePick(p.id)}>×</button></li>)}</ul><Link className="atlas-compare-go" href={compareHref(picks)}>{picks.length===1?"Open it on the compare page →":`Compare ${picks.length} places on every measure →`}</Link><small>Counties, towns and ZIP codes can be compared together.</small></div>}
        {!nj&&<p className="atlas-state-coverage">New Jersey only. Other states: outlines, not figures.</p>}
        {outlineOnly&&<p className="atlas-outline-status" role="status">Boundary only · figures not yet supported</p>}
        <div className="atlas-selected" aria-live="polite" data-active={Boolean(choice)}><div key={`${selected}-${metric}-${mode}`} className="atlas-selection-content">{choice?<><h3>{choice.county.name}</h3><strong>{format(choice.value)}</strong>{rankLine&&<span className="atlas-rank">{rankLine}</span>}{nj&&<BudgetLine budget={budget} id={choice.county.id}/>}{fallbackRow&&typeof fallbackMeasure==="object"&&<span className="atlas-fallback">Zillow publishes no figure here. Census survey: <b>{formatMetric(fallbackRow.latest!,fallbackMeasure.unit,fallbackMeasure.metric_id)}</b>, owners’ own estimate{fallbackMeasure.latest.end?`, ${periodLabel(fallbackMeasure.latest.end,fallbackMeasure.metric_id)}`:""}. <button type="button" className="atlas-inline-link" onClick={()=>setMetric(FALLBACK_OF[metric])}>Show the Census map</button></span>}{leftOut&&<span className="atlas-fallback">{leftOut.reason==="older"?<>Not in the newest survey. The {surveyYears(leftOut)} survey: <b>{formatMetric(leftOut.value,measure.unit,metric)}</b>{leftOut.margin_of_error!=null?<> ({marginLabel(leftOut.value,leftOut.margin_of_error,measure.unit,metric)})</>:null}.</>:<>Too uncertain to map: <b>{formatMetric(leftOut.value,measure.unit,metric)}</b> ({marginLabel(leftOut.value,leftOut.margin_of_error,measure.unit,metric)}), {surveyYears(leftOut)} survey.</>}</span>}<small>{margin(choice.county.id)}{mode==="latest"&&measure.latest.periods[choice.county.id]?` · ${periodLabel(measure.latest.periods[choice.county.id],metric)}`:""}</small>{nj?<div className="atlas-place-actions"><Link className="destination-county" href={regionPath(choice.county.id)}>View place →</Link>{nj&&choice&&choice.county.id>0&&<button className="atlas-pin-button" type="button" aria-pressed={picks.includes(choice.county.id)} disabled={!picks.includes(choice.county.id)&&picks.length>=MAX_PLACES} onClick={()=>togglePick(choice.county.id)}>{picks.includes(choice.county.id)?"Remove from comparison":picks.length>=MAX_PLACES?`Comparison full (${MAX_PLACES})`:"Add to comparison"}</button>}</div>:choice.county.id===states.find(s=>s.code==="NJ")?.id?<><button type="button" className="atlas-drill" onClick={()=>changeLevel("county")}>Explore New Jersey counties →</button><Link href="/states/new-jersey">Open state page →</Link></>:<p>State and county figures are not available here yet.</p>}</>:<p>Select a {nj?levelInfo!.noun:"state"} on the map or in the table.</p>}</div></div>
        <div className="atlas-reading"><b><Glossed text={FRIENDLY[measure.metric_id]??measure.label} /></b><span>{measureStatus||<>{mode==="latest"?"Latest figure":"Percentage change"} · {dateLabel}</>}</span><p className="atlas-how-to-read">{measure.definition}</p></div>
        {nj&&<div className="atlas-county-finder"><label>Find a {levelInfo!.noun}<input type="search" value={countySearch} onChange={e=>setCountySearch(e.target.value)} placeholder={level==="zip"?"ZIP code":`${levelInfo!.noun[0].toUpperCase()}${levelInfo!.noun.slice(1)} name`}/></label>{countySearch&&<small role="status">{visibleRows.length} matching · map still shows all {levelInfo!.plural}</small>}</div>}
<div className="atlas-table-wrap" ref={table} id="atlas-table" tabIndex={0} role="region" aria-label={`${nj?levelInfo!.label:"States"} ranked, scroll for all places`}><table><thead><tr><th scope="col">{nj?levelInfo!.noun[0].toUpperCase()+levelInfo!.noun.slice(1):"State"}</th>{budget.reading&&<th scope="col"><button type="button" aria-pressed={sortBy==="cost"} onClick={()=>setSortBy(sortBy==="cost"?"figure":"cost")}>A month {sortBy==="cost"?"↑":""}</button></th>}<th scope="col"><button type="button" onClick={()=>{setSortBy("figure");setDescending(!descending);}} aria-label={`Sort figures ${descending?"low to high":"high to low"}`}>Figure {descending?"↓":"↑"}</button></th></tr></thead><tbody>{tableRows}</tbody></table></div>
        <details className="atlas-notes"><summary>About this measure & sources</summary><p>{measure.definition}</p>{measure.sourceUrl?<a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source} ↗</a>:<p>{measure.source}</p>}<p><Glossed text={MARGIN_NOTE} /></p>{mode!=="latest"&&windowNote(mode,metric,measure.windows).map(note=><p key={note}>{note}</p>)}<p>The linear scale resets with each measure and period. Hatched areas have no figure; unavailable periods are disabled. Area figures do not describe an individual property.</p></details>
      </aside>
    </div>
  </section>;
}
