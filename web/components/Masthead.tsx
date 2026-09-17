import Link from "next/link";

import { PlaceSearch } from "@/components/PlaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

const REPOSITORY = "https://github.com/jasonli-git/housing-intelligence";

/**
 * The bar shared with jasonli.app: `Jason Li` leads home to the gateway, then this
 * site's own wordmark, then search, the reader's choice of theme, and the code.
 *
 * The trail is set in jasonli.app's type and ink, whatever the page below it, because
 * it is the one element that says these are the same person's sites (ARCHITECTURE
 * #122). Jasonli.app's own masthead is not a link — it *is* that page — so the inversion
 * is deliberate: here the same wordmark is the way back.
 *
 * `Jason Li` navigates in place, as jasonli.app's own project links do: the two are one
 * ecosystem, not a site and an external one. Search replaced the county picker in
 * Milestone 23, and the GitHub mark joined it so a reader can reach the repository behind
 * every figure from any page.
 */
export function Masthead() {
  return (
    <nav className="bar print-hide" aria-label="Sites">
      <div className="bar-inner">
        <div className="bar-trail">
          <a className="bar-home" href="https://jasonli.app">
            Jason Li
          </a>
          <span className="bar-sep" aria-hidden="true">
            /
          </span>
          <Link className="wordmark" href="/">
            <span className="live-dot" aria-hidden="true" />
            Housing
          </Link>
        </div>
        <div className="bar-tools">
          <Link className="bar-afford" href="/afford">
            Affordability
          </Link>
          <PlaceSearch />
          <ThemeToggle />
          <a
            className="bar-icon"
            href={REPOSITORY}
            rel="noreferrer noopener"
            target="_blank"
            title="The code behind this site, on GitHub"
            aria-label="The code behind this site, on GitHub (opens in a new tab)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
