import Link from "next/link";

import { Masthead } from "@/components/Masthead";

export default function NotFound() {
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main className="shell">
        <h1 className="page-title">Page not found</h1>
        <p className="meta">
          This address does not point to a published housing page. <Link href="/">Back to New Jersey</Link>.
        </p>
      </main>
    </>
  );
}
