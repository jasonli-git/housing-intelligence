"use client";
import { useEffect, useRef, useState } from "react";
/** A shallow flow diagram. End-band thickness represents the included monthly payment. */
export function CostRibbon({ parts, principal, label }: {
  parts: { key: string; value: number; color: string }[]; principal: number; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed,setRevealed] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e=>e.isIntersecting)) { setRevealed(true); observer.disconnect(); }
    },{threshold:.4});
    observer.observe(ref.current);
    return ()=>observer.disconnect();
  },[]);
  const spent = parts.filter(p => Number.isFinite(p.value) && p.value > 0);
  const kept = Number.isFinite(principal) ? Math.max(0, principal) : 0;
  const total = spent.reduce((sum,p) => sum+p.value,0)+kept;
  if (!total) return null;
  let offset = 0;
  const bands = [...spent,{key:"principal",value:kept,color:"var(--good)"}].filter(p=>p.value>0);
  return <div ref={ref} className="cost-ribbon-wrap"><span className="ribbon-spent" aria-hidden="true">Interest &amp; bills</span><span className="ribbon-principal" aria-hidden="true">Principal</span><svg className={`cost-ribbon${revealed ? " is-revealed" : ""}`} viewBox="0 0 400 120" role="img" aria-label={label} focusable="false" preserveAspectRatio="none">
    {bands.map(p => {
      const thickness = p.value/total*32;
      const start = 34+offset;
      const end = p.key === "principal" ? 82 : 18+offset;
      offset += thickness;
      return <path key={p.key} data-part={p.key} fill={p.color} d={`M0 ${start} C160 ${start} 200 ${end} 400 ${end} L400 ${end+thickness} C200 ${end+thickness} 160 ${start+thickness} 0 ${start+thickness} Z`} />;
    })}
  </svg></div>;
}
