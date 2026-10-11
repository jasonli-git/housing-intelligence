"use client";

import { useState, type CSSProperties } from "react";
import { mosaicCounts, type MosaicView } from "@/lib/housingMosaic";

/** A playful share graphic, not a map, a sample of homes, or a cross-tabulation. */
export function HousingMosaic({ name, views, statewide = false, embedded = false }: { name: string; views: MosaicView[]; statewide?: boolean; embedded?: boolean }) {
  const [viewId, setViewId] = useState(views[0]?.id);
  const [selected, setSelected] = useState(0);
  if (!views.length) return null;
  const viewIndex = Math.max(0, views.findIndex(v => v.id === viewId));
  const view = views[viewIndex];
  const counts = mosaicCounts(view.groups.map(g => g.share));
  const group = view.groups[selected] ?? view.groups[0];
  const slots = counts.flatMap((count, groupIndex) => Array<number>(count).fill(groupIndex));
  const percentage = (share: number) => `${(share * 100).toFixed(1)}%`;
  return <section className={`housing-mosaic${embedded ? " mosaic-embedded" : ""}`} id="housing-mosaic" aria-labelledby="housing-mosaic-heading" data-jump-label="Housing mosaic">
    <div className="mosaic-heading">
      <div>{!embedded && <span className="mosaic-eyebrow">{statewide ? "A state in little pieces" : "A hundred little homes"}</span>}{embedded ? <h3 id="housing-mosaic-heading">Explore the mix</h3> : <h2 id="housing-mosaic-heading">{statewide ? "Housing in motion" : "The housing mix"}</h2>}</div>
      <div className="mosaic-views" role="group" aria-label="Housing mosaic view">
        {views.map(v => <button key={v.id} type="button" aria-pressed={view.id === v.id}
          onClick={() => { setViewId(v.id); setSelected(0); }}>{v.label}</button>)}
      </div>
    </div>
    <div className="mosaic-body">
      <div className="mosaic-art" aria-hidden="true">
        {Array.from({ length: 100 }, (_, i) => {
          // Visual identities are reshuffled on every view. They are not records
          // that can be tracked from ownership into age or vacancy.
          const slot = (i + viewIndex * 37) % 100;
          const category = slots[slot];
          return <span key={i} className="mosaic-tile" data-group={category}
            data-active={category === selected}
            onPointerMove={() => setSelected(category)} onClick={() => setSelected(category)}
            style={{ "--x": slot % 20, "--y": Math.floor(slot / 20),
              "--mx": slot % 10, "--my": Math.floor(slot / 10) } as CSSProperties}>
            <svg viewBox="0 0 24 32" focusable="false"><path d="M2 12 12 2l10 10v18H2Z" /><path className="mosaic-window" d="M8 15h8v7H8Z" /></svg>
          </span>;
        })}
      </div>
      <div className="mosaic-reading">
        <p className="mosaic-denominator">{view.denominator} · {name}</p>
        <div className="mosaic-selected">
          <div className="mosaic-selected-heading"><strong>{percentage(group.share)}</strong><span>{group.label}</span></div>
          {(!embedded || group.margin) && <small>{group.margin ? <>{group.margin}{group.margin !== "no margin available" && " · 90% margin"}</> : "Shares calculated from reported records"}</small>}<p>{group.note}</p>
          {counts[selected] === 0 && group.share > 0 && <small>Smaller than one tile at this scale.</small>}
        </div>
        <div className="mosaic-legend" role="group" aria-label="Explore housing groups">
          {view.groups.map((g, i) => <button key={g.label} type="button" data-group={i}
            aria-label={`${g.label} ${percentage(g.share)}`} aria-pressed={selected === i}
            aria-describedby={`mosaic-description-${view.id}-${i}`}
            onFocus={() => setSelected(i)} onClick={() => setSelected(i)}>
            <span className="mosaic-swatch" aria-hidden="true" /><span>{g.label}</span><b>{percentage(g.share)}</b>
            <span className="visually-hidden" id={`mosaic-description-${view.id}-${i}`}>
              {g.margin ?? "Share calculated from reported records"}{g.margin && g.margin !== "no margin available" && " (90% margin)"}. {g.note}
            </span>
          </button>)}
        </div>
      </div>
    </div>
    {embedded ? <p className="mosaic-source mosaic-caption">100 tiles ≈ reported shares, not individual homes or a map; views are separate. {view.evidence ?? `Census ACS · ${view.period} five-year survey estimates.`}</p> : <>
      <p className="mosaic-caption">100 tiles, rounded shares—not individual homes or a map. Each view is a separate picture.</p>
      <p className="mosaic-source">{view.evidence ?? `Census ACS · ${view.period} five-year survey estimates.`} Select a group to explore.</p>
    </>}
  </section>;
}
