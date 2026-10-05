"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Server-rendered fallback text, progressively enhanced above clipped containers. */
export function FloatingDefinition({ label, content, up = false }: { label: ReactNode; content: ReactNode; up?: boolean }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 16, top: 16, width: 288 });
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const show = () => { cancelClose(); setOpen(true); };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => { if (document.activeElement !== anchor.current) setOpen(false); }, 150);
  };
  useEffect(() => { setEnhanced(true); return () => cancelClose(); }, []);

  const place = useCallback(() => {
    if (!anchor.current || !tooltip.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 32);
    const height = tooltip.current.getBoundingClientRect().height;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 16 ? below : Math.max(16, rect.top - height - 8);
    setPosition({ left, top, width });
  }, []);
  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") { cancelClose(); setOpen(false); } };
    document.addEventListener("keydown", dismiss);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return <>
    <span className="gl" data-enhanced={enhanced || undefined}>
      <span ref={anchor} className="term" tabIndex={0} aria-describedby={open ? `${id}-floating` : `${id}-inline`}
        onMouseEnter={show} onMouseLeave={scheduleClose} onFocus={show} onBlur={() => { cancelClose(); setOpen(false); }}
        onKeyDown={event => {
          const tip = tooltip.current;
          if (!open || !tip || tip.scrollHeight <= tip.clientHeight) return;
          const moves: Record<string, number> = { ArrowDown: 40, ArrowUp: -40, PageDown: tip.clientHeight, PageUp: -tip.clientHeight, Home: -tip.scrollHeight, End: tip.scrollHeight };
          if (event.key in moves) { event.preventDefault(); tip.scrollBy({ top: moves[event.key] }); }
        }}>
        {label}
      </span>
      {/* Kept in static HTML for no-script hover/focus, print and described-by text. */}
      <span role="tooltip" id={`${id}-inline`} className={up ? "tip up" : "tip"} aria-hidden={enhanced || undefined}>{content}</span>
    </span>
    {open && createPortal(<span ref={tooltip} role="tooltip" id={`${id}-floating`} className="floating-tip"
      style={position} onMouseEnter={show} onMouseLeave={scheduleClose}>{content}</span>, document.body)}
  </>;
}
