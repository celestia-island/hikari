import { afterEach, describe, expect, it, vi } from "vitest";

import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "./useOverlayScrollbar";

const handles: OverlayScrollbarHandle[] = [];
const containers: HTMLElement[] = [];

/** Mount a viewport (the scrolling element) inside a wrapper inside a
 *  fresh container: wrapper ← viewport. The wrapper is the track host. */
function mountViewport(axis: "vertical" | "horizontal" | "both" = "vertical") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const wrapper = document.createElement("div");
  const viewport = document.createElement("div");
  wrapper.appendChild(viewport);
  container.appendChild(wrapper);
  const handle = attachOverlayScrollbars(viewport, { axis });
  handles.push(handle);
  return { container, wrapper, viewport, handle };
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
      handle.detach();
    }).not.toThrow();
  });
});
