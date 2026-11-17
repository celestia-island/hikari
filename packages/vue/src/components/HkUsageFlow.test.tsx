import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkUsageFlow from "./HkUsageFlow";

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

const ROWS = [
  { source: "caller-a", middle: "up-1", target: "model-x", value: 500 },
  { source: "caller-a", middle: "up-1", target: "model-y", value: 300 },
  { source: "caller-b", middle: "up-2", target: "model-x", value: 200 },
];

function texts(el: HTMLElement, selector: string): string[] {
  return [...el.querySelectorAll(selector)].map((node) => node.textContent ?? "");
}

describe("HkUsageFlow", () => {
  it("renders one bar per staged label and one ribbon per aggregate link", () => {
    const el = mount(<HkUsageFlow rows={ROWS} />);
    // callers (2) + upstreams (2) + models (2)
    expect(el.querySelectorAll(".hk-usage-flow__node")).toHaveLength(6);
    // caller→upstream: a→1, b→2 (2 links); upstream→model: 1→x, 1→y, 2→x (3)
    expect(el.querySelectorAll(".hk-usage-flow__ribbon")).toHaveLength(5);
    const labels = texts(el, ".hk-usage-flow__label");
    expect(labels).toEqual(
      expect.arrayContaining(["caller-a", "caller-b", "up-1", "up-2", "model-x", "model-y"]),
    );
  });

  it("anchors model labels to the left of their bar and caller labels to the right", () => {
    const el = mount(<HkUsageFlow rows={ROWS} />);
    const labels = [...el.querySelectorAll(".hk-usage-flow__label")];
    const byText = new Map(labels.map((label) => [label.textContent, label]));
    expect(byText.get("caller-a")?.getAttribute("text-anchor")).toBe("start");
    expect(byText.get("model-x")?.getAttribute("text-anchor")).toBe("end");
  });

  it("renders every roster model, greyed when it served no traffic", () => {
    const el = mount(
      <HkUsageFlow
        rows={ROWS}
        models={[{ label: "model-x" }, { label: "model-y" }, { label: "model-idle" }]}
      />,
    );
    const rows = [...el.querySelectorAll(".hk-usage-flow__legend-row")];
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.querySelector(".hk-usage-flow__legend-label")?.textContent)).toEqual([
      "model-x",
      "model-y",
      "model-idle",
    ]);
    expect(rows[2].classList.contains("hk-usage-flow__legend-row--idle")).toBe(true);
    expect(rows[0].classList.contains("hk-usage-flow__legend-row--idle")).toBe(false);
    // Shares are computed over the metric total: x = 700/1000, y = 300/1000.
    expect(rows[0].querySelector(".hk-usage-flow__legend-pct")?.textContent).toBe("70%");
    expect(rows[1].querySelector(".hk-usage-flow__legend-pct")?.textContent).toBe("30%");
    expect(rows[2].querySelector(".hk-usage-flow__legend-pct")?.textContent).toBe("0%");
  });

  it("formats values through the host formatter", () => {
    const el = mount(
      <HkUsageFlow rows={ROWS} models={[{ label: "model-x" }]} formatValue={(v) => `${v / 1000}k`} />,
    );
    const first = el.querySelector(".hk-usage-flow__legend-row .hk-usage-flow__legend-value");
    expect(first?.textContent).toBe("0.7k");
    const bar = el.querySelector(".hk-usage-flow__bar");
    expect(bar?.getAttribute("data-hint")).toContain("caller-a");
    expect(bar?.getAttribute("data-hint")).toContain("k");
  });

  it("folds overflowing columns into the localized others bucket", () => {
    const rows = ["a", "b", "c", "d", "e"].map((source) => ({
      source,
      middle: "up",
      target: "model-x",
      value: 10,
    }));
    const el = mount(<HkUsageFlow rows={rows} maxNodes={3} othersLabel="其他调用方" />);
    const labels = texts(el, ".hk-usage-flow__label");
    expect(labels).toContain("其他调用方");
    expect(el.querySelectorAll(".hk-usage-flow__node")).toHaveLength(5); // 3 callers + 1 upstream + 1 model
    const others = [...el.querySelectorAll(".hk-usage-flow__label--others")];
    expect(others.map((node) => node.textContent)).toEqual(["其他调用方"]);
  });

  it("renders the empty state when every row is zero", () => {
    const el = mount(
      <HkUsageFlow rows={[{ source: "a", middle: "b", target: "c", value: 0 }]} emptyText="暂无用量" />,
    );
    expect(el.querySelector(".hk-usage-flow--empty")).toBeTruthy();
    expect(el.querySelector(".hk-usage-flow__empty")?.textContent).toBe("暂无用量");
    expect(el.querySelector(".hk-usage-flow__chart")).toBeNull();
  });

  it("summarises the legend for assistive tech, with an explicit override", () => {
    const el = mount(<HkUsageFlow rows={ROWS} models={[{ label: "model-x" }]} />);
    const svg = el.querySelector(".hk-usage-flow__chart");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toContain("model-x 70%");
    const overridden = mount(<HkUsageFlow rows={ROWS} ariaLabel="模型用量分布" />);
    expect(
      overridden.querySelector(".hk-usage-flow__chart")?.getAttribute("aria-label"),
    ).toBe("模型用量分布");
  });

  it("can hide the legend without dropping the chart", () => {
    const el = mount(<HkUsageFlow rows={ROWS} showLegend={false} />);
    expect(el.querySelector(".hk-usage-flow__chart")).toBeTruthy();
    expect(el.querySelector(".hk-usage-flow__legend")).toBeNull();
  });

  it("keeps the hover hint channel on nodes and ribbons", () => {
    const el = mount(<HkUsageFlow rows={ROWS} />);
    const hints = [
      ...el.querySelectorAll(".hk-usage-flow__ribbon"),
      ...el.querySelectorAll(".hk-usage-flow__bar"),
    ].map((node) => node.getAttribute("data-hint"));
    expect(hints.every((hint) => typeof hint === "string" && hint.length > 0)).toBe(true);
    expect(hints.some((hint) => hint?.includes("caller-a → up-1"))).toBe(true);
  });
});
