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
});
