// Component-side cases for the SVG trend chart (the mirror's render-layer
// cases, mounted for real through happy-dom). The pure geometry cases live
// in ./trendGeometry.test.ts, ported from the Rust mirror's cfg(test).
//
// AI-generated (glm-5.3-flash via DeepSeek Harness), 2026-11-03 — SySL-1.0 §2.3.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import HkTrendChart from "./HkTrendChart";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkTrendChart, props) });
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

const CPU = { label: "cpu", data: [{ time: 0, value: 1 }, { time: 5000, value: 4 }] };

describe("HkTrendChart", () => {
  it("renders the mirror's DOM contract on its own contents host", () => {
    const el = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    // The root div: class hook + the old echarts wrapper's inline box.
    const root = el.querySelector("div.hk-trend-chart") as HTMLElement;
    expect(root).not.toBeNull();
    // Vue serializes the inline style normalized; the box itself is the
    // old wrapper's "width:100%;height:240px".
    expect(root.style.width).toBe("100%");
    expect(root.style.height).toBe("240px");
    // The SVG mounts on its own display:contents host, exactly as the Rust
    // mirror documents.
    const host = root.firstElementChild as HTMLElement;
    expect(host.style.display).toBe("contents");
    const svg = host.querySelector("svg.hk-trend-chart__svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 240");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    // One area + one line per pen, drawn with the token ladder.
    expect(el.querySelectorAll("path.hk-trend-chart__area")).toHaveLength(1);
    expect(el.querySelectorAll("polyline.hk-trend-chart__line")).toHaveLength(1);
    const line = el.querySelector("polyline.hk-trend-chart__line")!;
    expect(line.getAttribute("points")).toBe("50,200 620,30");
    expect(line.getAttribute("stroke")).toBe("rgb(var(--color-primary))");
    expect(line.getAttribute("stroke-width")).toBe("2");
    const area = el.querySelector("path.hk-trend-chart__area")!;
    expect(area.getAttribute("d")).toBe("M 50 200 L 620 30 L 620 200 L 50 200 Z");
    expect(area.getAttribute("fill-opacity")).toBe("0.12");
    // No chart library anywhere: no canvas, no echarts chrome.
    expect(el.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("freezes the window at the newest sample when no now prop is given", () => {
    // now defaults to the newest sample (5000), so the visible geometry is
    // identical to the pinned now: 5000 render above — no empty window.
    const el = mount({ pens: [CPU], timeWindowMs: 5000 });
    expect(el.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,200 620,30",
    );
  });

  it("renders threshold guides into the markup, and only then", () => {
    const el = mount({
      pens: [{ label: "cpu", data: [{ time: 0, value: 1 }, { time: 1000, value: 9 }], thresholds: { hh: 8 } }],
      now: 1000,
      timeWindowMs: 1000,
    });
    const guide = el.querySelector("line.hk-trend-chart__threshold")!;
    expect(guide).not.toBeNull();
    expect(guide.getAttribute("x1")).toBe("50");
    expect(guide.getAttribute("x2")).toBe("620");
    expect(guide.getAttribute("stroke")).toBe("#FF1744");
    expect(guide.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(guide.getAttribute("stroke-width")).toBe("1");

    const bare = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    expect(bare.querySelectorAll("line.hk-trend-chart__threshold")).toHaveLength(0);
    // showThresholds: false wins over present limits.
    const hidden = mount({
      pens: [{ label: "cpu", data: [{ time: 0, value: 1 }], thresholds: { hh: 8 } }],
      now: 0,
      showThresholds: false,
    });
    expect(hidden.querySelectorAll("line.hk-trend-chart__threshold")).toHaveLength(0);
  });

  it("lifts a px height into the viewBox and keeps non-px lengths out", () => {
    const px = mount({ pens: [CPU], height: "120px" });
    expect((px.querySelector("div.hk-trend-chart") as HTMLElement).style.height).toBe("120px");
    expect(px.querySelector("svg.hk-trend-chart__svg")!.getAttribute("viewBox")).toBe("0 0 640 120");

    const rem = mount({ pens: [CPU], height: "18rem" });
    expect((rem.querySelector("div.hk-trend-chart") as HTMLElement).style.height).toBe("18rem");
    expect(rem.querySelector("svg.hk-trend-chart__svg")!.getAttribute("viewBox")).toBe(
      "0 0 640 240",
    );

    // An empty height keeps the viewBox-derived px on the root box.
    const empty = mount({ pens: [CPU], height: "" });
    expect((empty.querySelector("div.hk-trend-chart") as HTMLElement).style.height).toBe("240px");
  });

  it("is deterministic: same props, same markup (offline pre-render)", () => {
    const a = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    const b = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    expect(a.querySelector("div.hk-trend-chart")!.innerHTML).toBe(
      b.querySelector("div.hk-trend-chart")!.innerHTML,
    );
  });

  it("re-renders streaming updates through reactive pens", async () => {
    const pens = ref([{ label: "cpu", data: [{ time: 0, value: 1 }] }]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => h(HkTrendChart, { pens: pens.value, now: 1000, timeWindowMs: 1000 }) });
    app.mount(container);
    mounts.push({ app, container });
    expect(container.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,115",
    );
    pens.value = [{ label: "cpu", data: [{ time: 0, value: 1 }, { time: 1000, value: 4 }] }];
    await nextTick();
    expect(container.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,200 620,30",
    );
  });

  it("stays dependency-free (no echarts import, no echarts dep)", () => {
    // The old build lazily imported echarts/core; the rewrite must not let
    // it back in — pinned at the source and manifest level, the same way
    // componentSelfSufficiency reads sources.
    const here = dirname(fileURLToPath(import.meta.url));
    for (const name of ["HkTrendChart.tsx", "trendGeometry.ts"]) {
      const source = readFileSync(resolve(here, name), "utf8").replace(/\r\n/g, "\n");
      expect(
        /(?:from\s*|import\s*\(\s*)["']echarts/.test(source),
        `${name}: chart library import`,
      ).toBe(false);
      // No side-effect import (i.e. no stylesheet — the mirror's styles()
      // is empty by design).
      expect(source.includes('import "'), `${name}: side-effect import`).toBe(false);
    }
    const pkg = JSON.parse(
      readFileSync(resolve(here, "../../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain("echarts");
  });
});
