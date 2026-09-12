import Link from "next/link";

import { CountyPicker } from "@/components/CountyPicker";
import { api } from "@/lib/api";

/**
 * The bar shared with jasonli.app: `Jason Li` leads home to the gateway, then this
 * site's own wordmark, then a way into any county.
 *
 * The trail is set in jasonli.app's type and ink, whatever the page below it, because
 * it is the one element that says these are the same person's sites (ARCHITECTURE
 * #122). Jasonli.app's own masthead is not a link — it *is* that page — so the inversion
 * is deliberate: here the same wordmark is the way back.
 *
 * `Jason Li` navigates in place, as jasonli.app's own project links do: the two are one
 * ecosystem, not a site and an external one.
 */
export async function Masthead() {
  const counties = await api.regions("level=county&state=NJ&limit=100");
  const options = (counties?.items ?? [])
    .map((c) => ({ id: c.region_id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
        {options.length > 0 && <CountyPicker counties={options} />}
      </div>
    </nav>
  );
}
