/**
 * A script that runs while the page is parsed, before the first paint — the pattern in
 * Next's guide to preventing flash before hydration.
 *
 * Rendered as `text/javascript` on the server and `text/plain` on the client, so it
 * runs once, on a full page load, and React does not warn about rendering a script;
 * `suppressHydrationWarning` accepts the difference in `type`.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
