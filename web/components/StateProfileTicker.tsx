"use client";

import { type PointerEvent, useRef, useState } from "react";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { RankText } from "@/components/Ledger";
import { useAutoCarousel } from "@/components/useAutoCarousel";
import type { ProfileItem } from "@/lib/verdict";

function MotionIcon({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {reduced ? (
        <path d="M4 8h8" />
      ) : playing ? (
        <path className="play" d="m6 4 6 4-6 4Z" />
      ) : (
        <><path d="M5.5 4v8" /><path d="M10.5 4v8" /></>
      )}
    </svg>
  );
}

type TickerDrag = {
  pointerId: number;
  startX: number;
  startOffset: number;
  offset: number;
  groupWidth: number;
  scrollLeft: number;
  moved: boolean;
};

/** Keep the two repeated groups covering the viewport while dragging either way. */
function wrappedOffset(offset: number, width: number): number {
  const remainder = ((offset % width) + width) % width;
  return remainder === 0 ? 0 : remainder - width;
}

/** A visual loop, not a live feed: dates travel with every published observation. */
export function ProfileTicker({
  items,
  title,
  ariaLabel,
  className = "",
  peerLabel,
}: {
  items: ProfileItem[];
  title: string;
  ariaLabel: string;
  className?: string;
  /** What the rank denominator counts: counties, municipalities or ZIP codes. */
  peerLabel?: string;
}) {
  const [stopped, setStopped] = useState(false);
  const [manualPlaying, setManualPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<TickerDrag | null>(null);
  const suppressClick = useRef(false);
  const motion = useAutoCarousel(false, () => {});
  if (!items.length) return null;
  // Same travel distance, 5% more movement per second.
  const durationSeconds = Math.max(30, items.length * 14) / 1.05;

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || motion.reduceMotion) return;
    const track = trackRef.current;
    const groupWidth = track?.querySelector(".state-ticker-group")?.getBoundingClientRect().width ?? 0;
    if (!track || !groupWidth) return;
    const startOffset = stopped ? 0 : new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startOffset,
      offset: startOffset, groupWidth, scrollLeft: event.currentTarget.scrollLeft, moved: false,
    };
    if (!stopped) {
      track.style.animationName = "none";
      track.style.transform = `translateX(${startOffset}px)`;
    }
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    if (stopped) {
      event.currentTarget.scrollLeft = drag.scrollLeft - delta;
    } else if (trackRef.current) {
      drag.offset = wrappedOffset(drag.startOffset + delta, drag.groupWidth);
      trackRef.current.style.transform = `translateX(${drag.offset}px)`;
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!stopped && trackRef.current) {
      const offset = wrappedOffset(drag.offset, drag.groupWidth);
      trackRef.current.style.animationDelay = `${offset / drag.groupWidth * durationSeconds}s`;
      trackRef.current.style.animationName = "";
      trackRef.current.style.transform = "";
    }
    if (drag.moved) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <section
      ref={motion.rootRef}
      className={`state-ticker ${className}`.trim()}
      aria-label={ariaLabel}
      data-stopped={stopped || motion.reduceMotion || (motion.focused && !manualPlaying)}
      onMouseEnter={motion.interactionProps.onMouseEnter}
      onMouseLeave={(event) => {
        setManualPlaying(false);
        motion.interactionProps.onMouseLeave(event);
      }}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".state-ticker-head button")) {
          setManualPlaying(false);
          const item = target.closest("li");
          if (item) requestAnimationFrame(() => item.scrollIntoView({ block: "nearest", inline: "nearest" }));
        }
        motion.interactionProps.onFocusCapture(event);
      }}
      onBlurCapture={(event) => {
        setManualPlaying(false);
        motion.interactionProps.onBlurCapture(event);
      }}
    >
      <div className="state-ticker-head">
        <span>PROFILE</span><h2>{title}</h2>
        <button type="button" onClick={() => {
          if (stopped) {
            setStopped(false);
            setManualPlaying(true);
          } else {
            setStopped(true);
            setManualPlaying(false);
          }
        }} aria-pressed={stopped}
          disabled={motion.reduceMotion} title={motion.reduceMotion ? "Motion reduced" : stopped ? "Play" : "Pause"}
          aria-label={motion.reduceMotion
            ? `${title} ticker is still because reduced motion is enabled`
            : stopped
              ? `Play ${title.toLowerCase()} ticker`
              : `Pause ${title.toLowerCase()} ticker`}
        >
          <MotionIcon reduced={motion.reduceMotion} playing={stopped} />
        </button>
      </div>
      <div className="state-ticker-window" data-dragging={dragging} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}>
        <div ref={trackRef} className="state-ticker-track" style={{ animationDuration: `${durationSeconds.toFixed(1)}s`, animationPlayState: stopped || (motion.paused && !manualPlaying) ? "paused" : "running" }}>
          {[false, true].map((duplicate) => (
            <ul key={String(duplicate)} className="state-ticker-group" aria-hidden={duplicate || undefined}>
              {items.map((item) => {
                const context = item.context;
                return (
                  <li key={item.metric_id} className={context?.rank && peerLabel ? "has-rank" : undefined}>
                    <span className="ticker-value"><b>{item.value}</b>{item.margin && <span className="margin ticker-margin">{item.margin}</span>}</span>
                    {duplicate ? <span>{item.label}</span> : <FloatingMetricTerm metricId={item.metric_id} label={item.label} definition={item.definition} why={null} />}
                    {context?.words && <small className="state-ticker-context">{context.words}</small>}
                    {context?.rank && peerLabel && (
                      <RankText
                        className="profile-rank"
                        rank={context.rank.value}
                        of={context.rank.of}
                        words={profileRankWords(context.rank, peerLabel)}
                        visual={(
                          <span className="profile-rank-visual" aria-hidden="true">
                            <span className="profile-rank-label">Rank</span>
                            <strong>{profileRankShown(context.rank)}/{context.rank.of}</strong>
                            <em>{peerLabel}</em>
                          </span>
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StateProfileTicker({ items }: { items: ProfileItem[] }) {
  return <ProfileTicker items={items} title="Statewide" ariaLabel="Across the state" />;
}

type ProfileRank = { value: number; of: number; best?: number; worst?: number };

/** "25–190" where a survey figure's margin leaves its rank a range (Milestone 28). */
function profileRankShown(rank: ProfileRank): string {
  return rank.best !== undefined && rank.worst !== undefined && rank.best !== rank.worst
    ? `${rank.best}–${rank.worst}`
    : String(rank.value);
}

function profileRankWords(rank: ProfileRank, peers: string): string {
  return rank.best !== undefined && rank.worst !== undefined && rank.best !== rank.worst
    ? `Rank between ${rank.best} and ${rank.worst} of ${rank.of} ${peers}`
    : `Rank ${rank.value} of ${rank.of} ${peers}`;
}
