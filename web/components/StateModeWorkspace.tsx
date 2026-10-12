"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Measure } from "@/lib/measures";
import { CountyComparison } from "@/components/CountyComparison";
import type { Section } from "@/lib/groups";

export function StateModeWorkspace({ sections, initial }: {
  sections: Section<Measure>[];
  initial: string;
}) {
  const router = useRouter();
  const [windowNotes, setWindowNotes] = useState<string[]>([]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "afford") return;
    params.delete("mode");
    router.replace(`/afford?${params}`);
  }, [router]);

  return <section className="state-workspace place-first-workspace direct-county-comparison" aria-labelledby="state-workspace-heading">
    <header className="state-workspace-head">
      <h2 id="state-workspace-heading">Compare counties</h2>
      <Link className="state-fit-shortcut" href="/afford?county=all">Find your fit <small>Across New Jersey</small></Link>
    </header>
    <div className="place-discovery">
      {windowNotes.length > 0 && <aside className="window-aside"><p className="window-aside-label">About “Since 2019”</p>{windowNotes.map(note => <p key={note}>{note}</p>)}</aside>}
      <CountyComparison sections={sections} initial={initial} embedded onWindowNotesChange={setWindowNotes} />
    </div>
  </section>;
}
