import Link from "next/link";
import { ThemedShot } from "./ThemedShot";

export const HOME_TOOLS = [
  { href: "/afford", shot: "budget-explorer", title: "Budget explorer", text: "See where a typical home fits your income." },
  { href: "/guide", shot: "buyers-guide", title: "Buyer’s guide", text: "Afford, rent or buy, and what to check before an offer." },
  { href: "/tax", shot: "tax-lookup", title: "Property tax lookup", text: "Find a property’s assessment and last year’s tax bill." },
  { href: "/compare", shot: "compare", title: "Compare places", text: "Costs, incomes and homes in up to four places." },
  { href: "/help", shot: "housing-help", title: "Housing help", text: "Find affordable homes, vouchers and housing authorities." },
  { href: "/atlas", shot: "atlas", title: "Housing atlas", text: "Explore housing figures on a map." },
] as const;

export function HomeTools() {
  return <section className="home-tools" aria-labelledby="home-tools-heading">
    <h2 id="home-tools-heading">Tools</h2>
    <p className="home-tools-note">Example views. Open a tool to use your own figures.</p>
    <ul>{HOME_TOOLS.map((tool) => <li key={tool.href}>
      <Link href={tool.href} data-tool={tool.href.slice(1)} prefetch={false}>
        <ThemedShot name={`tools/${tool.shot}`} width={1440} height={900} className="home-tool-preview" />
        <span className="home-tool-copy">
          <span className="home-tool-title">{tool.title} <span aria-hidden="true">→</span></span>
          <span className="home-tool-text">{tool.text}</span>
          <span className="home-tool-scope">New Jersey</span>
        </span>
      </Link>
    </li>)}</ul>
  </section>;
}
