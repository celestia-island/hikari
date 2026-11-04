import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkBarChart from "./HkBarChart";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
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

const BARS = [
  { label: "Mon", value: 3600, hint: "Mon: 1h" },
  { label: "Tue", value: 7200, hint: "Tue: 2h" },
  { label: "Wed", value: 0 },
];

/** A tiny stand-in for a lucide glyph: any icon FUNCTION draws the
 * 24-unit box the slot-mark wrapper maps onto its 12-unit mark. */
const StarGlyph = () => <rect x="0" y="0" width="24" height="24" />;

describe("HkBarChart", () => {
  it("renders one labeled bar per bucket and skips zero buckets' paths", () => {
    const el = mount(<HkBarChart bars={BARS} />);
    const bars = el.querySelectorAll(".hk-bar-chart__bar");
    expect(bars).toHaveLength(2); // the zero bucket has no path
    expect([...bars].map((b) => b.getAttribute("data-hint"))).toEqual(["Mon: 1h", "Tue: 2h"]);
    const xs = [...el.querySelectorAll(".hk-bar-chart__x")].map((t) => t.textContent);
    expect(xs).toEqual(["Mon", "Tue", "Wed"]);
  });

  it("formats axis guides through the value formatter", () => {
    const el = mount(
      <HkBarChart bars={BARS} formatValue={(v) => `${Math.round(v / 3600)}h`} />,
    );
    const axis = [...el.querySelectorAll(".hk-bar-chart__axis")].map((t) => t.textContent);
    // niceMax(7200s) = 10000s → guides 0 / 5000 / 10000.
    expect(axis).toEqual(["0h", "1h", "3h"]);
  });

  it("shows the empty state when every bucket is zero", () => {
    const el = mount(
      <HkBarChart bars={[{ label: "a", value: 0 }]} emptyText="nothing here" />,
    );
    expect(el.querySelector(".hk-bar-chart--empty")?.textContent).toBe("nothing here");
  });

  it("carries the chart-level aria label", () => {
    const el = mount(<HkBarChart bars={BARS} ariaLabel="weekly playtime" />);
    expect(el.querySelector(".hk-bar-chart")?.getAttribute("aria-label")).toBe(
      "weekly playtime",
    );
  });

  // ── showValues ───────────────────────────────────────────────────

  it("showValues renders formatValue above each bar and skips zero buckets", () => {
    const el = mount(
      <HkBarChart bars={BARS} showValues formatValue={(v) => `${Math.round(v / 3600)}h`} />,
    );
    const values = [...el.querySelectorAll(".hk-bar-chart__value")];
    // The zero bucket (Wed) carries no label — the wowsp tier histogram's
    // old labelY-null behavior: an empty slot never shows a stray "0".
    expect(values.map((t) => t.textContent)).toEqual(["1h", "2h"]);
    // Each label's baseline sits exactly 5 units above its bar's top —
    // the path's y coordinates sit at odd indices ("M x0 y L x0 y… Q x y
    // x y …"), and their minimum IS the top.
    const topOf = (d: string) => {
      const nums = d.split(/[\sMLQAZ]+/).filter(Boolean).map(Number);
      return Math.min(...nums.filter((_, i) => i % 2 === 1));
    };
    const tops = [...el.querySelectorAll(".hk-bar-chart__bar")].map((p) =>
      topOf(p.getAttribute("d") ?? ""),
    );
    expect(Number(values[0].getAttribute("y"))).toBeCloseTo(tops[0] - 5, 6);
    expect(Number(values[1].getAttribute("y"))).toBeCloseTo(tops[1] - 5, 6);
  });

  it("showValues off by default — old usage renders no value labels", () => {
    const el = mount(<HkBarChart bars={BARS} />);
    expect(el.querySelectorAll(".hk-bar-chart__value")).toHaveLength(0);
  });

  // ── hover event + activeIndex dim-pair ───────────────────────────

  it("emits hover on bar mouseenter / mouseleave with focus / blur parity", () => {
    const hovers: (number | null)[] = [];
    const el = mount(<HkBarChart bars={BARS} onHover={(i) => hovers.push(i)} />);
    const bars = [...el.querySelectorAll(".hk-bar-chart__bar")];
    bars[0].dispatchEvent(new Event("mouseenter"));
    bars[1].dispatchEvent(new Event("focus"));
    bars[1].dispatchEvent(new Event("blur"));
    bars[0].dispatchEvent(new Event("mouseleave"));
    expect(hovers).toEqual([0, 1, null, null]);
  });

  it("activeIndex carries data-hot on the paired bar and data-dim on the others", () => {
    const el = mount(<HkBarChart bars={BARS} activeIndex={0} />);
    const bars = [...el.querySelectorAll(".hk-bar-chart__bar")];
    expect(bars[0].getAttribute("data-hot")).toBe("true");
    expect(bars[0].hasAttribute("data-dim")).toBe(false);
    expect(bars[1].getAttribute("data-dim")).toBe("true");
    expect(bars[1].hasAttribute("data-hot")).toBe(false);
  });

  it("defaults to no pair — no data-hot / data-dim anywhere", () => {
    const el = mount(<HkBarChart bars={BARS} />);
    expect(el.querySelector("[data-hot], [data-dim]")).toBeNull();
  });

  // ── icon slot mark (the supership Star) ──────────────────────────

  it("renders a resolvable icon in place of the x-label text, sized and centered", () => {
    const el = mount(
      <HkBarChart
        bars={[
          { label: "10", value: 5, icon: StarGlyph },
          { label: "11", value: 7 },
        ]}
      />,
    );
    const marks = [...el.querySelectorAll(".hk-bar-chart__xmark")];
    expect(marks).toHaveLength(1);
    // The nested-svg wrapper maps the 24-unit lucide box onto a 12-unit
    // mark centered on slot 0 (centerX 182) at the x-label's optical
    // center (baselineY 196 + 4).
    expect(marks[0].getAttribute("viewBox")).toBe("0 0 24 24");
    expect(marks[0].getAttribute("width")).toBe("12");
    expect(marks[0].getAttribute("height")).toBe("12");
    expect(marks[0].getAttribute("x")).toBe("176");
    expect(marks[0].getAttribute("y")).toBe("200");
    // The icon swapped out that slot's text; the other slot keeps its text.
    expect([...el.querySelectorAll(".hk-bar-chart__x")].map((t) => t.textContent)).toEqual([
      "11",
    ]);
    // The bar's aria string keeps the TEXT label, icon or not.
    expect(el.querySelector(".hk-bar-chart__bar")?.getAttribute("aria-label")).toContain("10");
  });

  it("normalizes icons like HkPillToggleGroup — vnode passes through, junk falls back to text", () => {
    const el = mount(
      <HkBarChart
        bars={[
          { label: "a", value: 3, icon: <rect x="4" y="4" width="16" height="16" /> },
          { label: "b", value: 4, icon: "not-an-icon" },
        ]}
      />,
    );
    // The prebuilt vnode rides the mark wrapper; the junk string does not
    // blank the slot — it falls back to the text label.
    expect(el.querySelectorAll(".hk-bar-chart__xmark")).toHaveLength(1);
    expect(el.querySelectorAll(".hk-bar-chart__xmark rect")).toHaveLength(1);
    expect([...el.querySelectorAll(".hk-bar-chart__x")].map((t) => t.textContent)).toEqual(["b"]);
  });

  // ── back-compat: the wowsp PlaytimeView usage surface ────────────

  it("old-props usage renders exactly the old surface", () => {
    const el = mount(
      <HkBarChart
        bars={BARS.map((b) => ({ label: b.label, value: b.value, hint: b.hint }))}
        width={480}
        formatValue={(v) => `${Math.round(v / 3600)}h`}
      />,
    );
    expect(el.querySelectorAll(".hk-bar-chart__bar")).toHaveLength(2);
    expect(el.querySelectorAll(".hk-bar-chart__value")).toHaveLength(0);
    expect(el.querySelectorAll(".hk-bar-chart__xmark")).toHaveLength(0);
    expect(el.querySelector("[data-hot], [data-dim]")).toBeNull();
    expect([...el.querySelectorAll(".hk-bar-chart__x")].map((t) => t.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
    ]);
  });
});
