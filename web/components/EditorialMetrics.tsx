"use client";
import {useEffect,useState,type ReactNode} from "react";

export function EditorialMetrics({items}:{items:ReactNode[]}) {
  const [index,setIndex]=useState(0);
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const engaged=hovered || focused;
  const [reduced,setReduced]=useState(true);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(media.matches);
    const visibility=()=>setHidden(document.hidden);
    update();visibility();media.addEventListener("change",update);
    document.addEventListener("visibilitychange",visibility);
    return()=>{media.removeEventListener("change",update);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  useEffect(()=>{
    if(items.length<2 || engaged || reduced || hidden) return;
    const timer=setInterval(()=>setIndex(i=>(i+1)%items.length),10000);
    return()=>clearInterval(timer);
  },[items.length,engaged,reduced,hidden,index]);
  if(!items.length) return null;
  return <div className="editorial-carousel" role="group" tabIndex={0} aria-label="Computed figures; focus holds the current figure" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);}}>
    <div key={index} className="editorial-metric" aria-live="off">{items[index%items.length]}</div>
  </div>;
}
