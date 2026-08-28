import { describe, expect, it } from "vitest";

import { clearLeaveGeometry, pinLeaveGeometry } from "./dom";

/**
 * pinLeaveGeometry contract:
 * - freezes the in-flow box (right/top/width/height + border-box) of a
 *   leaving list item against its offsetParent, anchored to the
 *   containing block's right padding-box edge
 *   (right = clientWidth - (offsetLeft + offsetWidth))
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

  it("clearLeaveGeometry strips exactly the pins pinLeaveGeometry wrote", () => {
    const parent = { clientWidth: 384 };
    const el = stubEl(parent, { offsetWidth: 384, offsetHeight: 83 });
    el.style.marginLeft = "4px"; // foreign style must survive the clear.

    pinLeaveGeometry(el as unknown as Element);
    clearLeaveGeometry(el as unknown as Element);

    // On a real CSSStyleDeclaration an empty string removes the
    // property; the stub keeps the keys, so assert emptiness.
    expect(el.style.right).toBe("");
    expect(el.style.top).toBe("");
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
    expect(el.style.boxSizing).toBe("");
    expect(el.style.marginLeft).toBe("4px");
  });
});
