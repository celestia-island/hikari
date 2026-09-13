import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TOOLTIP_GAP_PX,
  applyTooltipPosition,
  resolveTooltipFlip,
  tooltipPositionStyle,
} from "./tooltipPosition";

/** A 100x40 rect at (200,100) — big enough for every placement side. */
function rect(): DOMRect {
  return {
    left: 200, top: 100, right: 300, bottom: 140,
    width: 100, height: 40, x: 200, y: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

function box(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left, top, width, height,
    right: left + width, bottom: top + height,
    x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A probe element whose gBCR answers with a queued rect sequence. */
function probePopup(rects: DOMRect[]): HTMLElement {
  const el = document.createElement("div");
  el.dataset.tooltipProbe = "true";
  document.body.appendChild(el);
  let i = 0;
  el.getBoundingClientRect = () => rects[Math.min(i++, rects.length - 1)]!;
  return el;
}

const PREV_INNER = { width: window.innerWidth, height: window.innerHeight };

afterEach(() => {
  window.innerWidth = PREV_INNER.width;
  window.innerHeight = PREV_INNER.height;
  vi.restoreAllMocks();
  document.querySelectorAll(".hk-tooltip-popup, [data-tooltip-probe]").forEach((el) => el.remove());
});

describe("tooltipPositionStyle", () => {
  it("pins the popup 8px outside the rect with per-placement transforms", () => {
    expect(TOOLTIP_GAP_PX).toBe(8);
    const top = tooltipPositionStyle(rect(), "top");
    expect(top.top).toBe("92px"); // 100 - 8
    expect(top.left).toBe("250px"); // hcenter
    expect(top.transform).toBe("translate(-50%, -100%)");

    const bottom = tooltipPositionStyle(rect(), "bottom");
    expect(bottom.top).toBe("148px"); // 140 + 8
    expect(bottom.transform).toBe("translate(-50%, 0)");

    const left = tooltipPositionStyle(rect(), "left");
    expect(left.left).toBe("192px"); // 200 - 8
    expect(left.top).toBe("120px"); // vcenter
    expect(left.transform).toBe("translate(-100%, -50%)");

    const right = tooltipPositionStyle(rect(), "right");
    expect(right.left).toBe("308px"); // 300 + 8
    expect(right.transform).toBe("translate(0, -50%)");
  });

  it("carries the maxWidth override onto the popup style", () => {
    const style = tooltipPositionStyle(rect(), "top", "180px");
    expect(style.maxWidth).toBe("180px");
    expect(tooltipPositionStyle(rect(), "top").maxWidth).toBeUndefined();
  });

  it("sizes the popup to its content so the containing block cannot compress it", () => {
    // THE compression fix: a fixed element shrink-to-fits against
    // `viewport - left`, so a trigger near the right edge used to squeeze
    // the bubble into a one-glyph column. max-content is position-
    // independent (same contract as .hk-popover-panel).
    expect(tooltipPositionStyle(rect(), "top").width).toBe("max-content");
    expect(tooltipPositionStyle(rect(), "right", "120px").width).toBe("max-content");
  });
});

describe("applyTooltipPosition without layout", () => {
  it("degrades to the pure placement style when the box measures zero", () => {
    const popup = probePopup([box(0, 0, 0, 0)]);
    applyTooltipPosition(popup, rect(), "top");
    expect(popup.style.top).toBe("92px");
    expect(popup.style.left).toBe("250px");
    expect(popup.style.transform).toBe("translate(-50%, -100%)");
    expect(popup.style.width).toBe("max-content");
    // No clamp pass ran: no caps, no gutter writes.
    expect(popup.style.maxWidth).toBe("");
    expect(popup.style.maxHeight).toBe("");
  });

  it("still honors the maxWidth prop on the zero-layout path", () => {
    const popup = probePopup([box(0, 0, 0, 0)]);
    applyTooltipPosition(popup, rect(), "top", "220px");
    expect(popup.style.maxWidth).toBe("220px");
  });
});

describe("applyTooltipPosition viewport clamping", () => {
  it("shifts a centered bubble back inside the right-edge gutter", () => {
    // Mobile viewport (375px → 8px gutter). Trigger at 300..340, the
    // centered 120px bubble would span 260..380 — 13px past the gutter.
    window.innerWidth = 375;
    window.innerHeight = 667;
    const trigger = box(300, 300, 40, 40);
    const popup = probePopup([box(260, 348, 120, 32)]);
    applyTooltipPosition(popup, trigger, "bottom");
    // The shift lands on the WRITTEN anchor (style.left is the box
    // center under translate(-50%)): 320 - 13 = 307, visual box 247..367.
    expect(popup.style.left).toBe("307px");
    expect(popup.style.top).toBe("348px");
    expect(popup.style.maxWidth).toBe("");
  });

  it("flips to the opposite side when the preferred one is starved", () => {
    // Trigger hugging the top edge: a top popup cannot clear the gutter,
    // bottom has room → the popup flips below the trigger.
    window.innerWidth = 375;
    window.innerHeight = 667;
    const trigger = box(100, 2, 40, 18);
    const popup = probePopup([box(120, -22, 200, 32), box(120, 28, 200, 32)]);
    applyTooltipPosition(popup, trigger, "top");
    expect(popup.style.transform).toBe("translate(-50%, 0)");
    expect(popup.style.top).toBe("28px"); // rect.bottom + 8
    expect(popup.style.left).toBe("120px"); // hcenter, unshifted
  });

  it("caps a bubble that cannot fit between the gutters, then shifts", () => {
    // A 400px bubble on a 375px viewport: max-width caps it to
    // 375 - 2*8 = 359px and the centered remainder shifts inside.
    window.innerWidth = 375;
    window.innerHeight = 667;
    const trigger = box(100, 300, 40, 40);
    const popup = probePopup([box(-80, 232, 400, 60), box(-80, 232, 359, 60)]);
    applyTooltipPosition(popup, trigger, "top");
    expect(popup.style.maxWidth).toBe("359px");
    // Base anchor 120 - shift dx 88 (visual -80 → gutter 8) = 208.
    expect(popup.style.left).toBe("208px");
  });

  it("clips a viewport-tall tooltip instead of spilling past the edge", () => {
    window.innerWidth = 375;
    window.innerHeight = 667;
    // Preferred side keeps the flip away (top space 392 > bottom 219) so
    // the case isolates the height cap + clip.
    const trigger = box(160, 400, 40, 40);
    const popup = probePopup([box(100, 20, 160, 700), box(100, 20, 160, 651)]);
    applyTooltipPosition(popup, trigger, "top");
    expect(popup.style.maxHeight).toBe("651px"); // 667 - 2*8
    expect(popup.style.overflow).toBe("hidden");
  });

  it("writes the shift divided by the cumulative root zoom", () => {
    // chest's root-level DPI zoom: style px are local (divided by the
    // zoom) while the measured box and the viewport are visual.
    window.innerWidth = 1200;
    window.innerHeight = 800;
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
      const decl = original(el);
      return new Proxy(decl, {
        get(target, prop, recv) {
          if (prop === "zoom") return el === document.documentElement ? "2" : undefined;
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    }) as typeof window.getComputedStyle);
    const trigger = box(1180, 100, 20, 40);
    // Base right placement at zoom 2: left = (1200+8)/2 = 604 local, the
    // 300px bubble spans visual 1208..1508 — past the gutter AND the
    // starved right side, so it flips left and shifts the remainder.
    const popup = probePopup([box(1208, 100, 300, 40), box(886, 100, 300, 40)]);
    applyTooltipPosition(popup, trigger, "right");
    expect(popup.style.transform).toBe("translate(-100%, -50%)");
    // Flip rewrite: (1180 - 8)/2 = 586 local; visual box 886..1186, 2px
    // past the 1184 gutter line → dx -2 visual = -1 local: 586 - 1 = 585.
    expect(popup.style.left).toBe("585px");
  });

  it("keeps the width cap through a flip (cap + flip combined)", () => {
    // R1 verification defect: applyBase on the flipped side used to reset
    // maxWidth, so the uncapped box was measured and pinned — one edge at
    // the gutter, the opposite 33px PAST the viewport. The cap belongs to
    // the box, not the side: it must survive the flip.
    window.innerWidth = 375;
    window.innerHeight = 667;
    const trigger = box(300, 300, 40, 40); // right edge at 340
    const popup = probePopup([
      box(348, 304, 400, 32), // base "right": 400px wide → cap 359px
      box(348, 304, 359, 32), // capped re-measure → right side starved
      box(-67, 304, 359, 32), // flipped "left": uncapped-width visual box
    ]);
    applyTooltipPosition(popup, trigger, "right");
    expect(popup.style.maxWidth).toBe("359px"); // must survive the flip
    expect(popup.style.transform).toBe("translate(-100%, -50%)");
    // Shift pins 292 + 75 = 367 → visual box 8..367, exactly inside the
    // gutters on BOTH edges (375 - 8 = 367).
    expect(popup.style.left).toBe("367px");
  });

  it("keeps the height cap and clip through a flip (cap + flip combined)", () => {
    // The near-top-edge tall tooltip: guaranteed flip (the top side
    // cannot hold it) — the height cap must not be reset by the flip
    // rewrite, or the pinned box spills 41px past the bottom edge.
    window.innerWidth = 375;
    window.innerHeight = 667;
    const trigger = box(160, 4, 40, 18);
    const popup = probePopup([
      box(100, -704, 160, 700), // base "top": 700px tall → cap 651px
      box(100, -704, 160, 651), // capped re-measure → top starved
      box(100, 30, 160, 651), // flipped "bottom" visual box
    ]);
    applyTooltipPosition(popup, trigger, "top");
    expect(popup.style.maxHeight).toBe("651px");
    expect(popup.style.overflow).toBe("hidden");
    expect(popup.style.transform).toBe("translate(-50%, 0)");
    // 30 - 22 = 8 → visual box 8..659, inside the bottom gutter (667-8).
    expect(popup.style.top).toBe("8px");
  });
});

describe("resolveTooltipFlip", () => {
  const vw = 375;
  const vh = 667;
  const gutter = 8;

  it("keeps the placement when the preferred side fits", () => {
    const trigger = box(100, 100, 40, 40);
    expect(resolveTooltipFlip(trigger, "top", { width: 200, height: 32 }, vw, vh, gutter)).toBe("top");
  });

  it("flips to the opposite side when it has more room", () => {
    const trigger = box(100, 2, 40, 18);
    expect(resolveTooltipFlip(trigger, "top", { width: 200, height: 32 }, vw, vh, gutter)).toBe("bottom");
    const floorTrigger = box(100, 640, 40, 20);
    expect(resolveTooltipFlip(floorTrigger, "bottom", { width: 200, height: 32 }, vw, vh, gutter)).toBe("top");
  });

  it("keeps the placement when the opposite side is no better (the clamp handles it)", () => {
    // Both sides starved, opposite NOT strictly larger → keep the author's
    // placement; the gutter clamp pins the popup on-screen.
    const trigger = box(100, 2, 40, 663); // spaceAbove -6, spaceBelow -6
    expect(resolveTooltipFlip(trigger, "top", { width: 200, height: 400 }, vw, vh, gutter)).toBe("top");
  });
});
