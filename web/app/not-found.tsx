import Link from "next/link";

import { Masthead } from "@/components/Masthead";
import { PlaceSearch } from "@/components/PlaceSearch";

export default function NotFound() {
  return (
    <>
      <Masthead affordability={{ kind: "hidden" }} search={false} />
      <main id="main-content" tabIndex={-1} className="shell recovery-page">
        <div className="recovery-art" aria-hidden="true"><span>404</span><img src="/icon.svg" width="96" height="96" alt="" /></div>
        <header className="page-head">
          <p className="quiet-label">Page not found</p>
          <h1 className="page-title">A new starting point.</h1>
          <p className="meta">That page isn’t available. Find a place, or explore what’s here.</p>
        </header>
        <section className="recovery-search" aria-label="Find another place">
          <PlaceSearch variant="hero" />
          <p className="meta">Detailed coverage starts with New Jersey.</p>
        </section>
        <nav className="recovery-routes" aria-label="Where to go next">
          <Link href="/states/new-jersey">Explore New Jersey <span aria-hidden="true">↗</span></Link>
          <Link href="/">Housing Intelligence <span aria-hidden="true">→</span></Link>
        </nav>
      </main>
    </>
  );
}
