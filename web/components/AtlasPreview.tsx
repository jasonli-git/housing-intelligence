"use client";

import { useEffect, useRef, useState } from "react";
import { ATLAS_COLORS } from "@/lib/housingAtlas";
import { previewPaths, type PreviewFile } from "@/lib/atlasPreviews";
import { unpack, type PackedOutline } from "@/lib/mapdata";

const SIZE = 72;
type Loaded = { file: PreviewFile; paths: Map<number, Path2D> };
// One request for the shades and one for the outlines, shared by every tile and kept for
// the page's life; the outlines are the file the town map reads, so usually cached already.
let loading: Promise<Loaded | null> | null = null;
function load(): Promise<Loaded | null> {
  loading ??= Promise.all([
    fetch("/atlas/previews.json").then((r) => (r.ok ? (r.json() as Promise<PreviewFile>) : null)),
    fetch("/atlas/municipalities.json").then((r) => (r.ok ? (r.json() as Promise<{ outlines: PackedOutline[] }>) : null)),
  ])
    .then(([file, body]) => (file && body?.outlines.length ? { file, paths: previewPaths(unpack(body.outlines), SIZE) } : null))
    .catch(() => null);
  return loading;
}

/**
 * A measure's layer tile: New Jersey's towns in that measure's fifths, painted on a canvas
 * (564 SVG paths per tile, for every measure in the catalogue, would weigh on the page). Shown
 * as decoration beside the tile's label; with no shades it is New Jersey's bare shape.
 */
export function AtlasPreview({ metric }: { metric: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [theme, setTheme] = useState(0);
  // The catalogue holds dozens of tiles: each is painted when it first scrolls into view.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const observer = new IntersectionObserver((items) => { if (items.some((i) => i.isIntersecting)) setSeen(true); }, { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);
  useEffect(() => { let live = true; load().then((d) => { if (live) setData(d); }); return () => { live = false; }; }, []);
  // The no-figure shade follows the theme, so repaint when it changes.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setTheme((t) => t + 1);
    media.addEventListener("change", change);
    return () => { observer.disconnect(); media.removeEventListener("change", change); };
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !data || !seen) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = SIZE * ratio;
    element.height = SIZE * ratio;
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);
    // The stylesheet sets the canvas's colour to the no-figure token; reading `color`
    // resolves its light-dark() pair, which a custom property's value would not.
    const missing = getComputedStyle(element).color || "gray";
    const shades = data.file.previews[metric]?.shades;
    data.file.towns.forEach((id, index) => {
      const path = data.paths.get(id);
      if (!path) return;
      const shade = shades?.[index];
      context.fillStyle = shade && shade !== "-" ? ATLAS_COLORS[Number(shade)] : missing;
      context.fill(path);
    });
  }, [data, metric, theme, seen]);
  return <canvas ref={canvas} className="atlas-preview" width={SIZE} height={SIZE} aria-hidden="true" />;
}
