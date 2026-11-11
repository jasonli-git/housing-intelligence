import styles from "@/components/AffordExplorer.module.css";

import type { Metadata } from "next";
import Link from "next/link";

import { AffordRedirect } from "@/components/AffordRedirect";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { affordData } from "@/lib/affordData";
import "../tool-pages.css";
import "../horizon-theme.css";
import "../afford-horizon.css";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Budget explorer — Housing",
  description:
    "Enter your income and see the New Jersey towns where the typical home fits your budget.",
  path: "/afford",
});

/**
 * "What can I afford here" (Milestone 17): an income in, the places within reach out.
 *
 * Every county's and municipality's typical home value, rent and tax bill ride in the
 * page — about 600 places, small enough to answer every change in the browser with no
 * request, and on one page rather than 1,134. The map is the New Jersey page's globe,
 * held at municipal level and painted in three states rather than by quantile — the
 * carry the ROADMAP planned and #144 deferred to Milestone 16.
 */
export default function AffordPage() {
  // (#496) the Budget explorer lives on the housing map now.
  return <main id="main-content" tabIndex={-1} className="shell"><AffordRedirect /></main>;
}
