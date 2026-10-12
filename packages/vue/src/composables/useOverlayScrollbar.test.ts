import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachOverlayScrollbars, type OverlayScrollbarHandle, type OverlayScrollbarOptions } from "./useOverlayScrollbar";

const handles: OverlayScrollbarHandle[] = [];
const containers: HTMLElement[] = [];

/** Mount a viewport (the scrolling element) inside a wrapper inside a
 *  fresh container: wrapper ← viewport. The wrapper is the track host. */
function mountViewport(
  axis: "vertical" | "horizontal" | "both" = "vertical",
  extra: Omit<OverlayScrollbarOptions, "axis"> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const wrapper = document.createElement("div");
  const viewport = document.createElement("div");
  wrapper.appendChild(viewport);
  container.appendChild(wrapper);
  const handle = attachOverlayScrollbars(viewport, { axis, ...extra });
  handles.push(handle);
  return { container, wrapper, viewport, handle };
}

/** A scrollable vertical viewport with a deterministic band box: happy-dom
 *  performs no layout, so both the geometry and the track's bounding box
 *  are stubbed. `height` of the band is what maps a mark's fraction to a
 *  pixel position. The marks live INSIDE the vertical track (the widened
 *  scrollbar is the ruler), so "the rail" below IS the track. */
function mountRailed(railHeight = 100) {
  const mounted = mountViewport("vertical");
  stubGeometry(mounted.viewport, {
    scrollHeight: 1000, clientHeight: 100, scrollTop: 0,
    scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
  });
  mounted.handle.update();
  return {
    ...mounted,
    rail: () => {
      const el = mounted.wrapper.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])");
      if (el) {
        vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
          top: 0, left: 0, width: 14, height: railHeight,
          bottom: railHeight, right: 14, x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(el, "clientHeight", { configurable: true, get: () => railHeight });
      }
      return el;
    },
  };
}

/** happy-dom performs no layout, so scroll geometry is stubbed on the
 *  viewport instance (shadowing the prototype getters) — the same
 *  trick HkScrollContainer.test.ts uses, plus writable scroll offsets
 *  so the drag / track-click paths can assert what they scrolled to. */
function stubGeometry(
  el: HTMLElement,
  geom: { scrollHeight?: number; clientHeight?: number; scrollTop?: number; scrollWidth?: number; clientWidth?: number; scrollLeft?: number },
) {
  const desc: PropertyDescriptorMap = {};
  for (const [key, value] of Object.entries(geom)) {
    if (key === "scrollTop" || key === "scrollLeft") {
      let current = value;
      desc[key] = {
        configurable: true,
        get: () => current,
        set: (v: number) => { current = v; },
      };
    } else {
      desc[key] = { configurable: true, get: () => value };
    }
  }
  Object.defineProperties(el, desc);
}

/** Give the rail a measured height before applying the marks under test.
 *  The pixel floor is derived from `clientHeight` AT RENDER TIME, so the
 *  stub has to exist before the marks are rendered. */
function railOfHeight(m: ReturnType<typeof mountRailed>, height: number): HTMLElement {
  m.handle.setMarkers([{ start: 0, end: 0 }]);
  const rail = m.rail()!;
  Object.defineProperty(rail, "clientHeight", { configurable: true, get: () => height });
  return rail;
}

afterEach(() => {
  for (const h of handles.splice(0)) h.detach();
  for (const el of containers.splice(0)) el.remove();
});

