/**
 * Putting the map's regions into the DOM by hand, rather than through React.
 *
 * Measured on 2026-09-18: rewriting all 564 path attributes and forcing layout costs
 * 2.1ms, while a whole frame through React cost 45 to 87. The browser was never the slow
 * part — building elements, diffing them and committing them was. A map region has no
 * state, no events and no children that change shape; it is a `d` and a colour. That is
 * the case React's machinery buys nothing for.
 *
 * Elements are reused rather than replaced, so the browser keeps its parsed geometry for
 * every region whose outline has not changed, and only the attributes that differ are
 * written. Reading the attribute before writing it is deliberate: a no-op `setAttribute`
 * still dirties style and layout, and most regions are unchanged on most frames.
 */

const SVG = "http://www.w3.org/2000/svg";

/** One region as it should appear: its outline, its fill, and how it is classed. */
export type Painted = {
  id: number | string;
  d: string;
  fill: string | null;
  className: string;
};

/**
 * Bring `group`'s children into line with `shapes`, reusing what is already there.
 *
 * Returns nothing: the group is the output. Children beyond the list are removed rather
 * than hidden, so the DOM never carries regions the camera has left behind.
 */
export function paint(group: SVGGElement, shapes: Painted[]): void {
  const children = group.childNodes;
  for (let i = 0; i < shapes.length; i += 1) {
    const shape = shapes[i];
    let node = children[i] as SVGPathElement | undefined;
    if (!node || node.nodeName !== "path") {
      node = document.createElementNS(SVG, "path");
      if (children[i]) group.replaceChild(node, children[i]);
      else group.appendChild(node);
    }
    if (node.getAttribute("d") !== shape.d) node.setAttribute("d", shape.d);
    const fill = shape.fill ?? "";
    if (node.getAttribute("fill") !== fill) {
      if (fill) node.setAttribute("fill", fill);
      else node.removeAttribute("fill");
    }
    if (node.getAttribute("class") !== shape.className) {
      node.setAttribute("class", shape.className);
    }
  }
  while (children.length > shapes.length) {
    group.removeChild(group.lastChild!);
  }
}
