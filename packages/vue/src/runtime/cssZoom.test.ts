/**
 * Contract for the cumulative-zoom helper that keeps teleported overlays
 * anchored under standardized CSS zoom (chest's root-level manual DPI
 * scale): gBCR reports root VISUAL space while fixed px written inside
 * the zoomed subtree are local — the helper is the one conversion factor
 * between the two. It must multiply every explicit zoom along the
 * element → documentElement chain, ignore links without DOM zoom support
 * (old engines, happy-dom) or with `normal`/garbage values, and default
 * to the identity 1 everywhere else.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ancestorZoom } from "./cssZoom";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Patch getComputedStyle so the given elements report a `zoom` value. */
function patchZoom(map: Map<Element, string>) {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
      const decl = original(el, pseudo ?? undefined);
      const zoom = map.get(el);
      return new Proxy(decl, {
        get(target, prop, recv) {
          if (prop === "zoom") return zoom;
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    },
  );
}

describe("ancestorZoom", () => {
  it("returns 1 when no element reports a zoom", () => {
    patchZoom(new Map());
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(ancestorZoom(el)).toBe(1);
  });

  it("multiplies the explicit zoom values along the ancestor chain", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    patchZoom(
      new Map([
        [document.documentElement, "2"],
        [document.body, "1.5"],
      ]),
    );
    expect(ancestorZoom(el)).toBeCloseTo(3);
  });

  it("counts only the links between the element and the root", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    patchZoom(new Map([[outer, "2"]]));
    // inner's chain: outer(2) → body → html — the unrelated sibling-zoom
    // absence below outer stays out.
    expect(ancestorZoom(inner)).toBe(2);
    expect(ancestorZoom(outer)).toBe(2);
  });

  it("ignores normal and unparseable values", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    patchZoom(
      new Map([
        [document.documentElement, "normal"],
        [document.body, "zoomed"],
      ]),
    );
    expect(ancestorZoom(el)).toBe(1);
  });

  it("guards non-positive zoom values", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    patchZoom(
      new Map([
        [document.documentElement, "0"],
        [document.body, "-2"],
      ]),
    );
    expect(ancestorZoom(el)).toBe(1);
  });

  it("returns 1 for a null element", () => {
    expect(ancestorZoom(null)).toBe(1);
  });
});