describe("attachOverlayScrollbars", () => {
  it("creates one vertical track+thumb pair appended to the viewport's parent", () => {
    const { wrapper } = mountViewport("vertical");
    const tracks = wrapper.querySelectorAll<HTMLElement>(".hk-scrollbar-track");
    expect(tracks.length).toBe(1);
    expect(tracks[0].hasAttribute("data-axis")).toBe(false);
    expect(tracks[0].querySelector(".hk-scrollbar-thumb")).not.toBeNull();
  });

  it("creates a horizontal track marked data-axis and both tracks for axis=both", () => {
    const horizontal = mountViewport("horizontal");
    const hTracks = horizontal.wrapper.querySelectorAll(".hk-scrollbar-track");
    expect(hTracks.length).toBe(1);
    expect(hTracks[0].getAttribute("data-axis")).toBe("horizontal");

    const both = mountViewport("both");
    expect(both.wrapper.querySelectorAll(".hk-scrollbar-track").length).toBe(2);
    expect(both.wrapper.querySelectorAll('.hk-scrollbar-track[data-axis="horizontal"]').length).toBe(1);
  });

  it("hides the track while the content fits and shows it once it overflows", () => {
    const { viewport, wrapper, handle } = mountViewport("vertical");
    const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track")!;
    // Fitting content (default 0/0 geometry) → hidden.
    expect(track.style.display).toBe("none");

    stubGeometry(viewport, { scrollHeight: 300, clientHeight: 100, scrollTop: 0 });
    handle.update();
    expect(track.style.display).toBe("");

    // Thumb position maps the scroll ratio (0 → top edge).
    const thumb = track.querySelector<HTMLElement>(".hk-scrollbar-thumb")!;
    expect(thumb.style.transform).toContain("translateY(0px)");
  });

  it("flashes is-scrolling on viewport scroll and drops it when the timer fires", () => {
    vi.useFakeTimers();
    try {
      const { viewport, wrapper } = mountViewport("vertical");
      stubGeometry(viewport, { scrollHeight: 300, clientHeight: 100, scrollTop: 50 });
      viewport.dispatchEvent(new Event("scroll"));
      const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track")!;
      expect(track.classList.contains("is-scrolling")).toBe(true);
      vi.advanceTimersByTime(1300);
      expect(track.classList.contains("is-scrolling")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drags the thumb: mousedown + document mousemove scroll the viewport", () => {
    const { viewport, wrapper, handle } = mountViewport("vertical");
    stubGeometry(viewport, {
      scrollHeight: 400, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    handle.update();
    const thumb = wrapper.querySelector<HTMLElement>(".hk-scrollbar-thumb")!;

    thumb.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientY: 0 }));
    expect(thumb.classList.contains("is-dragging")).toBe(true);

    // Thumb of a 100px client box: max(100/400*100, 20) = 25 →
    // trackRange 75 maps onto the 300px scroll range: +20px delta
    // = +80 scroll.
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 20 }));
    expect(viewport.scrollTop).toBe(80);

    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(thumb.classList.contains("is-dragging")).toBe(false);
    // Document listeners released — further moves do nothing.
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 60 }));
    expect(viewport.scrollTop).toBe(80);
  });

  it("moves the thumb the distance the POINTER went, however the space is scaled", () => {
    // The pointer moves in drawn pixels; the track it is divided by is laid
    // out. Inside a scaled or zoomed root the two differ by the factor the
    // space is drawn at, and the thumb would travel that many times further
    // than the pointer — it would reach the end of the track and stop
    // following after 1/k of the drag.
    const { viewport, wrapper, handle } = mountViewport("vertical");
    stubGeometry(viewport, {
      scrollHeight: 400, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    handle.update();
    const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track")!;
    const thumb = wrapper.querySelector<HTMLElement>(".hk-scrollbar-thumb")!;
    // The track is drawn twice the size it is laid out at (a zoom or a
    // scale on any ancestor), so 100 drawn px are 50 of the track's own.
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 }) as DOMRect,
    });
    Object.defineProperty(track, "offsetWidth", { configurable: true, get: () => 100 });
    Object.defineProperty(track, "offsetHeight", { configurable: true, get: () => 100 });
    Object.defineProperty(track, "clientHeight", { configurable: true, get: () => 100 });
    Object.defineProperty(track, "clientWidth", { configurable: true, get: () => 100 });

    thumb.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientY: 0 }));
    // 50 of the track's own px over a 75px range maps onto 300 scroll px.
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 100 }));
    expect(viewport.scrollTop, "half the track, half the range").toBe(200);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("rests the horizontal thumb at the track's right end in a right-to-left scroller", () => {
    // An RTL scroller starts with `scrollLeft` at 0 — the content's right end
    // — and counts down from there, so the thumb belongs at the right of the
    // track and travels left. Rendering it at translateX(0) parked it at the
    // wrong end of its own track.
    const { viewport, wrapper, handle } = mountViewport("horizontal");
    const track = wrapper.querySelector<HTMLElement>('.hk-scrollbar-track[data-axis="horizontal"]')!;
    const thumb = track.querySelector<HTMLElement>(".hk-scrollbar-thumb")!;
    // A 100px track with a 100-of-400 client box: thumb 25px, 75px of travel.
    Object.defineProperty(track, "clientWidth", { configurable: true, get: () => 100 });
    const at = (scrollLeft: number) => {
      stubGeometry(viewport, {
        scrollWidth: 400, clientWidth: 100, scrollLeft,
        scrollHeight: 100, clientHeight: 100, scrollTop: 0,
      });
      handle.update();
      return thumb.style.transform;
    };
    viewport.style.direction = "rtl";
    // An RTL scroller starts with `scrollLeft` at 0 — the content's right end
    // — and counts down from there, so the thumb belongs at the right of the
    // track and travels left. Rendering it at translateX(0) parked it at the
    // wrong end of its own track.
    expect(at(0), "at the start, against the right end").toBe("translateX(75px)");
    expect(at(-150), "half way").toBe("translateX(37.5px)");
    expect(at(-300), "scrolled to the far end, at the left").toBe("translateX(0px)");

    // …and the left-to-right bar keeps resting at the left.
    viewport.style.direction = "ltr";
    expect(at(0)).toBe("translateX(0px)");
    expect(at(150)).toBe("translateX(37.5px)");
  });

  it("pages when the track (not the thumb) is clicked", () => {
    const { viewport, wrapper, handle } = mountViewport("vertical");
    stubGeometry(viewport, {
      scrollHeight: 400, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    handle.update();
    const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track")!;
    // happy-dom getBoundingClientRect is all-zero — simulate a 100px
    // tall track so the click ratio is deterministic.
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      top: 0, left: 0, width: 6, height: 100,
      bottom: 100, right: 6, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    track.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 50 }));
    // Halfway down the track → halfway through the scroll range.
    expect(viewport.scrollTop).toBe(150);
  });

  it("maps a horizontal track click onto the RTL scroll range", () => {
    const { viewport, wrapper, handle } = mountViewport("horizontal");
    stubGeometry(viewport, {
      scrollHeight: 100, clientHeight: 100, scrollTop: 0,
      scrollWidth: 400, clientWidth: 100, scrollLeft: 0,
    });
    // An RTL scroller counts `scrollLeft` down from 0 to −max (see the thumb
    // mirroring): the track's LEFT end is the content's end, so a click at the
    // halfway point must land at −150, not +150.
    viewport.style.direction = "rtl";
    handle.update();
    const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track")!;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      top: 0, left: 0, width: 100, height: 6,
      bottom: 6, right: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    track.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 25 }));
    // A quarter along the track, measured from its left = three quarters into
    // the content from its (right-hand) start: −0.75 × 300.
    expect(viewport.scrollLeft).toBe(-225);
    // The magnitude is what the thumb's own mirroring reads back as progress
    // (|scrollLeft| / max), so click and thumb now agree on the position.
    // The LTR bar keeps mapping straight through.
    viewport.style.direction = "ltr";
    track.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 25 }));
    expect(viewport.scrollLeft).toBe(75);
  });

  it("marks and unmarks a static parent with inline position:relative (guard)", () => {
    const { wrapper, handle } = mountViewport("vertical");
    // happy-dom computes no CSS → position computes "static" → the
    // guard must promote the host and mark it.
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.hasAttribute("data-hk-overlay-scrollbar-positioned")).toBe(true);
    // Detach restores the empty inline position and drops the mark.
    handle.detach();
    handles.splice(handles.indexOf(handle), 1);
    expect(wrapper.style.position).toBe("");
    expect(wrapper.hasAttribute("data-hk-overlay-scrollbar-positioned")).toBe(false);
  });

  it("keeps an already-positioned host untouched", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    const viewport = document.createElement("div");
    wrapper.appendChild(viewport);
    container.appendChild(wrapper);
    const handle = attachOverlayScrollbars(viewport);
    handles.push(handle);

    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.hasAttribute("data-hk-overlay-scrollbar-positioned")).toBe(false);
  });

  it("shares the guard across handles on one parent and restores only after the last detach", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const wrapper = document.createElement("div");
    const viewportA = document.createElement("div");
    const viewportB = document.createElement("div");
    wrapper.appendChild(viewportA);
    wrapper.appendChild(viewportB);
    container.appendChild(wrapper);
    const handleA = attachOverlayScrollbars(viewportA, { axis: "vertical" });
    const handleB = attachOverlayScrollbars(viewportB, { axis: "vertical" });
    handles.push(handleA, handleB);
    expect(wrapper.style.position).toBe("relative");

    handleA.detach();
    handles.splice(handles.indexOf(handleA), 1);
    // B's tracks still live on the wrapper — the promotion survives.
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.hasAttribute("data-hk-overlay-scrollbar-positioned")).toBe(true);

    handleB.detach();
    handles.splice(handles.indexOf(handleB), 1);
    // Last handle gone — the wrapper's inline position is restored.
    expect(wrapper.style.position).toBe("");
    expect(wrapper.hasAttribute("data-hk-overlay-scrollbar-positioned")).toBe(false);
  });

  it("detach removes the tracks and is idempotent", () => {
    const { wrapper, handle } = mountViewport("both");
    expect(wrapper.querySelectorAll(".hk-scrollbar-track").length).toBe(2);
    handle.detach();
    handles.splice(handles.indexOf(handle), 1);
    expect(wrapper.querySelectorAll(".hk-scrollbar-track").length).toBe(0);
    expect(() => handle.detach()).not.toThrow();
  });

  it("returns a no-op handle when the viewport has no parent", () => {
    const orphan = document.createElement("div");
    const handle = attachOverlayScrollbars(orphan);
    handles.push(handle);
    expect(() => {
      handle.update();
      handle.setMarkers([{ start: 0, end: 0.5 }]);
      handle.detach();
    }).not.toThrow();
  });
});

