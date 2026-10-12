import { afterEach, describe, expect, it, vi } from "vitest";

import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "./useOverlayScrollbar";

/**
 * The asymmetric scroll map (2026-10-12 user direction): a scrollbar that
 * represents the DOCUMENT while the scroller holds only rendered rows —
 * the diff viewer's collapsed unchanged regions. The three behaviours the
 * user named, plus the guarantee that nobody who opts out notices:
 *
 *  1. scrolling the CONTENT sweeps the thumb quickly across a collapsed
 *     region's map range;
 *  2. DRAGGING the thumb through that range leaves the content pinned
 *     until the range ends;
 *  3. swapping the map (a region unfolded) re-derives the thumb from the
 *     same document total — folding never moves the document;
 *  4. without `mapSegments` the bar is dom-native, byte-for-byte the
 *     math every consumer had before.
 */

/** Scroll geometry is stubbed (happy-dom lays nothing out): 900px of
 *  rendered content in a 300px viewport. The map below models a document
 *  of 2000 lines whose middle 1100 lines are collapsed to one divider:
 *
 *    rung 1: dom 300, map 600   (rendered rows, 1:1)
 *    rung 2: dom   1, map 1100  (the collapsed divider)
 *    rung 3: dom 599, map 300   (hmm — see fixture below)
 */
const GEOM = { scrollHeight: 900, clientHeight: 300, scrollTop: 0 };

function stubGeometry(el: HTMLElement, geom: { scrollHeight?: number; clientHeight?: number } = {}) {
  const desc: PropertyDescriptorMap = {
    scrollHeight: { configurable: true, get: () => geom.scrollHeight ?? GEOM.scrollHeight },
    clientHeight: { configurable: true, get: () => geom.clientHeight ?? GEOM.clientHeight },
  };
  let top = GEOM.scrollTop;
  desc.scrollTop = { configurable: true, get: () => top, set: (v: number) => { top = v; } };
  Object.defineProperties(el, desc);
  return () => { GEOM.scrollTop = top; };
}

/** dom 300|map 600, dom 1|map 1100, dom 599|map 300: Σdom=900 (the real
 *  scrollHeight), Σmap=2000 (the whole document). */
const FOLDED: Array<{ dom: number; map: number }> = [
  { dom: 300, map: 600 },
  { dom: 1, map: 1100 },
  { dom: 599, map: 300 },
];

const handles: OverlayScrollbarHandle[] = [];
const cleanups: Array<() => void> = [];

function mount(segments?: Array<{ dom: number; map: number }>) {
  const host = document.createElement("div");
  const viewport = document.createElement("div");
  host.appendChild(viewport);
  document.body.appendChild(host);
  cleanups.push(() => host.remove());
  const sync = stubGeometry(viewport);
  const track = () => host.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])")!;
  const thumb = () => host.querySelector<HTMLElement>(".hk-scrollbar-thumb")!;
  const pct = (el: HTMLElement) => Number(/([\d.]+)px/.exec(el.style.transform ?? "")?.[1] ?? "0");
  const height = (el: HTMLElement) => Number.parseFloat(el.style.height || "0");
  const handle = attachOverlayScrollbars(viewport, {
    axis: "vertical",
    ...(segments ? { mapSegments: segments } : {}),
  });
  handles.push(handle);
  handle.update();
  return { viewport, handle, sync, track, thumb, pct, height, host };
}

afterEach(() => {
  for (const h of handles.splice(0)) h.detach();
  for (const c of cleanups.splice(0)) c();
  document.body.innerHTML = "";
});

