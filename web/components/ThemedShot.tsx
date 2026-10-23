import { artifactUrl } from "@/lib/api";

/**
 * A screenshot taken from the build by capture-readme.mjs, in the reader's theme: both
 * are in the markup and CSS shows one, so the theme toggle switches them without script.
 * `name` is the path under screenshots/ without the "-light.jpg" or "-dark.jpg".
 */
export function ThemedShot({ name, width, height, className = "story-shot" }: { name: string; width: number; height: number; className?: string }) {
  const src = (scheme: string) => `${artifactUrl}/screenshots/${name}-${scheme}.jpg`;
  return (
    <span className={className} aria-hidden="true">
      <img className="shot-light" src={src("light")} alt="" loading="lazy" decoding="async" width={width} height={height} />
      <img className="shot-dark" src={src("dark")} alt="" loading="lazy" decoding="async" width={width} height={height} />
    </span>
  );
}
