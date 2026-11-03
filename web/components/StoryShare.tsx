"use client";

import { useEffect, useRef, useState } from "react";
import { artifactUrl } from "@/lib/api";

/** The story's export (Director Note "Social export", 2026-11-03): its 4:5 image, drawn at
 *  deploy by `scripts/story-share.mjs`, to download or hand to the device's share sheet, and
 *  its link to copy. Hidden until that image loads (so it loads eagerly: a hidden lazy image
 *  never would), and a story without one offers nothing. */
export function StoryShare({ slug, title }: { slug: string; title: string }) {
  const image = `${artifactUrl}/screenshots/share/${slug}-4x5.jpg`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // The image can finish loading, or fail, before React attaches its handlers.
  const picture = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = picture.current;
    if (img?.complete) img.naturalWidth ? setReady(true) : setFailed(true);
  }, []);
  const [status, setStatus] = useState("");
  // Known only in the browser, so set after hydration rather than during the server render.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("share" in navigator), []);
  const link = () => `${location.origin}/stories/${slug}`;

  // The image comes from the artifact host, where a download link's `download` name is
  // ignored, so it is fetched and saved from a local copy.
  async function file() {
    const response = await fetch(image);
    if (!response.ok) throw new Error(String(response.status));
    return new File([await response.blob()], `${slug}.jpg`, { type: "image/jpeg" });
  }

  async function download() {
    try {
      const url = URL.createObjectURL(await file());
      const a = Object.assign(document.createElement("a"), { href: url, download: `${slug}.jpg` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Image saved.");
    } catch {
      setStatus("The image could not be loaded. Try again in a moment.");
    }
  }

  async function share() {
    try {
      const shared = await file();
      if (navigator.canShare?.({ files: [shared] })) await navigator.share({ files: [shared], title, url: link() });
      else await navigator.share({ title, url: link() });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setStatus("Sharing did not work here. Save the image instead.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setStatus("Link copied.");
    } catch {
      setStatus("The link could not be copied.");
    }
  }

  if (failed) return null;
  return <section className="story-share" aria-labelledby="story-share-heading" hidden={!ready}>
    <img ref={picture} src={image} alt={`The ${title} image to share: its takeaway and chart.`} width={1080} height={1350} decoding="async" onLoad={() => setReady(true)} onError={() => setFailed(true)} />
    <div>
      <h2 id="story-share-heading">Share this story</h2>
      <div className="story-share-actions">
        <button type="button" onClick={download}>Save image</button>
        {canShare && <button type="button" onClick={share}>Share…</button>}
        <button type="button" onClick={copy}>Copy link</button>
      </div>
      <p className="story-share-status" role="status">{status}</p>
    </div>
  </section>;
}