describe("overlay scrollbar scroll map", () => {
  it("sizes and places the thumb in DOCUMENT space", () => {
    const t = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    // track height 200; viewport covers map 300→600? — with the viewport
    // at dom 0, map 0..~333 of 2000 (300px viewport over 900px content
    // spans rung 1 entirely plus a sliver of the divider).
    const m = mount(FOLDED);
    // Σmap=2000, viewport map extent = fracToMap(300/900) = 600 + (0/1)*1100 = 600.
    // thumb = 600/2000 * 200 = 60px; max progress 0 → offset 0.
    expect(m.height(m.thumb())).toBeCloseTo(60, 1);
    expect(m.pct(m.thumb())).toBeCloseTo(0, 1);
    t.mockRestore();
  });

  it("sweeps the thumb FAST across a collapsed region while the content scrolls it (1)", () => {
    const t = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const m = mount(FOLDED);
    // 1px of dom travel at the divider = 1100 map units; the whole
    // divider is crossed by 1px. Content at dom 300 (divider top):
    m.viewport.scrollTop = 299;
    m.handle.update();
    const before = m.pct(m.thumb());
    m.viewport.scrollTop = 301; // past the divider entirely
    m.handle.update();
    const after = m.pct(m.thumb());
    // The two pixels of content moved the thumb across the collapsed
    // range: from rung 1's end (map 600/2000) to rung 3's start
    // (map 1700/2000) — over half the track for 2px of scroll.
    expect(before).toBeLessThan(60);
    expect(after).toBeGreaterThan(120);
    t.mockRestore();
  });

  it("PINS the content while the thumb drags through a collapsed range (2)", () => {
    const t = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const m = mount(FOLDED);
    m.viewport.scrollTop = 300; // the divider
    m.handle.update();
    const thumbEl = m.thumb();
    thumbEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 100 }));
    // Drag well into the collapsed range (map 600..1700). The track is
    // 200px, the thumb ~60px, so ~140px of travel ≈ the whole document.
    const dragTo = (y: number) => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: y }));
    };
    dragTo(120); // a little into the range — still inside the divider's dom extent
    expect(m.viewport.scrollTop).toBeGreaterThanOrEqual(299);
    expect(m.viewport.scrollTop).toBeLessThanOrEqual(301);
    dragTo(160); // deep into the range — the DOM cannot present it
    expect(m.viewport.scrollTop).toBeGreaterThanOrEqual(299);
    expect(m.viewport.scrollTop).toBeLessThanOrEqual(301);
    document.dispatchEvent(new MouseEvent("mouseup"));
    t.mockRestore();
  });

  it("re-derives the thumb from the SAME document total when a region unfolds (3)", () => {
    const t = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const m = mount(FOLDED);
    // Unfold: the divider's 1100 map lines become real dom rows (the
    // consumer re-renders and reports taller content too).
    const UNFOLDED = [
      { dom: 300, map: 600 },
      { dom: 1100, map: 1100 },
      { dom: 599, map: 300 },
    ];
    vi.spyOn(m.viewport, "scrollHeight", "get").mockReturnValue(1999);
    m.handle.setMapSegments(UNFOLDED);
    m.handle.update();
    // The thumb still describes the same document: its height is
    // unchanged (viewport map extent / total), even though the dom grew.
    expect(m.height(m.thumb())).toBeCloseTo(60, 1);
    // And clearing the map returns the dom-native bar.
    m.handle.setMapSegments([]);
    m.handle.update();
    expect(m.height(m.thumb())).toBeCloseTo((300 / 1999) * 200, 1);
    t.mockRestore();
  });

  it("without mapSegments the bar stays dom-native (4)", () => {
    const t = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const m = mount();
    expect(m.height(m.thumb())).toBeCloseTo((300 / 900) * 200, 1);
    // Drag math unchanged: full track travel = full scroll range.
    m.viewport.scrollTop = 0;
    m.handle.update();
    m.thumb().dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 70 }));
    // Dom-native math, unchanged from before the map existed: thumb
    // (300/900)*200 ≈ 66.7px, range 133.3px, so 70px of pointer =
    // (70/133.3)·600 ≈ 315 — the exact value the pre-map engine produced.
    expect(m.viewport.scrollTop).toBeCloseTo(315, 0);
    document.dispatchEvent(new MouseEvent("mouseup"));
    t.mockRestore();
  });
});
