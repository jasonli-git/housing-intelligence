"use client";

import { useEffect, useRef, useState } from "react";

export type AtlasCamera = {lon:number;lat:number;scale:number;zoom:number;x:number;y:number};

/** Retarget from the drawn frame, not a queued destination. Dragging stays direct. */
export function useAtlasCamera(target:AtlasCamera, direct:boolean) {
  const [drawn,setDrawn]=useState(target);
  const current=useRef(target);
  const [reduced,setReduced]=useState(true);
  useEffect(()=>{
    const query=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(query.matches);
    update();query.addEventListener("change",update);
    return()=>query.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    if(direct||reduced) {current.current=target;setDrawn(target);return;}
    const start=current.current;
    // Follow the shortest longitude arc when crossing the antimeridian.
    const longitude=(((target.lon-start.lon)%360+540)%360)-180;
    const began=performance.now();
    let frame=0;
    const tick=(now:number)=>{
      const progress=Math.min(1,(now-began)/360);
      const eased=1-Math.pow(1-progress,3);
      const next:AtlasCamera=progress===1?target:{
        lon:start.lon+longitude*eased,
        lat:start.lat+(target.lat-start.lat)*eased,
        scale:Math.exp(Math.log(start.scale)+(Math.log(target.scale)-Math.log(start.scale))*eased),
        zoom:start.zoom+(target.zoom-start.zoom)*eased,
        x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased,
      };
      current.current=next;setDrawn(next);
      if(progress<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[target,direct,reduced]);
  // Do not wait for an effect-driven second render for drag/reduced-motion input.
  return direct||reduced?target:drawn;
}
