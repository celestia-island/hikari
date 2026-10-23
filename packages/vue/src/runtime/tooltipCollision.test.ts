import { afterEach, describe, expect, it } from "vitest";

import { ensureOverlayRoot } from "../overlay/overlayRoot";
import {
  TOOLTIP_OVERLAP_ATTR,
  clearCrossShift,
  collectTooltipObstacles,
  tooltipOverlapArea,
  tooltipRectsOverlap,
} from "./tooltipCollision";

/**
 * Tooltip collision contract tests:
 * - geometry: strict overlap (shared edges and subpixel grazes are NOT
 *   collisions), summed overlap area, nearest clear shift on one axis
 *   with the clamp range authoritative
 * - obstacle collection: visible `.hk-tooltip-popup` siblings of the
 *   mover's home only — never the mover itself, never
 *   data-hk-tooltip-overlap-exempt elements, never zero-rect (hidden,
 *   no-layout) boxes
 */

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height };
}

afterEach(() => {
  document
    .querySelectorAll(".hk-tooltip-popup, [data-collision-probe]")
    .forEach((el) => el.remove());
});

describe("tooltipRectsOverlap", () => {
  it("rejects shared edges and subpixel grazes", () => {
    const a = rect(0, 0, 100, 40);
    expect(tooltipRectsOverlap(a, rect(100, 0, 50, 40))).toBe(false); // touching edge
    expect(tooltipRectsOverlap(a, rect(100 - 0.2, 0, 50, 40))).toBe(false); // rounding graze
  });

  it("accepts a real intersection", () => {
    expect(tooltipRectsOverlap(rect(0, 0, 100, 40), rect(50, 20, 100, 40))).toBe(true);
  });
});

describe("tooltipOverlapArea", () => {
  it("sums the intersection with every obstacle", () => {
    const area = tooltipOverlapArea(rect(0, 0, 100, 40), [
      rect(50, 20, 100, 40), // 50 × 20 = 1000
      rect(0, 0, 100, 40), // 100 × 40 = 4000
      rect(200, 200, 10, 10), // clear — adds nothing
    ]);
    expect(area).toBeCloseTo(5000);
  });
});

describe("clearCrossShift", () => {
  const FORBIDDEN = [{ lo: 60 - 8, hi: 180 + 8 }]; // obstacle [60..180] + clearance

  it("keeps the preferred position when it is already clear", () => {
    // Preferred 200 sits right of the forbidden span [−68..188] for a
    // 120px box.
    expect(clearCrossShift(200, 120, FORBIDDEN, 8, 247)).toBe(0);
  });

  it("parks on the nearest edge of the nearest clear gap", () => {
    // Preferred 60 is inside the forbidden span; the only gap in
    // [8..247] is [188..247], so the box lands at its left edge.
    expect(clearCrossShift(60, 120, FORBIDDEN, 8, 247)).toBe(188 - 60);
  });

  it("returns null when no position in the range avoids the obstacle", () => {
    expect(clearCrossShift(60, 120, [{ lo: 0, hi: 375 }], 8, 247)).toBeNull();
  });

  it("returns null when the box cannot fit the clamp at all", () => {
    expect(clearCrossShift(8, 400, [], 8, -33)).toBeNull();
  });

  it("honors multiple obstacles by walking the merged gaps", () => {
    // Forbidden spans [8..50] and [100..200]: gaps are [50..100] and
    // [200..247]; preferred 140 parks at 100.
    expect(
      clearCrossShift(140, 0, [{ lo: 8, hi: 50 }, { lo: 100, hi: 200 }], 8, 247),
    ).toBe(-40);
  });
});

describe("collectTooltipObstacles", () => {
  function sibling(left: number, opts: { visible?: boolean; exempt?: boolean } = {}) {
    const el = document.createElement("div");
    el.className = "hk-tooltip-popup" + (opts.visible === false ? "" : " hk-tooltip-visible");
    if (opts.exempt) el.setAttribute(TOOLTIP_OVERLAP_ATTR, "");
    el.getBoundingClientRect = () =>
      ({ left, top: 0, width: 100, height: 40, right: left + 100, bottom: 40, toJSON: () => ({}) }) as DOMRect;
    return el;
  }

  function probe(): HTMLElement {
    const el = document.createElement("div");
    el.className = "hk-tooltip-popup hk-tooltip-visible";
    el.setAttribute("data-collision-probe", "");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
    return el;
  }

  it("collects visible sibling popups in the mover's home", () => {
    const home = ensureOverlayRoot();
    const mover = probe();
    home.appendChild(mover);
    home.appendChild(sibling(40));
    home.appendChild(sibling(200));
    expect(collectTooltipObstacles(mover)).toHaveLength(2);
  });

  it("drops the mover, exempt, invisible and zero-rect siblings", () => {
    const home = ensureOverlayRoot();
    const mover = probe();
    home.appendChild(mover);
    home.appendChild(sibling(40)); // counted
    home.appendChild(sibling(80, { exempt: true })); // opted out
    home.appendChild(sibling(120, { visible: false })); // not shown
    const hidden = sibling(160, { visible: true });
    hidden.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
    home.appendChild(hidden); // no layout
    expect(collectTooltipObstacles(mover)).toHaveLength(1);
  });

  it("scopes to the overlay root when the popup lives there", () => {
    const home = ensureOverlayRoot();
    const mover = probe();
    home.appendChild(mover);
    home.appendChild(sibling(40));
    // A body-level popup is OUTSIDE the root — not the mover's home.
    document.body.appendChild(sibling(300));
    expect(collectTooltipObstacles(mover)).toHaveLength(1);
  });

  it("falls back to the parent element outside the overlay root", () => {
    const pen = document.createElement("div");
    document.body.appendChild(pen);
    const mover = probe();
    pen.appendChild(mover);
    pen.appendChild(sibling(40));
    document.body.appendChild(sibling(300)); // not a sibling — ignored
    expect(collectTooltipObstacles(mover)).toHaveLength(1);
  });
});
