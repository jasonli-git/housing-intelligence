/** A CSS string literal: `content:` takes one, and a quote or backslash must not end it. */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}
