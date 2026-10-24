import Link from "next/link";
import { STORIES } from "@/lib/stories";
import { ThemedShot } from "./ThemedShot";

export function HomeStories() {
  return <section className="home-stories" aria-labelledby="home-stories-heading">
    <Link className="home-stories-gateway" href="/stories" prefetch={false}>
      <div className="home-stories-copy">
        <h2 id="home-stories-heading">Visual stories</h2>
        <p className="home-stories-count"><strong>{STORIES.length} stories</strong><span aria-hidden="true"> · </span>New Jersey</p>
      </div>
      {/* Real chart fragments form one decorative composition, not new plotted data
          or separate destinations. The collection supplies full charts and sources. */}
      <div className="home-stories-gallery" aria-hidden="true">
        <ThemedShot name="stories/the-wawa-line" width={788} height={489} className="gallery-fragment gallery-map" />
        <ThemedShot name="stories/twin-towns" width={788} height={489} className="gallery-fragment gallery-dots" />
        <ThemedShot name="stories/the-flood-claims-calendar" width={788} height={489} className="gallery-fragment gallery-calendar" />
      </div>
    </Link>
  </section>;
}
