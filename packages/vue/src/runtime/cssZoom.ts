/**
 * Effective CSS `zoom` between a teleported overlay element and the
 * viewport root.
 *
 * Standardized CSS zoom (Chrome 128+, Firefox 126+, Safari 18.2+) made
 * `getBoundingClientRect()` report the ROOT VISUAL space — ancestor zoom
 * is already multiplied into every rect — while `position: fixed` px
 * assigned on an element that LIVES inside the zoomed subtree are
 * interpreted in that element's own local space and scaled back up at
 * paint. Overlay components that measure anchors with gBCR and position
 * themselves with fixed px therefore land zoom× away from their anchor
 * unless the written px are divided by the cumulative zoom (chest's
 * root-level manual DPI scale is the producer of such subtrees; at a
 * 300% scale an anchored menu flew three viewport-widths off screen).
 *
 * `zoom` is not inherited, so the factor is the product of the explicit
 * zoom values along the element → documentElement chain. Links without
 * DOM zoom support (old engines, happy-dom/jsdom), `normal`, garbage or
 * non-positive numbers contribute nothing; the default stays 1 — the
 * identity the fixed-positioning math has always assumed. No DOM at all
 * (SSR guards) also collapses to 1.
 */
export function ancestorZoom(el: Element | null | undefined): number {
  if (typeof window === "undefined" || !el) return 1;
  let zoom = 1;
  let cur: Element | null = el;
  while (cur) {
    // `zoom` is missing from older DOM style declarations — read it off a
    // widened record instead of assuming the lib carries the property.
    const raw = (window.getComputedStyle(cur) as CSSStyleDeclaration & { zoom?: string | number }).zoom;
    const v = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;
    if (Number.isFinite(v) && v > 0) zoom *= v;
    cur = cur.parentElement;
  }
  return zoom > 0 ? zoom : 1;
}
