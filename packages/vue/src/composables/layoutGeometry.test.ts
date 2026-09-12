import { afterEach, describe, expect, it } from "vitest";

import {
  drawnScale,
  frameMetrics,
  frameScale,
  laidSize,
  layoutOffset,
  layoutRect,
  nearestLaidAncestor,
  placePoint,
} from "./layoutGeometry";

/** A box the engine reports, on both axes. */
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function asRect(box: Box): DOMRect {
  return {
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
  } as DOMRect;
}

function drawn(el: HTMLElement, box: Box): void {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => asRect(box),
  });
}

function laid(
  el: HTMLElement,
  box: { left: number; top: number; w: number; h: number },
  parent: HTMLElement | null,
): void {
  Object.defineProperty(el, "offsetLeft", { configurable: true, get: () => box.left });
  Object.defineProperty(el, "offsetTop", { configurable: true, get: () => box.top });
  Object.defineProperty(el, "offsetWidth", { configurable: true, get: () => box.w });
  Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => box.h });
  Object.defineProperty(el, "offsetParent", { configurable: true, get: () => parent });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("layoutGeometry", () => {
  it("reports the laid-out border box, not the rounded one", () => {
    // A fractional border box: the computed width is the CONTENT box unless
    // the element is border-box, so the padding and border come back on top of
    // it — and the integer `offsetWidth` is only the fallback.
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.width = "100.4px";
    el.style.height = "40.25px";
    el.style.paddingLeft = "3px";
    el.style.paddingRight = "3px";
    el.style.borderLeftWidth = "1px";
    el.style.borderRightWidth = "1px";
    laid(el, { left: 0, top: 0, w: 108, h: 40 }, document.body);
    expect(laidSize(el)).toEqual({ w: 108.4, h: 40.25 });

    el.style.boxSizing = "border-box";
    expect(laidSize(el).w, "a border-box element reports its border box already").toBe(100.4);
  });

  it("falls back to the integer box when nothing finer can be read", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    laid(el, { left: 0, top: 0, w: 108, h: 40 }, document.body);
    expect(laidSize(el), "no computed width to read").toEqual({ w: 108, h: 40 });
  });

  it("adds a frame's border only when the walk went through it", () => {
    // The two families a browser produces: a positioned frame IS the child's
    // offsetParent (the offsets are measured from its PADDING edge, so its
    // border has to come back), a static frame is skipped by the chain (they
    // are measured from its BORDER edge, so adding it would double-count).
    const frame = document.createElement("div");
    const child = document.createElement("div");
    frame.appendChild(child);
    document.body.appendChild(frame);
    frame.style.borderLeftWidth = "10px";
    frame.style.borderTopWidth = "10px";
    drawn(frame, { left: 100, right: 300, top: 200, bottom: 260 });
    laid(frame, { left: 0, top: 0, w: 200, h: 60 }, document.body);
    laid(child, { left: 30, top: 30, w: 100, h: 40 }, frame);
    drawn(child, { left: 140, right: 240, top: 240, bottom: 280 });

    // Through the frame: 100 + 10 (border) + (30 - 0 - 0) = 140.
    expect(placePoint(frame, frameMetrics(frame), layoutOffset(child, frame), layoutOffset(frame, null)))
      .toEqual({ x: 140, y: 240 });
    expect(layoutRect(child, frame)).toEqual({ left: 140, top: 240, width: 100, height: 40 });

    // Skipping the frame: the offsets already carry its border.
    laid(child, { left: 40, top: 40, w: 100, h: 40 }, null);
    expect(layoutOffset(child, frame).through).toBe(false);
    expect(placePoint(frame, frameMetrics(frame), layoutOffset(child, frame), layoutOffset(frame, null)))
      .toEqual({ x: 140, y: 240 });
  });

  it("scales what it places by the scale the frame is drawn at", () => {
    const frame = document.createElement("div");
    const child = document.createElement("div");
    frame.appendChild(child);
    document.body.appendChild(frame);
    drawn(frame, { left: 50, right: 450, top: 20, bottom: 140 }); // drawn 2x
    laid(frame, { left: 0, top: 0, w: 200, h: 60 }, document.body);
    laid(child, { left: 50, top: 30, w: 40, h: 10 }, frame);
    drawn(child, { left: 0, right: 0, top: 0, bottom: 0 });

    const box = frameMetrics(frame);
    expect(frameScale(box), "the frame is drawn twice its laid size").toEqual({ x: 2, y: 2 });
    expect(placePoint(frame, box, layoutOffset(child, frame), layoutOffset(frame, null))).toEqual({
      x: 150,
      y: 80,
    });
    expect(layoutRect(child, frame)).toEqual({ left: 150, top: 80, width: 80, height: 20 });
  });

  it("refuses to place a box it cannot read", () => {
    const frame = document.createElement("div");
    const child = document.createElement("div");
    frame.appendChild(child);
    document.body.appendChild(frame);
    laid(frame, { left: 0, top: 0, w: 200, h: 60 }, document.body);
    laid(child, { left: 10, top: 10, w: 40, h: 10 }, frame);
    drawn(frame, { left: 0, right: 200, top: 0, bottom: 0 });
    expect(layoutRect(child, frame), "a frame drawn with no height places nothing").toBeNull();

    drawn(frame, { left: 0, right: 200, top: 0, bottom: 60 });
    laid(child, { left: 10, top: 10, w: 0, h: 0 }, frame);
    expect(layoutRect(child, frame), "an item with no box places nothing").toBeNull();

    // A chain through something without offsets of its own cannot be added up.
    laid(child, { left: 10, top: 10, w: 40, h: 10 }, frame);
    const inner = document.createElement("div");
    Object.defineProperty(inner, "offsetLeft", { configurable: true, get: () => undefined });
    Object.defineProperty(inner, "offsetTop", { configurable: true, get: () => undefined });
    Object.defineProperty(inner, "offsetParent", { configurable: true, get: () => frame });
    laid(child, { left: 10, top: 10, w: 40, h: 10 }, inner);
    expect(layoutOffset(child, frame).x).toBeNaN();
    expect(layoutRect(child, frame)).toBeNull();
  });

  it("measures how much bigger an element is drawn than laid out", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.width = "100px";
    el.style.height = "50px";
    laid(el, { left: 0, top: 0, w: 100, h: 50 }, document.body);
    drawn(el, { left: 0, right: 150, top: 0, bottom: 75 });
    expect(drawnScale(el)).toEqual({ x: 1.5, y: 1.5 });
  });

  it("walks up to the nearest ancestor that has a box", () => {
    const outer = document.createElement("div");
    const contentless = document.createElement("div");
    const child = document.createElement("div");
    outer.appendChild(contentless);
    contentless.appendChild(child);
    document.body.appendChild(outer);
    drawn(outer, { left: 0, right: 300, top: 0, bottom: 60 });
    laid(outer, { left: 0, top: 0, w: 300, h: 60 }, null);
    drawn(contentless, { left: 0, right: 0, top: 0, bottom: 0 });
    laid(contentless, { left: 0, top: 0, w: 0, h: 0 }, outer);
    expect(nearestLaidAncestor(child), "a boxless wrapper is not a frame").toBe(outer);
  });
});
