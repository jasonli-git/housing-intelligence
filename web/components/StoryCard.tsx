import Link from "next/link";
import { ThemedShot } from "./ThemedShot";
import { collectionFor, storyPreview, storySlug, type Story } from "@/lib/storyLibrary";

export function StoryCover({ story }: { story: Story }) {
  return <div className="library-cover" data-topic={collectionFor(story)} data-story={storySlug(story)}>
    {/* Cropped detail of the actual chart, not fabricated quantitative artwork. */}
    <ThemedShot name={`stories/${storySlug(story)}`} width={788} height={489} className="library-chart-detail" />
    <span className="library-cover-open" aria-hidden="true">↗</span>
  </div>;
}

export function StoryCard({ story }: { story: Story }) {
  return <Link className="library-card" href={story.href} prefetch={false}>
    <StoryCover story={story} />
    <h3>{story.title}</h3>
    <p>{storyPreview(story)}</p>
  </Link>;
}
