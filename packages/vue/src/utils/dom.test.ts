import { describe, expect, it } from "vitest";

import { clearLeaveGeometry, pinLeaveGeometry } from "./dom";

/**
 * pinLeaveGeometry contract:
 * - freezes the in-flow box (right|left/top/width/height + border-box)
 *   of a leaving list item against its offsetParent — anchored to the
 *   containing block's right padding-box edge by default
 *   (right = clientWidth - (offsetLeft + offsetWidth)), or left-pinned
 *   with anchorX:"left" for inline-start-stable hosts (the tab track)
 * - a supplied LeaveBoxSnapshot (pre-patch) wins over live reads, so a
 *   later sibling's pin survives the synchronous absolute-lift of an
 *   earlier leaving sibling in the same patch pass
 * - reads every metric before writing any style, so no intermediate
 *   write can skew a later read (content-box rewrap hazard)
 * - is a no-op when layout info is unavailable (offsetParent null)
 */

interface StubElement {
  offsetParent: unknown;
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
  style: Record<string, string>;
}

function stubEl(parent: unknown, over: Partial<StubElement> = {}): StubElement {
  return {
    offsetParent: parent,
    offsetTop: 0,
    offsetLeft: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    style: {},
    ...over,
  };
}

describe("pinLeaveGeometry", () => {
  it("pins the in-flow box anchored to the parent's right padding edge", () => {
    const parent = { clientWidth: 384 };
    const el = stubEl(parent, { offsetTop: 0, offsetLeft: 0, offsetWidth: 384, offsetHeight: 83 });

    pinLeaveGeometry(el as unknown as Element);

    expect(el.style).toEqual({
      right: "0px",
      top: "0px",
      width: "384px",
      height: "83px",
      boxSizing: "border-box",
    });
  });

  it("measures the right offset from the parent's inner width, not the viewport", () => {
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 60, offsetLeft: 100, offsetWidth: 200, offsetHeight: 48 });

    pinLeaveGeometry(el as unknown as Element);

    // 400 - (100 + 200) = 100px from the containing block's right edge.
    expect(el.style.right).toBe("100px");
    expect(el.style.top).toBe("60px");
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("48px");
  });

  it("is a no-op without layout information (offsetParent null)", () => {
    const el = stubEl(null, { offsetWidth: 384, offsetHeight: 83 });

    pinLeaveGeometry(el as unknown as Element);

    expect(el.style).toEqual({});
  });

  it("pins left-anchored when anchorX is 'left' (tab-track hosts)", () => {
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 2, offsetLeft: 96, offsetWidth: 84, offsetHeight: 28 });

    pinLeaveGeometry(el as unknown as Element, { anchorX: "left" });

    // No right pin: a middle removal's ghost must sit at its in-flow
    // left offset, not re-anchored to the collapsing right edge.
    expect(el.style.right).toBeUndefined();
    expect(el.style.left).toBe("96px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("84px");
    expect(el.style.height).toBe("28px");
    expect(el.style.boxSizing).toBe("border-box");
  });

  it("prefers a supplied pre-patch box snapshot over live reads", () => {
    // Live metrics simulate the post-lift reflow (sibling already
    // absolute → this element shifted left by 60px); the snapshot must
    // win so the ghost pins where the option actually was.
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 2, offsetLeft: 36, offsetWidth: 84, offsetHeight: 28 });

    pinLeaveGeometry(el as unknown as Element, {
      anchorX: "left",
      box: { top: 2, left: 96, width: 84, height: 28 },
    });

    expect(el.style.left).toBe("96px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("84px");
    expect(el.style.height).toBe("28px");
    expect(el.style.boxSizing).toBe("border-box");
  });

  it("clearLeaveGeometry strips exactly the pins pinLeaveGeometry wrote", () => {
    const parent = { clientWidth: 384 };
    const el = stubEl(parent, { offsetWidth: 384, offsetHeight: 83 });
    el.style.marginLeft = "4px"; // foreign style must survive the clear.

    pinLeaveGeometry(el as unknown as Element, { anchorX: "left" });
    clearLeaveGeometry(el as unknown as Element);

    // On a real CSSStyleDeclaration an empty string removes the
    // property; the stub keeps the keys, so assert emptiness.
    expect(el.style.right).toBe("");
    expect(el.style.left).toBe("");
    expect(el.style.top).toBe("");
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
    expect(el.style.boxSizing).toBe("");
    expect(el.style.marginLeft).toBe("4px");
  });
});
