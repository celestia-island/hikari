import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

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
    // The UTC zone is explicit (R2: a negative-offset host must not
    // land the tooltip a day off) — the date is TZ-deterministic.
    expect(cell.getAttribute("title")).toContain("Dec 1, 2025");
    expect(cell.getAttribute("title")).toContain("5");
    expect(cell.getAttribute("title")).toContain("度");
  });

  it("wires the max prop into the cell buckets, not just data-max", () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        // Peak 10 in-window; the pinned max 100 flattens both days to
        // level 1 (R2 S1: the prop was a dead wire to data-max).
        days: [{ date: CLEAN_HEAD_MON, value: 10 }, { date: "2025-12-02", value: 1 }],
        first: null,
        max: 100,
      }),
    );
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    expect(grid.getAttribute("data-max")).toBe("100");
    expect(grid.querySelectorAll('[data-level="1"]')).toHaveLength(2);
    expect(grid.querySelectorAll('[data-level="4"]')).toHaveLength(0);
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

  it("re-takes today per recompute — a refetch across UTC midnight un-gaps the new today cell", async () => {
    // R2 S2 + R3 变异留证: today frozen at setup rendered the next
    // day as an "after" gap even after the caller refetched a series
    // that includes it. A recompute (the refetch's new `days`) must
    // re-evaluate todayIso() — the crossed-midnight day becomes a day.
    // (A rerender with NO dep change legitimately keeps the cached
    // cells — computed semantics, nothing changed.)
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-12-01T10:00:00Z"));
      // Dense series through the mount-time today: Fri 11-28 .. Mon 12-01.
      const days = daysFrom("2025-11-28", 4);
      const state = reactive({ days });
      // The vnode is built INSIDE the render so the reactive `days`
      // re-renders — the shared eager mount helper would capture one
      // static vnode.
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({
        render: () => h(HkCalendarHeatmap, { days: state.days, first: null, unit: "度" }),
      });
      app.mount(container);
      mounts.push({ app, container });
      const grid = container.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
      const tomorrowAtMount = grid.querySelector('[data-date="2025-12-02"]') as HTMLElement;
      expect(tomorrowAtMount.getAttribute("data-gap")).toBe("after");

      // Cross UTC midnight; the refetched series now includes the new
      // today (12-02, 3 度) — a new array instance, so the cells
      // computed recomputes and re-takes today.
      vi.setSystemTime(new Date("2025-12-02T10:00:00Z"));
      state.days = [...days, { date: "2025-12-02", value: 3 }];
      // Two ticks: the parent's render → the child's props update → the
      // child's re-render land in sequence.
      await nextTick();
      await nextTick();
      const nowToday = grid.querySelector('[data-date="2025-12-02"]') as HTMLElement;
      expect(nowToday.getAttribute("data-gap")).toBeNull();
      expect(nowToday.getAttribute("data-level")).toBe("4");
    } finally {
      vi.useRealTimers();
    }
  });
});
