"use client";

import { useEffect, useState } from "react";
import { PlaceSectionNav, type PlaceSection } from "./PlaceSectionNav";

const slug = (text: string) => text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A story's shortcut bar, read from its own section headings once it renders: each
 *  `h2.story-h`, then the sources. A story with no section headings gets no bar. */
export function StoryShortcuts() {
  const [sections, setSections] = useState<PlaceSection[]>([]);
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>("#main-content h2.story-h"));
    if (!headings.length) return;
    for (const heading of headings) if (!heading.id) heading.id = `story-${slug(heading.textContent ?? "")}`;
    setSections([...headings.map((h) => ({ id: h.id, label: h.textContent?.trim() ?? "" })), { id: "story-sources", label: "Sources" }]);
  }, []);
  return sections.length ? <PlaceSectionNav sections={sections} label="Story sections" /> : null;
}
