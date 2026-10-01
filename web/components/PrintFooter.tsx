import { PrintAddress } from "@/components/PrintAddress";
import { api } from "@/lib/api";
import { cssString } from "@/lib/print";
import { isRestricted, licenceLine } from "@/lib/sources";

/**
 * The line at the foot of every printed page (Milestone 31): the non-commercial terms,
 * with the address the page was printed from beside them, so a single page cut from a
 * saved PDF still carries its terms and its way back.
 *
 * In the page's margin boxes (`@page { @bottom-left }`), which print engines draw in the
 * margin of every sheet and never over the content. A fixed-position footer was tried
 * first: it repeats per sheet too, but inside the content area, where it covered the
 * last row of a table that reached the foot of a page. Margin boxes print in Chromium;
 * an engine without them prints no footer, and the licence line at the top of the first
 * page, which opens for print, still carries the terms (ARCHITECTURE #270).
 *
 * Named from the sources, as that licence line is, so a new restricted source is covered
 * without editing this.
 */
export async function PrintFooter() {
  const sources = await api.sources();
  const line = licenceLine((sources ?? []).filter(isRestricted).map((s) => s.name));
  const terms = line ? `Not for commercial use: ${line}` : "";
  return (
    <>
      <style>{`@media print {
  @page {
    margin-bottom: 16mm;
    @bottom-left {
      content: ${cssString(terms)};
      font: 7pt/1.3 ui-monospace, monospace; color: #000; vertical-align: top;
      padding-top: 3mm;
    }
  }
}`}</style>
      <PrintAddress />
    </>
  );
}
