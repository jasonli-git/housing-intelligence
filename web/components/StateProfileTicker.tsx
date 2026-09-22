"use client";

import { useState } from "react";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { useAutoCarousel } from "@/components/useAutoCarousel";
import type { ProfileItem } from "@/lib/verdict";

/** A visual loop, not a live feed: dates travel with every published observation. */
export function StateProfileTicker({ items }: { items: ProfileItem[] }) {
  const [stopped, setStopped] = useState(false);
  const motion = useAutoCarousel(false, () => {});
  if (!items.length) return null;
  return (
    <section ref={motion.rootRef} className="state-ticker" aria-label="Across the state"
      data-stopped={stopped || motion.reduceMotion} {...motion.interactionProps}>
      <div className="state-ticker-head">
        <span>PROFILE</span><h2>Across<br />the state</h2>
        <button type="button" onClick={() => setStopped(!stopped)} aria-pressed={stopped}
          disabled={motion.reduceMotion} aria-label={stopped ? "Play statewide ticker" : "Pause statewide ticker"}>
          {motion.reduceMotion ? "Still" : stopped ? "Play" : "Pause"}
        </button>
      </div>
      <div className="state-ticker-window">
        <div className="state-ticker-track" style={{ animationDuration: `${Math.max(30, items.length * 14)}s`, animationPlayState: motion.paused || stopped ? "paused" : "running" }}>
          {[false, true].map((duplicate) => (
            <ul key={String(duplicate)} className="state-ticker-group" aria-hidden={duplicate || undefined}>
              {items.map((item) => <li key={item.metric_id}>
                <b>{item.value}</b>
                {duplicate ? <span>{item.label}</span> : <FloatingMetricTerm metricId={item.metric_id} label={item.label} definition={item.definition} why={null} />}
                <small>{item.context}</small>
              </li>)}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
