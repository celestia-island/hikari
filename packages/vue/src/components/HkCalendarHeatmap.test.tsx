import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkCalendarHeatmap from "./HkCalendarHeatmap";
import { HEATMAP_LEVEL_OPACITY, todayIso } from "./calendarHeatmap";

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

/** A Monday, NOT the 1st — the leading-partial-month shape. */
const MID_MONTH_MON = "2025-10-27";
/** A Monday AND the 1st — the clean head shape. */
const CLEAN_HEAD_MON = "2025-12-01";

const daysFrom = (start: string, count: number, value = 0) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), value };
  });

describe("HkCalendarHeatmap", () => {
  it("renders the legend (less → more, five swatches) and the grid anatomy", () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        days: daysFrom(CLEAN_HEAD_MON, 7),
        first: null,
        unit: "度",
      }),
    );
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute("role")).toBe("img");
    // One row of days pads into exactly one week.
    expect(grid.getAttribute("aria-label")).toContain("1");
    const legend = c.querySelector('[data-testid="hk-calendar-heatmap-legend"]');
    expect(legend?.textContent).toContain("Less");
    expect(legend?.textContent).toContain("More");
    expect(c.querySelectorAll("[data-legend-level]")).toHaveLength(
      HEATMAP_LEVEL_OPACITY.length,
    );
    // One week of days, all level 0 (no consumption): plain muted cells.
    expect(grid.querySelectorAll('[data-level="0"]')).toHaveLength(7);
  });

  it("suppresses the leading month marker when the window starts mid-month", async () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        // Trailing-October tail + November: the partial October head is
        // unlabeled, November's Monday carries the only marker.
        days: daysFrom(MID_MONTH_MON, 10),
        first: null,
      }),
    );
    await nextTick();
    const markers = c.querySelectorAll(
      ".hk-calendar-heatmap-markers > span",
    ) as NodeListOf<HTMLElement>;
    expect(markers.length).toBeGreaterThanOrEqual(2);
    expect(markers[0].textContent).toBe(""); // partial October — suppressed
    expect(markers[1].textContent).not.toBe(""); // November — labeled
  });

  it("shows the leading month marker when the grid's first column opens its month", async () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        days: daysFrom(CLEAN_HEAD_MON, 9),
        first: null,
      }),
    );
    await nextTick();
    const markers = c.querySelectorAll(
      ".hk-calendar-heatmap-markers > span",
    ) as NodeListOf<HTMLElement>;
    expect(markers[0].textContent).not.toBe(""); // Dec 1 — labeled
  });

  it("renders gap cells hatched and inert (no tooltip, no level claim)", () => {
    // A one-day series AT today, anchored at first = today: the head
    // padding hatches as "before", the tail as "after" — both phases in
    // one grid, all deterministic against the real clock.
    const today = todayIso();
    const c = mount(
      h(HkCalendarHeatmap, {
        days: [{ date: today, value: 5 }],
        first: today,
      }),
    );
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    const gaps = grid.querySelectorAll("[data-gap]") as NodeListOf<HTMLElement>;
    expect(gaps.length).toBeGreaterThan(0);
    const phases = new Set(
      Array.from(gaps, (gap) => gap.getAttribute("data-gap")),
    );
    expect(phases.has("before")).toBe(true);
    expect(phases.has("after")).toBe(true);
    for (const gap of gaps) {
      expect(gap.getAttribute("aria-hidden")).toBe("true");
      expect(gap.getAttribute("title")).toBeNull();
      expect(gap.style.pointerEvents).toBe("none");
    }
  });

  it("tooltips day cells with the unit when one is given", () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        days: daysFrom(CLEAN_HEAD_MON, 1, 5),
        first: null,
        unit: "度",
      }),
    );
    const cell = c.querySelector('[data-level]:not([data-level="0"])') as HTMLElement;
    expect(cell).toBeTruthy();
    expect(cell.getAttribute("title")).toContain("5");
    expect(cell.getAttribute("title")).toContain("度");
  });

  it("tooltips day cells without a dangling separator when unitless", () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        days: daysFrom(CLEAN_HEAD_MON, 1, 5),
        first: null,
      }),
    );
    const cell = c.querySelector('[data-level]:not([data-level="0"])') as HTMLElement;
    // The unitless title ends at the count — no trailing "· <empty>".
    expect(cell.getAttribute("title")).toMatch(/· 5$/);
  });

  it("labels the weekday rail on the first and last rows only", () => {
    const c = mount(
      h(HkCalendarHeatmap, { days: daysFrom(CLEAN_HEAD_MON, 7), first: null }),
    );
    const rail = c.querySelector(".hk-calendar-heatmap-rail") as HTMLElement;
    const rows = rail.querySelectorAll(":scope > span") as NodeListOf<HTMLElement>;
    expect(rows).toHaveLength(7);
    expect(rows[0].textContent).not.toBe(""); // Monday
    expect(rows[6].textContent).not.toBe(""); // Sunday
    expect(rows[3].textContent).toBe(""); // middle rows unlabeled
  });

  it("renders the toolbar slot right of the legend", () => {
    const Toolbar = defineComponent({
      name: "FakeToolbar",
      setup: () => () => h("div", { "data-fake-toolbar": "" }, "tabs"),
    });
    const c = mount(
      h(HkCalendarHeatmap, { days: daysFrom(CLEAN_HEAD_MON, 7), first: null }, {
        toolbar: () => h(Toolbar),
      }),
    );
    expect(c.querySelector("[data-fake-toolbar]")?.textContent).toBe("tabs");
  });

  it("renders an empty grid without markers for an empty series", () => {
    const c = mount(h(HkCalendarHeatmap, { days: [], first: null }));
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.querySelectorAll("[data-level]")).toHaveLength(0);
    expect(c.querySelectorAll(".hk-calendar-heatmap-markers > span")).toHaveLength(0);
  });
});
