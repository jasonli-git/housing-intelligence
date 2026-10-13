"use client";
import { useState, type ReactNode } from "react";

export function ExhibitGallery({ children }: { children: ReactNode }) {
  const [paused,setPaused]=useState(false);
  return <div className="exhibit-gallery" data-motion={paused ? "paused" : "playing"}>
    <div className="exhibit-gallery-head"><p>Explore what interests you.</p><button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused ? "Resume artwork" : "Pause artwork"}</button></div>
    {children}
  </div>;
}
