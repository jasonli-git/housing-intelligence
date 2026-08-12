"use client";

/**
 * The only interactive element on the report page, and the smallest possible client
 * island: printing is a browser action, so it cannot be server-rendered. Everything
 * around it stays a server component.
 *
 * "Save as PDF" is the browser's own print dialog rather than a PDF library — the
 * page already carries print styles, and adding a renderer to produce a file the
 * browser can already produce would be a dependency for nothing (ARCHITECTURE #39,
 * same reasoning).
 */
export function PrintButton() {
  return (
    <button type="button" className="print-hide" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
