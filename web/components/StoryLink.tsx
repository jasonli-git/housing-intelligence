import Link from "next/link";

import { STORIES } from "@/lib/stories";

/**
 * A pointer from a section to the visual story drawing the same figures statewide. The
 * stories have no place in the bar, so these and the home page are how a reader finds them.
 */
export function StoryLink({ href }: { href: string }) {
  const story = STORIES.find((s) => s.href === href);
  if (!story) return null;
  return (
    <p className="story-link print-hide">
      <Link href={story.href}><span>Visual story</span> {story.title}, across New Jersey →</Link>
    </p>
  );
}
