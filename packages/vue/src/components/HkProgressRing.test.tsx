import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkProgressRing, { PROGRESS_RING_SEG_GAP_PCT } from "./HkProgressRing";

/**
 * HkProgressRing segmented-mode contract tests:
 * - `segments` renders one circle per visible segment with cumulative
 *   dashoffset math and a carved inter-segment gap
 * - without `segments` the single-value fill behavior is untouched
 * - segments-mode aria-valuenow is the sum of the segment values
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkProgressRing, props as never) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function dashParts(el: Element): { len: number; off: number; total: number } {
  const len = Number(el.getAttribute("stroke-dasharray")?.split(/\s+/)[0]);
  const off = Number(el.getAttribute("stroke-dashoffset"));
  return { len, off, total: len + Number(el.getAttribute("stroke-dasharray")?.split(/\s+/)[1]) };
}

describe("HkProgressRing segmented mode", () => {
  // size 120, strokeWidth 8 -> r = 56
  const R = (120 - 8) / 2;
  const C = 2 * Math.PI * R;

  it("renders one circle per visible segment with cumulative offsets and gaps", () => {
    const c = mount({
      segments: [
        { value: 25, color: "#f00" },
        { value: 25, color: "#0f0" },
      ],
    });
    const segs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(segs).toHaveLength(2);
    expect(c.querySelector(".hk-progress-ring-fill")).toBeNull();

    // First segment starts at the ring origin; its drawn length loses the
    // inter-segment gap (it has a following sibling).
    const first = dashParts(segs[0]);
    expect(first.len).toBeCloseTo(((25 - PROGRESS_RING_SEG_GAP_PCT) / 100) * C, 6);
    expect(first.off).toBeCloseTo(C, 6); // offset = C * (1 - start/100), start 0
    expect((segs[0] as SVGElement).style.stroke).toBe("#f00");

    // Second segment starts at 25% of the ring; no gap carved after the
    // last arc, so its drawn length is its full share.
    const second = dashParts(segs[1]);
    expect(second.len).toBeCloseTo((25 / 100) * C, 6);
    expect(second.off).toBeCloseTo(C * (1 - 25 / 100), 6);
    expect((segs[1] as SVGElement).style.stroke).toBe("#0f0");

    // The gap leaves no overlap: the arcs stay inside [0, 50%).
    expect(second.off).toBeCloseTo(first.off - first.len - (PROGRESS_RING_SEG_GAP_PCT / 100) * C, 6);
  });

  it("carves no gap after the last segment (full 100 fills the ring)", () => {
    const c = mount({ segments: [{ value: 100, color: "#00f" }] });
    const segs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(segs).toHaveLength(1);
    const d = dashParts(segs[0]);
    expect(d.len).toBeCloseTo(C, 6);
  });

  it("skips zero-value segments entirely", () => {
    const c = mount({ segments: [{ value: 0, color: "#f00" }, { value: 50 }] });
    const segs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(segs).toHaveLength(1);
    const d = dashParts(segs[0]);
    expect(d.len).toBeCloseTo((50 / 100) * C, 6);
    // start stays at the origin — the zero segment claimed nothing
    expect(d.off).toBeCloseTo(C, 6);
  });

  it("reports the segment sum as aria-valuenow", () => {
    const c = mount({
      segments: [
        { value: 25 },
        { value: 25 },
        { value: 25 },
      ],
    });
    const ring = c.querySelector(".hk-progress-ring");
    expect(ring?.getAttribute("role")).toBe("progressbar");
    expect(ring?.getAttribute("aria-valuenow")).toBe("75");
    expect(ring?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("appends the segment class and keeps the track circle", () => {
    const c = mount({
      segments: [{ value: 40, class: "my-seg" }],
    });
    const seg = c.querySelector(".hk-progress-ring-seg.my-seg");
    expect(seg).not.toBeNull();
    expect(c.querySelector(".hk-progress-ring-track")).not.toBeNull();
  });
});

describe("HkProgressRing single-value mode (backward compat)", () => {
  it("renders the legacy fill without segments", () => {
    const c = mount({ value: 25 });
    expect(c.querySelectorAll(".hk-progress-ring-seg")).toHaveLength(0);
    const fill = c.querySelector(".hk-progress-ring-fill");
    expect(fill).not.toBeNull();
    const R = (120 - 8) / 2;
    const C = 2 * Math.PI * R;
    const off = Number(fill?.getAttribute("stroke-dashoffset"));
    expect(off).toBeCloseTo(C * (1 - 25 / 100), 6);
    expect(c.querySelector(".hk-progress-ring")?.getAttribute("aria-valuenow")).toBe("25");
  });

  it("still honours pct over value", () => {
    const c = mount({ value: 10, pct: 40 });
    const fill = c.querySelector(".hk-progress-ring-fill");
    const R = (120 - 8) / 2;
    const C = 2 * Math.PI * R;
    expect(Number(fill?.getAttribute("stroke-dashoffset"))).toBeCloseTo(C * 0.6, 6);
  });
});
