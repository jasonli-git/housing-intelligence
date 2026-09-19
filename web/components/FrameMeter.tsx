"use client";

/**
 * What a frame actually costs, on the reader's own machine.
 *
 * Four rounds of map performance work were measured from an automated browser that keeps
 * its page hidden. A hidden page never paints, so every frame gap reads as the throttle
 * floor whatever the map is doing, and rasterising and compositing — the half of the
 * work that turned out to matter — cannot be seen at all. Every figure in ARCHITECTURE
 * #169 and #170 is either arithmetic or a count of DOM writes for that reason.
 *
 * This closes the gap. It is off unless `?perf` is in the address, it renders nothing
 * otherwise, and it reports the three things that tell a slow map apart from a slow page:
 * how long frames take, how long the longest blocking task ran, and how long the browser
 * took to answer a pointer. A map that drops frames and a map that answers the hand late
 * feel identical to use and have nothing else in common.
 */

import { useEffect, useState } from "react";

type Side = { frames: number; median: number; p95: number; worst: number };

type Reading = {
  /** Frames while the reader's hand was on something. The ones that are felt. */
  busy: Side;
  /** Everything else: loading, settling, sitting still. */
  idle: Side;
  tasks: number;
  taskWorst: number;
  inputWorst: number;
  /** Which event that was — "a number rather than a name" is what stalled the last one. */
  inputName: string;
};

const NONE: Side = { frames: 0, median: 0, p95: 0, worst: 0 };
const BLANK: Reading = {
  busy: NONE,
  idle: NONE,
  tasks: 0,
  taskWorst: 0,
  inputWorst: 0,
  inputName: "",
};

/** How long after the last pointer or wheel event a frame still counts as interactive. */
const STILL_BUSY = 300;

function quantile(sorted: number[], at: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * at))];
}

export function FrameMeter() {
  const [on, setOn] = useState(false);
  const [reading, setReading] = useState<Reading>(BLANK);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).has("perf"));
  }, []);

  useEffect(() => {
    if (!on) return;
    const busy: number[] = [];
    const idle: number[] = [];
    let touched = 0;
    const felt = (event: Event) => {
      touched = event.timeStamp || performance.now();
    };
    for (const name of ["pointerdown", "pointermove", "pointerup", "wheel"]) {
      window.addEventListener(name, felt, { capture: true, passive: true });
    }
    let tasks = 0;
    let taskWorst = 0;
    let inputWorst = 0;
    let inputName = "";
    let last = 0;
    let frame = 0;
    let shown = 0;

    const side = (from: number[]): Side => {
      const sorted = [...from].sort((a, b) => a - b);
      return {
        frames: sorted.length,
        median: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        worst: sorted.at(-1) ?? 0,
      };
    };

    const tick = (now: number) => {
      // The first gap after a pause is the pause, not a frame. And a frame is only
      // "felt" if a hand was on something — page load and settling are not what anyone
      // means by a laggy map, and counting them together is what made the first reading
      // of this meter unreadable.
      if (last && now - last < 400) {
        (now - touched < STILL_BUSY ? busy : idle).push(now - last);
      }
      last = now;
      if (now - shown > 250) {
        shown = now;
        setReading({
          busy: side(busy),
          idle: side(idle),
          tasks,
          taskWorst,
          inputWorst,
          inputName,
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const watchers: PerformanceObserver[] = [];
    const watch = (type: string, take: (entry: PerformanceEntry) => void) => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) take(entry);
        });
        // `durationThreshold` is ignored by types that do not know it.
        observer.observe({
          type,
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
        watchers.push(observer);
      } catch {
        // A browser without this entry type simply reports zero for it.
      }
    };
    watch("longtask", (entry) => {
      tasks += 1;
      taskWorst = Math.max(taskWorst, entry.duration);
    });
    watch("event", (entry) => {
      if (entry.duration <= inputWorst) return;
      inputWorst = entry.duration;
      // The event's own name, and what it landed on where the browser reports it. A
      // slow input is not a slow frame — nothing need have blocked the main thread — so
      // knowing which interaction it was is most of the investigation.
      const target = (entry as unknown as { target?: Element | null }).target;
      const where = target?.getAttribute?.("class") || target?.tagName || "";
      inputName = where ? `${entry.name} on ${where}` : entry.name;
    });

    return () => {
      cancelAnimationFrame(frame);
      for (const observer of watchers) observer.disconnect();
      for (const name of ["pointerdown", "pointermove", "pointerup", "wheel"]) {
        window.removeEventListener(name, felt, { capture: true });
      }
    };
  }, [on, round]);

  if (!on) return null;

  const ms = (n: number) => `${n.toFixed(1)}ms`;
  const line = (label: string, s: Side) =>
    `${label} ${s.frames}f median ${ms(s.median)} p95 ${ms(s.p95)} worst ${ms(s.worst)}`;
  const summary =
    `${line("HAND-ON", reading.busy)} | ${line("idle", reading.idle)} | ` +
    `long tasks ${reading.tasks} (worst ${ms(reading.taskWorst)}) | ` +
    `slowest input ${ms(reading.inputWorst)}${reading.inputName ? ` (${reading.inputName})` : ""} | ` +
    `${window.devicePixelRatio}x | ` +
    `${navigator.hardwareConcurrency ?? "?"} cores | ` +
    `map ${document.querySelector(".globe-stage")?.clientWidth ?? "?"}px`;

  return (
    <aside className="frame-meter">
      <b>Frames while your hand is on it</b>
      <span>
        {reading.busy.frames}f · median {ms(reading.busy.median)} · p95{" "}
        {ms(reading.busy.p95)} · worst {ms(reading.busy.worst)}
      </span>
      <span>
        idle {reading.idle.frames}f · median {ms(reading.idle.median)} · worst{" "}
        {ms(reading.idle.worst)}
      </span>
      <span>
        long tasks {reading.tasks} (worst {ms(reading.taskWorst)}) · slowest
        input {ms(reading.inputWorst)}
        {reading.inputName ? ` (${reading.inputName})` : ""}
      </span>
      <span className="frame-meter-acts">
        <button
          type="button"
          onClick={() => {
            setReading(BLANK);
            setRound((n) => n + 1);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(summary)}
        >
          Copy
        </button>
      </span>
    </aside>
  );
}