describe("change-mark rail", () => {
  it("keeps the narrow track, unmarked, when the consumer passes no markers", () => {
    const { wrapper } = mountViewport("vertical");
    const track = wrapper.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])");
    expect(track?.classList.contains("has-markers") ?? false, "no widening").toBe(false);
    expect(track?.querySelectorAll(".hk-scrollbar-marker").length ?? 0).toBe(0);
  });

  it("creates the rail and one mark per entry, tagged by kind", () => {
    const m = mountRailed();
    m.handle.setMarkers([
      { start: 0.1, end: 0.2, kind: "added" },
      { start: 0.5, end: 0.6, kind: "deleted" },
    ]);
    const rail = m.rail();
    expect(rail).not.toBeNull();
    const marks = rail!.querySelectorAll<HTMLElement>(".hk-scrollbar-marker");
    expect(marks.length).toBe(2);
    expect(marks[0].getAttribute("data-kind")).toBe("added");
    expect(marks[1].getAttribute("data-kind")).toBe("deleted");
    expect(marks[0].style.top).toBe("10%");
    expect(marks[0].style.height).toBe("10%");
    expect(marks[1].style.top).toBe("50%");
  });

  it("accepts markers through the attach options", () => {
    const m = mountViewport("vertical", { markers: [{ start: 0, end: 0.25, kind: "added" }] });
    stubGeometry(m.viewport, {
      scrollHeight: 1000, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    m.handle.update();
    expect(m.wrapper.querySelectorAll(".hk-scrollbar-marker").length).toBe(1);
  });

  it("floors a hairline mark and keeps an end-of-file mark inside the rail", () => {
    const m = mountRailed();
    m.handle.setMarkers([
      // One line of a 1000-line file: 0.1% — under the floor.
      { start: 0.4, end: 0.401, kind: "modified" },
      // The very last line: top + height must not overflow the rail.
      { start: 1, end: 1, kind: "added" },
    ]);
    const marks = m.rail()!.querySelectorAll<HTMLElement>(".hk-scrollbar-marker");
    expect(parseFloat(marks[0].style.height), "floored to the minimum").toBeCloseTo(0.5, 5);
    const top = parseFloat(marks[1].style.top);
    const height = parseFloat(marks[1].style.height);
    expect(top + height, "a mark at the end stays inside the rail").toBeLessThanOrEqual(100);
  });

  it("floors a hairline mark in PIXELS on a short rail, not just as a fraction", () => {
    const m = mountRailed();
    railOfHeight(m, 100);
    m.handle.setMarkers([{ start: 0.4, end: 0.401, kind: "modified" }]);
    // `update()` is the path that re-renders marks laid out before a height
    // existed (a no-layout DOM reports 0, which leaves the "never sized"
    // sentinel behind) — without it this test silently asserted the
    // FRACTION floor and would have stayed green with no pixel floor at all.
    m.handle.update();
    // 2px of a 100px rail = 2%. The fraction floor alone (0.5%) is a
    // half-pixel target — and since the rail is pointer-transparent the
    // marks ARE the hit area, so a half-pixel mark is a half-pixel button.
    expect(
      parseFloat(m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!.style.height),
    ).toBeCloseTo(2, 5);
  });

  it("re-sizes the marks when the rail is resized", () => {
    const m = mountRailed();
    const rail = railOfHeight(m, 100);
    m.handle.setMarkers([{ start: 0.4, end: 0.401, kind: "modified" }]);
    const height = () =>
      parseFloat(m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!.style.height);
    expect(height()).toBeCloseTo(2, 5);
    // A taller rail makes the same 2px a smaller share of it.
    Object.defineProperty(rail, "clientHeight", { configurable: true, get: () => 400 });
    m.handle.update();
    expect(height(), "2px of a 400px rail").toBeCloseTo(0.5, 5);
  });

  it("clamps a reversed or out-of-range span instead of rendering it outside", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.8, end: 0.2, kind: "added" }]);
    const mark = m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!;
    expect(mark.style.top).toBe("20%");
    expect(mark.style.height).toBe("60%");
  });

  it("honours the consumer's markersWidth, clamped to a sane band", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.1, end: 0.2, kind: "added" }]);
    const width = () => m.rail()!.style.width;
    // The default band, then the consumer's own, then the clamps.
    expect(width()).toBe("14px");
    m.handle.detach();
    handles.splice(handles.indexOf(m.handle), 1);

    const custom = mountViewport("vertical", { markers: [{ start: 0.1, end: 0.2, kind: "added" }], markersWidth: 22 });
    custom.handle.update();
    expect(
      custom.wrapper.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])")!.style.width,
    ).toBe("22px");
    custom.handle.detach();
    handles.splice(handles.indexOf(custom.handle), 1);

    const clamped = mountViewport("vertical", { markers: [{ start: 0.1, end: 0.2, kind: "added" }], markersWidth: 999 });
    clamped.handle.update();
    expect(
      clamped.wrapper.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])")!.style.width,
      "above the 40px ceiling it clamps").toBe("40px");
  });

  it("mirrors side onto data-side so the lanes can be styled", () => {
    const m = mountRailed();
    m.handle.setMarkers([
      { start: 0.1, end: 0.2, kind: "deleted", side: "start" },
      { start: 0.1, end: 0.2, kind: "added", side: "end" },
      { start: 0.5, end: 0.6, kind: "modified" },
    ]);
    const marks = m.rail()!.querySelectorAll<HTMLElement>(".hk-scrollbar-marker");
    expect(marks[0].getAttribute("data-side")).toBe("start");
    expect(marks[1].getAttribute("data-side")).toBe("end");
    expect(marks[2].getAttribute("data-side"), "no side = full band").toBeNull();
  });

  it("does not scrub on a press on the band's empty ground", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.3, end: 0.35, kind: "added" }]);
    stubGeometry(m.viewport, {
      scrollHeight: 1000, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    // A press on the TRACK (not on a mark) keeps the track's own
    // click-to-page behaviour: no scrub, no drag state.
    const track = m.rail()!;
    track.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientY: 0 }));
    expect(track.classList.contains("is-dragging"), "no drag state").toBe(false);
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 100 }));
    expect(m.viewport.scrollTop, "no scrub followed the pointer").toBe(0);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("keeps the band and its marks visible at rest (an overview ruler is a glance)", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.1, end: 0.2, kind: "added" }]);
    // The track is pointer-transparent at rest, but the widened band and
    // its marks must still SHOW: hiding them made the ruler a hover-only
    // affordance, which is exactly what an overview ruler is not.
    // happy-dom does not apply stylesheets to computed styles, so this
    // pins the rule in the shipped chrome (the vendored copy) instead.
    const chrome = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../styles/theme/scrollbar.scss"),
      "utf-8",
    );
    const widened = /&\.has-markers:not\(\[data-axis="horizontal"\]\)\s*\{[^}]*\}/.exec(chrome)?.[0] ?? "";
    expect(widened, "positive control: the widened rule was found").not.toBe("");
    expect(widened, "the band is visible at rest").toMatch(/opacity:\s*1/);
    // …and the thumb rides above it.
    expect(chrome).toMatch(/\.hk-scrollbar-thumb\s*\{[^}]*z-index:\s*2/);
  });

  it("positions marks against the content, so scrolling does not move them", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.25, end: 0.3, kind: "added" }]);
    const top = () => m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!.style.top;
    expect(top()).toBe("25%");
    stubGeometry(m.viewport, {
      scrollHeight: 1000, clientHeight: 100, scrollTop: 500,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    m.viewport.dispatchEvent(new Event("scroll"));
    m.handle.update();
    expect(top(), "the rail maps the whole document, not the window").toBe("25%");
  });

  it("removes the rail again when the marks are cleared", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.1, end: 0.2, kind: "added" }]);
    expect(m.rail()).not.toBeNull();
    m.handle.setMarkers([]);
    const track = m.wrapper.querySelector<HTMLElement>(".hk-scrollbar-track:not([data-axis='horizontal'])");
    expect(track?.classList.contains("has-markers") ?? false, "the widening is undone").toBe(false);
    expect(track?.querySelectorAll(".hk-scrollbar-marker").length ?? 0).toBe(0);
  });

  it("hides the rail while the content fits, and shows it again when it scrolls", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.1, end: 0.2, kind: "added" }]);
    stubGeometry(m.viewport, {
      scrollHeight: 100, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    m.handle.update();
    expect(m.rail()!.style.display).toBe("none");
    stubGeometry(m.viewport, {
      scrollHeight: 1000, clientHeight: 100, scrollTop: 0,
      scrollWidth: 100, clientWidth: 100, scrollLeft: 0,
    });
    m.handle.update();
    expect(m.rail()!.style.display).toBe("");
  });

  it("never renders a rail on a horizontal-only scroll region", () => {
    const m = mountViewport("horizontal");
    stubGeometry(m.viewport, {
      scrollHeight: 100, clientHeight: 100, scrollTop: 0,
      scrollWidth: 1000, clientWidth: 100, scrollLeft: 0,
    });
    m.handle.update();
    m.handle.setMarkers([{ start: 0.1, end: 0.2, kind: "added" }]);
    const hTrack = m.wrapper.querySelector<HTMLElement>('.hk-scrollbar-track[data-axis="horizontal"]');
    expect(hTrack?.classList.contains("has-markers") ?? false, "no band on a horizontal track").toBe(false);
    expect(hTrack?.querySelectorAll(".hk-scrollbar-marker").length ?? 0).toBe(0);
  });

  it("ignores non-finite mark bounds instead of parking them at NaN%", () => {
    const m = mountRailed();
    m.handle.setMarkers([
      { start: Number.NaN, end: Number.NaN, kind: "added" },
      { start: Number.POSITIVE_INFINITY, end: 0.9, kind: "modified" },
    ]);
    const marks = m.rail()!.querySelectorAll<HTMLElement>(".hk-scrollbar-marker");
    // "NaN%" is rejected by CSSOM: the element keeps no inline top/height,
    // collapses to zero height and the mark silently does not exist.
    expect(marks[0].style.top).toBe("0%");
    expect(marks[0].style.height).toBe("0.5%");
    // Infinity is not "the end of the file" — non-finite clamps to 0.
    expect(marks[1].style.top).toBe("0%");
  });

  it("keeps a mark press from escaping to the page and shows the drag", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.3, end: 0.35, kind: "added" }]);
    const rail = m.rail()!;
    const mark = rail.querySelector<HTMLElement>(".hk-scrollbar-marker")!;
    // The rail rides inside modals/drawers that dismiss on an outside
    // press; scrubbing it must not double as that press.
    let escaped = 0;
    const spy = () => { escaped += 1; };
    document.body.addEventListener("mousedown", spy);
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientY: 0 });
    mark.dispatchEvent(down);
    expect(down.defaultPrevented, "the press is consumed").toBe(true);
    expect(escaped, "the press never reaches the page").toBe(0);
    expect(rail.classList.contains("is-dragging"), "the rail shows the drag").toBe(true);
    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(rail.classList.contains("is-dragging"), "and clears it on release").toBe(false);
    document.body.removeEventListener("mousedown", spy);
  });

  it("jumps to a mark when the mark is pressed", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.3, end: 0.35, kind: "added" }]);
    const mark = m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!;
    mark.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientY: 50 }));
    // Halfway down a 100px rail over a 900px scroll range.
    expect(m.viewport.scrollTop).toBe(450);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("scrubs while the rail is dragged and stops on mouseup", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.3, end: 0.35, kind: "added" }]);
    const mark = m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!;
    mark.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientY: 0 }));
    expect(m.viewport.scrollTop).toBe(0);
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 100 }));
    expect(m.viewport.scrollTop, "dragged to the bottom").toBe(900);
    document.dispatchEvent(new MouseEvent("mouseup"));
    // The document listeners are gone: a later move must not scroll.
    m.viewport.scrollTop = 0;
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 50 }));
    expect(m.viewport.scrollTop, "no scrub after mouseup").toBe(0);
  });

  it("detach removes the rail and its document listeners", () => {
    const m = mountRailed();
    m.handle.setMarkers([{ start: 0.3, end: 0.35, kind: "added" }]);
    const mark = m.rail()!.querySelector<HTMLElement>(".hk-scrollbar-marker")!;
    mark.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientY: 0 }));
    m.handle.detach();
    handles.splice(handles.indexOf(m.handle), 1);
    expect(m.wrapper.querySelectorAll(".hk-scrollbar-marker").length).toBe(0);
    m.viewport.scrollTop = 0;
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 100 }));
    expect(m.viewport.scrollTop, "detach dropped the drag listener").toBe(0);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("ignores setMarkers after detach", () => {
    const m = mountRailed();
    m.handle.detach();
    handles.splice(handles.indexOf(m.handle), 1);
    expect(() => m.handle.setMarkers([{ start: 0, end: 1, kind: "added" }])).not.toThrow();
    expect(m.wrapper.querySelectorAll(".hk-scrollbar-marker").length).toBe(0);
  });
});
