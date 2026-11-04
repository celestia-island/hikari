// Component-side cases for the SVG trend chart (the mirror's render-layer
// cases, mounted for real through happy-dom). The pure geometry cases live
// in ./trendGeometry.test.ts, ported from the Rust mirror's cfg(test).
// The wowsp-migration cases (named guides, dot ink, axis text, yDomain)
// pin the optional extensions and the byte-identical legacy default.
//
// AI-generated (glm-5.3-flash via DeepSeek Harness), 2026-11-03 — SySL-1.0 §2.3.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import HkTrendChart from "./HkTrendChart";
import { renderTrendChartSvg } from "./trendGeometry";

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
/** A [0, 100] series: y(v) = 200 - 1.7v, so tier values land on clean pins. */
const TIER = { label: "tier", data: [{ time: 0, value: 0 }, { time: 5000, value: 100 }] };
/** A [62, 78] series: the stepped-domain fixture (a padded PR percentage). */
const PR = { label: "pr", data: [{ time: 0, value: 62 }, { time: 5000, value: 78 }] };
/** Three samples: enough for three unclamped x ticks. */
const TRIPLE = {
  label: "cpu",
  data: [{ time: 0, value: 1 }, { time: 2500, value: 2.5 }, { time: 5000, value: 4 }],
};

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

  it("keeps the legacy output byte-identical when every new prop is absent", () => {
    // The exact legacy frame, pinned end to end: no guides, no dots, no
    // axis text — the mirror's markup, byte for byte.
    const svg = renderTrendChartSvg([CPU], { now: 5000, timeWindowMs: 5000 });
    expect(svg).toBe(
      `<svg class="hk-trend-chart__svg" viewBox="0 0 640 240" preserveAspectRatio="none" style="display:block;width:100%;height:100%">` +
        `<path class="hk-trend-chart__area" d="M 50 200 L 620 30 L 620 200 L 50 200 Z" fill="rgb(var(--color-primary))" fill-opacity="0.12" stroke="none"/>` +
        `<polyline class="hk-trend-chart__line" points="50,200 620,30" fill="none" stroke="rgb(var(--color-primary))" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
        `</svg>`,
    );
    // The mounted component injects exactly that string — every new prop's
    // default is a no-op. happy-dom re-serializes SVG self-closing tags, so
    // the mount is compared against the pinned string parsed through the
    // same DOM lens (the pure-string equality above already pins the exact
    // bytes).
    const el = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    const parsed = document.createElement("div");
    parsed.innerHTML = svg;
    expect(el.querySelector("svg.hk-trend-chart__svg")!.outerHTML).toBe(
      parsed.querySelector("svg.hk-trend-chart__svg")!.outerHTML,
    );
  });

  it("renders chart-level named guides with labels, color and hint", () => {
    const el = mount({
      pens: [TIER],
      now: 5000,
      timeWindowMs: 5000,
      guides: [{ value: 60, label: "S", color: "#00AA00", dash: "2 2", hint: "s-tier" }],
    });
    // y(60) on the [0, 100] domain: 200 - 0.6 * 170 = 98.
    const guide = el.querySelector("line.hk-trend-chart__guide")!;
    expect(guide).not.toBeNull();
    expect(guide.getAttribute("x1")).toBe("50");
    expect(guide.getAttribute("x2")).toBe("620");
    expect(guide.getAttribute("y1")).toBe("98");
    expect(guide.getAttribute("y2")).toBe("98");
    expect(guide.getAttribute("stroke")).toBe("#00AA00");
    expect(guide.getAttribute("stroke-width")).toBe("1");
    expect(guide.getAttribute("stroke-dasharray")).toBe("2 2");
    expect(guide.getAttribute("data-hint")).toBe("s-tier");
    expect(guide.hasAttribute("stroke-opacity")).toBe(false);
    // The tier label sits inside the plot near the left edge, one step
    // above its line, in the guide's color.
    const label = el.querySelector("text.hk-trend-chart__guide-label")!;
    expect(label.textContent).toBe("S");
    expect(label.getAttribute("x")).toBe("56");
    expect(label.getAttribute("y")).toBe("94");
    expect(label.getAttribute("fill")).toBe("#00AA00");
    expect(label.getAttribute("font-size")).toBe("10");
    expect(label.getAttribute("text-anchor")).toBe("start");

    // Defaults: a quiet currentColor line with the alarm dashed flavor,
    // no label, no hint.
    const quiet = mount({ pens: [TIER], now: 5000, timeWindowMs: 5000, guides: [{ value: 40 }] });
    const line = quiet.querySelector("line.hk-trend-chart__guide")!;
    expect(line.getAttribute("y1")).toBe("132");
    expect(line.getAttribute("stroke")).toBe("currentColor");
    expect(line.getAttribute("stroke-opacity")).toBe("0.35");
    expect(line.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(line.hasAttribute("data-hint")).toBe(false);
    expect(quiet.querySelectorAll("text.hk-trend-chart__guide-label")).toHaveLength(0);

    // Out-of-range guides clip like the alarm lines, labels included.
    const clipped = mount({
      pens: [TIER],
      now: 5000,
      timeWindowMs: 5000,
      guides: [{ value: 150, label: "ghost" }, { value: -20 }],
    });
    expect(clipped.querySelectorAll("line.hk-trend-chart__guide")).toHaveLength(0);
    expect(clipped.querySelectorAll("text.hk-trend-chart__guide-label")).toHaveLength(0);
  });

  it("draws per-sample dots with tier ink and hints", () => {
    const el = mount({
      pens: [
        {
          label: "cpu",
          data: [
            { time: 0, value: 1, fill: "#00FF88" },
            { time: 2500, value: 2.5, fill: "#FF1744", hint: "spike" },
            { time: 5000, value: 4 },
          ],
        },
      ],
      now: 5000,
      timeWindowMs: 5000,
    });
    const dots = el.querySelectorAll("circle.hk-trend-chart__dot");
    expect(dots).toHaveLength(2);
    expect(dots[0].getAttribute("cx")).toBe("50");
    expect(dots[0].getAttribute("cy")).toBe("200");
    expect(dots[0].getAttribute("r")).toBe("3.5");
    expect(dots[0].getAttribute("fill")).toBe("#00FF88");
    expect(dots[0].hasAttribute("data-hint")).toBe(false);
    expect(dots[1].getAttribute("cx")).toBe("335");
    expect(dots[1].getAttribute("cy")).toBe("115");
    expect(dots[1].getAttribute("fill")).toBe("#FF1744");
    expect(dots[1].getAttribute("data-hint")).toBe("spike");
    // Untagged samples stay dot-free.
    const bare = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000 });
    expect(bare.querySelectorAll("circle.hk-trend-chart__dot")).toHaveLength(0);
  });

  it("renders y-axis numbers and applies the guide clearance rule", () => {
    const fmt = (value: number) => value.toFixed(1);
    const el = mount({ pens: [CPU], now: 5000, timeWindowMs: 5000, yAxisFormat: fmt });
    // Floor / mid / ceiling of the shown [1, 4] domain, in the left grid
    // gutter, right-anchored at plotLeft - 6.
    const ticks = el.querySelectorAll("text.hk-trend-chart__y-tick");
    expect(ticks).toHaveLength(3);
    expect(ticks[0].getAttribute("x")).toBe("44");
    expect(ticks[0].getAttribute("y")).toBe("203");
    expect(ticks[0].getAttribute("text-anchor")).toBe("end");
    expect(ticks[0].getAttribute("font-size")).toBe("10");
    expect(ticks[0].textContent).toBe("1.0");
    expect(ticks[1].getAttribute("y")).toBe("118");
    expect(ticks[1].textContent).toBe("2.5");
    expect(ticks[2].getAttribute("y")).toBe("33");
    expect(ticks[2].textContent).toBe("4.0");

    // The floor number always renders; mid/ceiling drop when their
    // gridline sits within yAxisClearancePx of a guide's line. Guide at
    // 2.5 → y 115 (mid), guide at 4 → y 30 (ceiling).
    const dropped = mount({
      pens: [CPU],
      now: 5000,
      timeWindowMs: 5000,
      yAxisFormat: fmt,
      yAxisClearancePx: 9,
      guides: [{ value: 2.5 }, { value: 4 }],
    });
    const kept = dropped.querySelectorAll("text.hk-trend-chart__y-tick");
    expect(kept).toHaveLength(1);
    expect(kept[0].textContent).toBe("1.0");
    // The guides themselves are untouched by the clearance rule.
    expect(dropped.querySelectorAll("line.hk-trend-chart__guide")).toHaveLength(2);

    // Default clearance is 0: even a coincident guide drops nothing.
    const defaultClearance = mount({
      pens: [CPU],
      now: 5000,
      timeWindowMs: 5000,
      yAxisFormat: fmt,
      guides: [{ value: 2.5 }],
    });
    expect(defaultClearance.querySelectorAll("text.hk-trend-chart__y-tick")).toHaveLength(3);
  });

  it("renders baseline x ticks when both count and format are given", () => {
    const at = (timeMs: number) => `@${timeMs}`;
    const el = mount({
      pens: [TRIPLE],
      now: 5000,
      timeWindowMs: 5000,
      xTickCount: 3,
      xTickFormat: at,
    });
    // Three evenly spaced ticks across the shown data's [0, 5000] span,
    // under the baseline (plotBottom + 14).
    const ticks = el.querySelectorAll("text.hk-trend-chart__x-tick");
    expect(ticks).toHaveLength(3);
    expect(ticks[0].getAttribute("x")).toBe("50");
    expect(ticks[0].getAttribute("y")).toBe("214");
    expect(ticks[0].getAttribute("text-anchor")).toBe("middle");
    expect(ticks[0].textContent).toBe("@0");
    expect(ticks[1].getAttribute("x")).toBe("335");
    expect(ticks[1].textContent).toBe("@2500");
    expect(ticks[2].getAttribute("x")).toBe("620");
    expect(ticks[2].textContent).toBe("@5000");

    // The count clamps to the shown sample count.
    const clamped = mount({
      pens: [CPU],
      now: 5000,
      timeWindowMs: 5000,
      xTickCount: 5,
      xTickFormat: at,
    });
    const two = clamped.querySelectorAll("text.hk-trend-chart__x-tick");
    expect(two).toHaveLength(2);
    expect(two[0].textContent).toBe("@0");
    expect(two[1].textContent).toBe("@5000");

    // Half the pair means no ticks at all.
    const onlyCount = mount({ pens: [CPU], xTickCount: 3 });
    const onlyFormat = mount({ pens: [CPU], xTickFormat: at });
    expect(onlyCount.querySelectorAll("text.hk-trend-chart__x-tick")).toHaveLength(0);
    expect(onlyFormat.querySelectorAll("text.hk-trend-chart__x-tick")).toHaveLength(0);
  });

  it("steps the y domain with yDomain (pad / minSpan / floorAtZero)", () => {
    // Absent: today's raw extent [62, 78].
    const raw = mount({ pens: [PR], now: 5000, timeWindowMs: 5000 });
    expect(raw.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,200 620,30",
    );

    // padToMultiple + floorAtZero: span 16 → padded to 20 → the floor
    // anchors at zero and the elevated ceiling re-pads → [0, 80].
    const stepped = mount({
      pens: [PR],
      now: 5000,
      timeWindowMs: 5000,
      yDomain: { padToMultiple: 10, floorAtZero: true },
    });
    expect(stepped.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,68.25 620,34.25",
    );

    // padToMultiple alone pads the span up from the raw floor: [62, 82].
    const padded = mount({
      pens: [PR],
      now: 5000,
      timeWindowMs: 5000,
      yDomain: { padToMultiple: 10 },
    });
    expect(padded.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,200 620,64",
    );

    // minSpan widens a narrow extent: [62, 102] — read back through the
    // y-axis numbers so the domain pins without float needles.
    const widened = mount({
      pens: [PR],
      now: 5000,
      timeWindowMs: 5000,
      yDomain: { minSpan: 40 },
      yAxisFormat: (value: number) => String(value),
    });
    expect(widened.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,200 620,132",
    );
    const widenedTicks = widened.querySelectorAll("text.hk-trend-chart__y-tick");
    expect(widenedTicks).toHaveLength(3);
    expect(widenedTicks[0].textContent).toBe("62");
    expect(widenedTicks[1].textContent).toBe("82");
    expect(widenedTicks[2].textContent).toBe("102");

    // floorAtZero alone anchors at zero and keeps the raw ceiling: [0, 78].
    const floored = mount({
      pens: [PR],
      now: 5000,
      timeWindowMs: 5000,
      yDomain: { floorAtZero: true },
      yAxisFormat: (value: number) => String(value),
    });
    const flooredTicks = floored.querySelectorAll("text.hk-trend-chart__y-tick");
    expect(flooredTicks).toHaveLength(3);
    expect(flooredTicks[0].textContent).toBe("0");
    expect(flooredTicks[1].textContent).toBe("39");
    expect(flooredTicks[2].textContent).toBe("78");

    // A flat series under a stepped domain pads up to one step instead of
    // the flat ±1: [0, 10] keeps the line mid-plot.
    const flat = mount({
      pens: [{ label: "cpu", data: [{ time: 0, value: 5 }, { time: 5000, value: 5 }] }],
      now: 5000,
      timeWindowMs: 5000,
      yDomain: { padToMultiple: 10, floorAtZero: true },
    });
    expect(flat.querySelector("polyline.hk-trend-chart__line")!.getAttribute("points")).toBe(
      "50,115 620,115",
    );
  });

  it("passes preserveAspectRatio through (the default stays none)", () => {
    const meet = mount({ pens: [CPU], preserveAspectRatio: "xMidYMid meet" });
    expect(
      meet.querySelector("svg.hk-trend-chart__svg")!.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMid meet");
    const stretch = mount({ pens: [CPU] });
    expect(
      stretch.querySelector("svg.hk-trend-chart__svg")!.getAttribute("preserveAspectRatio"),
    ).toBe("none");
  });

  it("escapes the consumer strings the new props render into the SVG", () => {
    const svg = renderTrendChartSvg([TIER], {
      now: 5000,
      timeWindowMs: 5000,
      guides: [{ value: 60, label: `<b class="x">&</b>`, hint: `"q"` }],
      yAxisFormat: (value: number) => `<${value}>`,
      xTickCount: 1,
      xTickFormat: (timeMs: number) => "t&t",
    });
    expect(svg).not.toContain(`<b class="x">`);
    expect(svg).toContain("&lt;b class=&quot;x&quot;&gt;&amp;&lt;/b&gt;");
    expect(svg).toContain(`data-hint="&quot;q&quot;"`);
    expect(svg).toContain("&lt;0&gt;");
    expect(svg).toContain("t&amp;t");
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