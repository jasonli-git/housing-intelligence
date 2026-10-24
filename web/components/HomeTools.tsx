import Link from "next/link";
import { ThemedShot } from "./ThemedShot";
import { ToolRail } from "./ToolRail";

export const HOME_TOOLS = [
  { href: "/afford", shot: "budget-explorer", title: "Budget explorer", text: "Find places within your budget." },
  { href: "/guide", shot: "buyers-guide", title: "Buyer’s guide", text: "Plan costs and pre-offer checks." },
  { href: "/tax", shot: "tax-lookup", title: "Property tax lookup", text: "Check assessments and tax bills." },
  { href: "/compare", shot: "compare", title: "Compare places", text: "Costs and incomes, side by side." },
  { href: "/help", shot: "housing-help", title: "Housing help", text: "Affordable homes, vouchers and local help." },
  { href: "/atlas", shot: "atlas", title: "Housing atlas", text: "Explore housing data by map." },
] as const;

export function HomeTools() {
  return <section className="home-tools" aria-labelledby="home-tools-heading">
    <header className="home-tools-heading"><h2 id="home-tools-heading">Tools</h2><p id="home-tools-coverage">New Jersey coverage</p></header>
    <ToolRail>{HOME_TOOLS.map((tool) => <li key={tool.href}>
      <Link href={tool.href} data-tool={tool.href.slice(1)} aria-describedby="home-tools-coverage" prefetch={false}>
        <ThemedShot name={`tools/${tool.shot}`} width={1440} height={900} className="home-tool-preview" />
        <span className="home-tool-copy">
          <span className="home-tool-title">{tool.title} <span aria-hidden="true">→</span></span>
          <span className="home-tool-text">{tool.text}</span>
        </span>
      </Link>
    </li>)}</ToolRail>
  </section>;
}
