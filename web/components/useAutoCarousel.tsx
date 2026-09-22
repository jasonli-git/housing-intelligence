"use client";

import {
  type FocusEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const AUTO_CAROUSEL_MS = 12000;

/**
 * Shared timing for the experimental region-page carousels. It only advances while the
 * surface is on screen, pauses while a reader hovers or works inside it, and turns motion
 * off altogether when the operating system asks for reduced motion.
 */
export function useAutoCarousel(enabled: boolean, onAdvance: () => void) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [cycle, setCycle] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const advance = useRef(onAdvance);

  useEffect(() => {
    advance.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduceMotion(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    const read = () => setPageVisible(document.visibilityState === "visible");
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(Boolean(node));
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const paused = hovered || focused || !inView || !pageVisible;

  useEffect(() => {
    if (!enabled || paused || reduceMotion) return;
    const timer = window.setTimeout(() => {
      advance.current();
      setCycle((current) => current + 1);
    }, AUTO_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [cycle, enabled, paused, reduceMotion]);

  const restart = useCallback(() => setCycle((current) => current + 1), []);
  const onMouseEnter = useCallback((_event: MouseEvent<HTMLElement>) => setHovered(true), []);
  const onMouseLeave = useCallback((_event: MouseEvent<HTMLElement>) => {
    setHovered(false);
    restart();
  }, [restart]);
  const onFocusCapture = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(true), []);
  const onBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setFocused(false);
    restart();
  }, [restart]);

  return {
    rootRef: setNode,
    cycle,
    paused,
    focused,
    reduceMotion,
    restart,
    interactionProps: { onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture },
  };
}

export function CarouselProgress({
  cycle,
  paused,
  className = "",
}: {
  cycle: number;
  paused: boolean;
  className?: string;
}) {
  return (
    <span className={`carousel-progress ${className}`} aria-hidden="true">
      <span
        key={cycle}
        className="carousel-progress-fill"
        style={{
          animationDuration: `${AUTO_CAROUSEL_MS}ms`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </span>
  );
}
