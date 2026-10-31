import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkDonutChart from "./HkDonutChart";
import type { HkDonutEntry } from "./donutGeometry";

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

const ENTRIES: HkDonutEntry[] = [
  { key: "dd", label: "Destroyer", value: 60 },
  { key: "ca", label: "Cruiser", value: 30 },
  { key: "bb", label: "Battleship", value: 10 },
];

describe("HkDonutChart", () => {
  it("renders one slice + legend row per positive entry", () => {
    const el = mount(<HkDonutChart entries={ENTRIES} />);
    expect(el.querySelectorAll(".hk-donut__slice")).toHaveLength(3);
    const rows = [...el.querySelectorAll(".hk-donut__legend-row")];
    expect(rows.map((r) => r.querySelector(".hk-donut__legend-label")?.textContent)).toEqual([
      "Destroyer",
      "Cruiser",
      "Battleship",
    ]);
    expect(rows.map((r) => r.querySelector(".hk-donut__legend-pct")?.textContent)).toEqual([
      "60%",
      "30%",
      "10%",
    ]);
  });

  it("defaults hints to label · value · percent", () => {
    const el = mount(<HkDonutChart entries={ENTRIES} />);
    const first = el.querySelector(".hk-donut__slice");
    expect(first?.getAttribute("data-hint")).toBe("Destroyer · 60 · 60%");
    expect(first?.getAttribute("aria-label")).toBe("Destroyer · 60 · 60%");
  });

  it("honors a custom hint formatter", () => {
    const el = mount(
      <HkDonutChart entries={ENTRIES} hintOf={(s) => `${s.label}: ${s.value} battles`} />,
    );
    expect(el.querySelector(".hk-donut__slice")?.getAttribute("data-hint")).toBe(
      "Destroyer: 60 battles",
    );
  });

  it("chunks the legend into fixed-height columns", () => {
    const many: HkDonutEntry[] = Array.from({ length: 7 }, (_, i) => ({
      key: `k${i}`,
      label: `K${i}`,
      value: 1,
    }));
    const el = mount(<HkDonutChart entries={many} legendRows={3} />);
    const cols = el.querySelectorAll(".hk-donut__legend-col");
    expect(cols).toHaveLength(3);
    expect(cols[2].querySelectorAll(".hk-donut__legend-row")).toHaveLength(1);
  });

  it("drops the legend on demand and shows the empty state for all-zero", () => {
    const noLegend = mount(<HkDonutChart entries={ENTRIES} showLegend={false} />);
    expect(noLegend.querySelector(".hk-donut__legend")).toBeNull();
    const empty = mount(<HkDonutChart entries={[{ key: "a", label: "A", value: 0 }]} />);
    expect(empty.querySelector(".hk-donut--empty")).toBeTruthy();
  });

  it("renders the legendIcon slot's glyph in place of the text label", () => {
    const el = mount(
      <HkDonutChart
        entries={ENTRIES}
        v-slots={{
          legendIcon: (slice: { key: string }) => <b data-flag={slice.key}>flag</b>,
        }}
      />,
    );
    const rows = [...el.querySelectorAll(".hk-donut__legend-row")];
    expect(rows.map((r) => r.querySelector("[data-flag]")?.getAttribute("data-flag"))).toEqual([
      "dd",
      "ca",
      "bb",
    ]);
    // the plain-text labels are gone; the color dots stay
    expect(rows.every((r) => r.querySelector(".hk-donut__legend-dot"))).toBe(true);
  });

  it("carries the chart-level aria label", () => {
    const el = mount(<HkDonutChart entries={ENTRIES} ariaLabel="ship mix" />);
    expect(el.querySelector(".hk-donut")?.getAttribute("aria-label")).toBe("ship mix");
  });
});
