import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

import HkCalendarHeatmap, { HEATMAP_GAP_FILL } from "./HkCalendarHeatmap";
import { HEATMAP_EMPTY_FILL, HEATMAP_LEVEL_OPACITY, shiftIso, type CalendarCell } from "./calendarHeatmap";

/** The shared hover popup's show delay — pinned here so a silent bump
 *  (hover tests going flaky-red) can't ship unnoticed. */
const TOOLTIP_DELAY_MS = 300;
expect(HEATMAP_GAP_FILL).not.toContain("gradient");

const here = dirname(fileURLToPath(import.meta.url));

/** Resolve after two animation frames: the scroll container coalesces its
 *  sensing pass through the shared animationBus, whose rAF is scheduled one
 *  frame ahead of the awaited callback. */
const flushFrames = async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
};

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
  // A failed assertion inside a fake-clock test must not leak the frozen
  // clock into the rest of the file.
  vi.useRealTimers();
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
  it("renders the legend (less → more, the empty swatch + one per level) and the grid anatomy", () => {
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
    // The empty swatch plus one per CONSUMING level.
    expect(c.querySelectorAll("[data-legend-level]")).toHaveLength(
      1 + HEATMAP_LEVEL_OPACITY.length,
    );
    const swatches = c.querySelectorAll("[data-legend-level]") as NodeListOf<HTMLElement>;
    // The empty swatch carries NO opacity step (its wash lives in the
    // fill, HEATMAP_EMPTY_FILL — happy-dom drops color-mix() values, so
    // the ladder is asserted through the opacity channel it does keep).
    expect(swatches[0].style.opacity).toBe("");
    // The swatch levels run 0..4 in order, empty first.
    expect(
      Array.from(swatches, (s) => s.getAttribute("data-legend-level")),
    ).toEqual(["0", "1", "2", "3", "4"]);
    // Consuming levels index the table by level - 1: 1 -> [0] … 4 -> [3].
    expect(swatches[1].style.opacity).toBe(HEATMAP_LEVEL_OPACITY[0]);
    expect(swatches[2].style.opacity).toBe(HEATMAP_LEVEL_OPACITY[1]);
    expect(swatches[3].style.opacity).toBe(HEATMAP_LEVEL_OPACITY[2]);
    expect(swatches[4].style.opacity).toBe(HEATMAP_LEVEL_OPACITY[3]);
    // One week of days, all level 0 (no consumption): plain muted cells.
    expect(grid.querySelectorAll('[data-level="0"]')).toHaveLength(7);
  });

  it("labels the next month on the column carrying its 1st, never the partial head month", async () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        // Trailing-October tail + November. October's 1st is not on the
        // axis, so no slot may carry October; November's 1st (Nov 1, a
        // Saturday) sits in the HEAD column, which is where its marker
        // goes.
        days: daysFrom(MID_MONTH_MON, 10),
        first: null,
      }),
    );
    await nextTick();
    const markers = c.querySelectorAll(
      ".hk-calendar-heatmap-markers > span",
    ) as NodeListOf<HTMLElement>;
    expect(markers.length).toBeGreaterThanOrEqual(2);
    const texts = Array.from(markers, (m) => m.textContent);
    // The head month (its 1st is off-axis) is never labeled.
    expect(texts.some((t) => t?.startsWith("Oct"))).toBe(false);
    expect(texts[0]).not.toBe(""); // November's 1st is in this column
    expect(texts[1]).toBe("");
  });

  it("labels a month on the column carrying its 1st, not one column late", async () => {
    // Grid opens Mon Sep 29: Oct 1 (a Wednesday) is in the head column.
    const c = mount(
      h(HkCalendarHeatmap, {
        days: Array.from({ length: 14 }, (_, i) => ({
          date: shiftIso("2025-09-29", i),
          value: 0,
        })),
        first: null,
      }),
    );
    await nextTick();
    const markers = c.querySelectorAll(
      ".hk-calendar-heatmap-markers > span",
    ) as NodeListOf<HTMLElement>;
    expect(markers[0].textContent).not.toBe(""); // October, mid-column
    expect(markers[1].textContent).toBe("");
  });

  it("reserves trailing room exactly when the last column carries a marker", async () => {
    const padOf = async (days: { date: string; value: number }[]) => {
      const c = mount(h(HkCalendarHeatmap, { days, first: null }));
      await nextTick();
      const markersEl = c.querySelector(
        ".hk-calendar-heatmap-markers",
      ) as HTMLElement;
      const texts = Array.from(
        markersEl.querySelectorAll(":scope > span"),
        (m) => m.textContent,
      );
      return {
        // Logical property: hikari ships RTL hosts (HkMenu reads
        // documentElement.dir), so the reserved room rides inline-end
        // rather than a physical side.
        pad: markersEl.style.paddingInlineEnd,
        lastSet: texts.length > 0 && texts[texts.length - 1] !== "",
      };
    };

    // Positive branch: a single week opening on Dec 1 leaves the marker
    // on the LAST column — its ink needs the reserved room.
    const marked = await padOf(daysFrom(CLEAN_HEAD_MON, 7));
    expect(marked.lastSet).toBe(true);
    expect(marked.pad).not.toBe("");

    // Negative branch: ending on Nov 7 (a Friday) pads the axis to
    // Nov 3–9, so the November marker sits one column in, not last.
    const unmarked = await padOf(daysFrom("2025-10-27", 12));
    expect(unmarked.lastSet).toBe(false);
    expect(unmarked.pad).toBe("");
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

  it("fills the cells through the shared ladder: consuming levels primary, level 0 not", () => {
    // happy-dom drops color-mix() but keeps var(), so the
    // empty-vs-primary distinction IS observable here — a hardcoded
    // primary for level 0 (or a hardcoded fill that ignores the
    // helper) turns this red (R3: the call sites had no pin).
    const c = mount(
      h(HkCalendarHeatmap, {
        days: [
          { date: CLEAN_HEAD_MON, value: 10 },
          { date: "2025-12-02", value: 0 },
        ],
        first: null,
      }),
    );
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    const styleOf = (level: string) =>
      (grid.querySelector(`[data-level="${level}"]`) as HTMLElement).getAttribute(
        "style",
      ) ?? "";
    expect(styleOf("4")).toContain("var(--hi-color-primary)");
    expect(styleOf("0")).not.toContain("--hi-color-primary");
    // The legend rides the same decision: its empty swatch is not
    // primary, every consuming swatch is.
    const swatches = c.querySelectorAll(
      "[data-legend-level]",
    ) as NodeListOf<HTMLElement>;
    expect(swatches[0].getAttribute("style") ?? "").not.toContain(
      "--hi-color-primary",
    );
    for (const level of [1, 2, 3, 4]) {
      expect(swatches[level].getAttribute("style") ?? "").toContain(
        "var(--hi-color-primary)",
      );
    }
  });

  it("applies the opacity ladder by level - 1, leaving level 0 without an opacity step", () => {
    // The empty cell's wash lives in its FILL, never in the opacity
    // table (the old table's index 0 was dead weight) — level 0 must
    // carry no opacity while every consuming level maps to [level - 1].
    const c = mount(
      h(HkCalendarHeatmap, {
        days: [
          { date: CLEAN_HEAD_MON, value: 10 },
          { date: "2025-12-02", value: 5 },
          { date: "2025-12-03", value: 0 },
        ],
        first: null,
      }),
    );
    const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
    const cellAt = (level: string) =>
      grid.querySelector(`[data-level="${level}"]`) as HTMLElement;
    expect(cellAt("4").style.opacity).toBe(HEATMAP_LEVEL_OPACITY[3]);
    expect(cellAt("2").style.opacity).toBe(HEATMAP_LEVEL_OPACITY[1]);
    expect(cellAt("0").style.opacity).toBe("");
  });

  it("renders gap cells dimmed below the empty level, with no level claim", () => {
    // A one-day series AT today, anchored at first = today: the head
    // padding dims as "before", the tail as "after". The clock is
    // PINNED to a Wednesday: with the real clock this test carried
    // both-phase expectations into a Monday (no head padding) or a
    // Sunday (no tail), so it went red two days out of seven
    // (R3 2026-10-30, proven with a mocked clock).
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-12-03T10:00:00Z")); // a Wednesday
      const c = mount(
        h(HkCalendarHeatmap, {
          days: [{ date: "2025-12-03", value: 5 }],
          first: "2025-12-03",
        }),
      );
      const grid = c.querySelector(
        '[data-testid="hk-calendar-heatmap"]',
      ) as HTMLElement;
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
        // The 2026-11 direction: the diagonal hatch is GONE — a gap
        // claims no gradient, no level, no primary ink. (The fill's
        // VALUE rides HEATMAP_GAP_FILL — happy-dom drops color-mix()
        // from a parsed background, so the constant itself is pinned
        // at this file's head and by the source contract below.)
        expect(gap.getAttribute("style") ?? "").not.toContain("gradient");
        expect(gap.getAttribute("style") ?? "").not.toContain("--hi-color-primary");
        expect(gap.getAttribute("data-level")).toBeNull();
        // The ladder must read gap < empty < data (R2 2026-11): the
        // dimmed wash sits BELOW the empty level's wash, parsed from
        // the two exported constants so a percentage drift on either
        // side flips this even with every other gate green.
        const pct = (fill: string) =>
          Number(/(\d+)%/.exec(fill)?.[1] ?? NaN);
        expect(pct(HEATMAP_GAP_FILL)).toBeLessThan(pct(HEATMAP_EMPTY_FILL));
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("paints gap cells with HEATMAP_GAP_FILL, not a hatch (source contract)", () => {
    // happy-dom cannot observe the gap fill through a parsed style, so
    // this pin reads the sheet's wiring: the gap branch of cellStyle
    // must carry the exported dimmed-wash constant — a re-introduced
    // repeating-linear-gradient hatch (or a hand-written fill) turns
    // this red.
    const sheet = readFileSync(join(here, "HkCalendarHeatmap.tsx"), "utf8");
    expect(sheet).not.toContain("repeating-linear-gradient");
    expect(sheet).toContain("background: HEATMAP_GAP_FILL");
  });

  it("without a tooltip slot, day cells keep the native title and no popup ever mounts", async () => {
    vi.useFakeTimers();
    try {
      const c = mount(
        h(HkCalendarHeatmap, {
          days: daysFrom(CLEAN_HEAD_MON, 1, 5),
          first: null,
        }),
      );
      const cell = c.querySelector('[data-level]:not([data-level="0"])') as HTMLElement;
      expect(cell.getAttribute("title")).toContain("Dec 1, 2025");
      cell.dispatchEvent(new Event("pointerover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS);
      await nextTick();
      expect(document.querySelector(".hk-calendar-heatmap-tip")).toBeNull();
      // The old contract stands in full: the gaps stay INERT (R2 2026-11
      // restore — the dimmed wash is presentational, and without a slot
      // nothing can ever engage them). The 5-day fixture spans a whole
      // week, so a guaranteed-gap mount (one day + first anchor) pins it.
      const inert = mount(
        h(HkCalendarHeatmap, {
          days: [{ date: "2025-12-03", value: 5 }],
          first: "2025-12-03",
        }),
      );
      const gap = inert.querySelector("[data-gap]") as HTMLElement;
      expect(gap.style.pointerEvents).toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });

  it("with a tooltip slot, hovering a day cell opens the shared popup with the caller's content", async () => {
    vi.useFakeTimers();
    try {
      const c = mount(
        h(HkCalendarHeatmap, {
          days: daysFrom(CLEAN_HEAD_MON, 1, 5),
          first: null,
        }, {
          tooltip: ({ cell }: { cell: CalendarCell }) =>
            h("div", { "data-tip-for": cell.date }, `tip:${cell.kind}`),
        }),
      );
      // The slot owns the explanation: no native title (it would double
      // up under the popup).
      const cell = c.querySelector('[data-level]:not([data-level="0"])') as HTMLElement;
      expect(cell.getAttribute("title")).toBeNull();

      // Lazy: nothing is teleported until the first engage.
      expect(document.querySelector(".hk-calendar-heatmap-tip")).toBeNull();
      cell.dispatchEvent(new Event("pointerover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS);
      await nextTick();
      const popup = document.querySelector(
        ".hk-calendar-heatmap-tip",
      ) as HTMLElement | null;
      expect(popup, "the shared popup is up after the delay").not.toBeNull();
      expect(popup!.getAttribute("role")).toBe("tooltip");
      expect(popup!.textContent).toBe("tip:day");
      expect(popup!.querySelector('[data-tip-for="2025-12-01"]')).not.toBeNull();
      expect(popup!.classList.contains("hk-tooltip-visible")).toBe(true);

      // Leaving the grid hides it (the popup element stays mounted —
      // lazy on FIRST engage, not per hover).
      const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
      grid.dispatchEvent(new Event("pointerleave", { bubbles: false }));
      await nextTick();
      expect(
        document.querySelector(".hk-calendar-heatmap-tip")!.classList.contains("hk-tooltip-visible"),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the tooltip slot also fires for gap cells — the caller explains 'no data'", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-12-03T10:00:00Z")); // a Wednesday
      const c = mount(
        h(HkCalendarHeatmap, {
          days: [{ date: "2025-12-03", value: 5 }],
          first: "2025-12-03",
        }, {
          tooltip: ({ cell }: { cell: CalendarCell }) =>
            h("div", { "data-tip-kind": cell.kind }, JSON.stringify(cell)),
        }),
      );
      const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;
      const gap = grid.querySelector("[data-gap]") as HTMLElement;
      // With the slot the gaps are the popup's engage surface: they
      // must stay hoverable (synthetic events bypass hit-testing, so
      // only this pin catches a regression to unconditional none).
      expect(gap.style.pointerEvents).not.toBe("none");
      gap.dispatchEvent(new Event("pointerover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS);
      await nextTick();
      const popup = document.querySelector(".hk-calendar-heatmap-tip") as HTMLElement;
      const payload = JSON.parse(
        popup.querySelector("[data-tip-kind]")!.textContent ?? "{}",
      );
      expect(payload).toMatchObject({ kind: "gap", date: gap.getAttribute("data-date") });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a touch pointerleave does not close what a tap opened; a desktop leave does", async () => {
    // Browsers fire the boundary-release chain (pointerleave on the
    // tapped cell) right after a touch pointerup — implicit capture
    // release. The tap-toggle owns touch dismissal, so that synthetic
    // leave must NOT hide the popup (R2 2026-11; the mouse leave path
    // stays). happy-dom does not model the implicit release, which is
    // exactly why this needs its own pin.
    vi.useFakeTimers();
    try {
      const c = mount(
        h(HkCalendarHeatmap, {
          days: daysFrom(CLEAN_HEAD_MON, 1, 5),
          first: null,
        }, {
          tooltip: ({ cell }: { cell: CalendarCell }) =>
            h("div", { "data-tip-for": cell.date }, `tip:${cell.kind}`),
        }),
      );
      const cell = c.querySelector('[data-level]:not([data-level="0"])') as HTMLElement;
      const grid = c.querySelector('[data-testid="hk-calendar-heatmap"]') as HTMLElement;

      // A touch tap arms + shows at once.
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      await nextTick();
      const popup = () => document.querySelector(".hk-calendar-heatmap-tip") as HTMLElement | null;
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(true);

      // The implicit-release leave: same gesture, must not hide.
      grid.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "touch" }));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(true);

      // A mouse (pointerType-less event reads undefined) leave hides.
      grid.dispatchEvent(new PointerEvent("pointerleave", {}));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(false);

      // The tap-toggle owns touch dismissal, so BOTH directions stay
      // pinned: a second tap on the SAME cell closes it…
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(true);
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(false);

      // …and a tap OUTSIDE the grid dismisses a re-opened tooltip.
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(true);
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      await nextTick();
      expect(popup()!.classList.contains("hk-tooltip-visible")).toBe(false);
    } finally {
      vi.useRealTimers();
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
// ── Overlay scroll strip (2026-11-08) ────────────────────────────────────
// The calendar body rides HkScrollContainer now: hikari's auto-hiding
// overlay bar is the only bar, the strip opens focused on the NEWEST day
// (anchor="end"), a host can opt back to the start, and a series
// replacement re-parks at the end. happy-dom performs no layout, so the
// strip's extent is stubbed and a dispatched scroll event runs the
// container's coalesced sensing pass.
describe("HkCalendarHeatmap overlay scroll strip", () => {
  const stripOf = (c: HTMLElement): HTMLElement =>
    c.querySelector<HTMLElement>(".hk-calendar-heatmap-scroll")!;
  const viewportOf = (c: HTMLElement): HTMLElement =>
    c.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;

  /** Mount a live render function (reactive props re-render — the range
   *  switch test replaces the series). */
  function mountLive(render: () => ReturnType<typeof h>): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render });
    app.mount(container);
    mounts.push({ app, container });
    return container;
  }

  /** Give the viewport a scrollable extent. Only the SIZES are stubbed:
   *  the position stays happy-dom's settable scrollLeft, so the park's
   *  write is observable exactly as a reader's scroll would be. */
  function stubStrip(el: HTMLElement, scrollWidth: number, clientWidth: number) {
    Object.defineProperties(el, {
      scrollWidth: { configurable: true, get: () => scrollWidth },
      clientWidth: { configurable: true, get: () => clientWidth },
    });
  }

  it("mounts the overlay chrome over the strip, with the body still inside", () => {
    const c = mount(
      h(HkCalendarHeatmap, { days: daysFrom(CLEAN_HEAD_MON, 7), first: null }),
    );
    const strip = stripOf(c);
    // The class contract survives (consumers style .hk-calendar-heatmap-scroll)
    // and the element IS the scroll container root.
    expect(strip.classList.contains("hk-scroll-container")).toBe(true);
    // hikari's auto-hiding overlay track is the only bar…
    expect(
      c.querySelector('.hk-scrollbar-track[data-axis="horizontal"]'),
    ).not.toBeNull();
    // …the overflow glow is opted in (the strip hides days at its edges)…
    expect(strip.getAttribute("data-overflow-glow")).toBe("true");
    // …and the body still rides inside the scrolling viewport.
    expect(viewportOf(c).querySelector(".hk-calendar-heatmap-body")).not.toBeNull();
  });

  it("keeps native overflow out of the Vue form (source contract)", () => {
    const sheet = readFileSync(join(here, "HkCalendarHeatmap.scss"), "utf8");
    // The -rail/-cells contract is pinned by calendarHeatmapRail.contract;
    // this pin owns the STRIP rule the migration rewrote.
    const scrollRule = sheet.match(/&-scroll \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(scrollRule, "the &-scroll rule still owns the strip box").toContain("&-scroll {");
    // The Vue strip IS the HkScrollContainer root. Any overflow declaration
    // in this rule would bring a NATIVE bar back on top of the overlay chrome
    // (the 2026-11-08 regression this migration fixed).
    expect(scrollRule).not.toMatch(/overflow/);
    // The Rust/WASM renderer still renders the plain div, so the sheet keeps
    // a fallback scroller for it — but ONLY off the container form, and the
    // platform bar stays suppressed (the chart family's native-bar invariant;
    // the Rust form is bar-less until it migrates onto the shared script).
    const fallback =
      sheet.match(/&-scroll:not\(\.hk-scroll-container\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fallback, "the plain-form fallback must exist for the Rust mirror").not.toBe("");
    expect(fallback).toContain("overflow-x: auto");
    expect(fallback).toContain("scrollbar-width: none");
    expect(fallback).toMatch(/&::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/);
    expect(fallback, "the plain form keeps its centering").toContain("margin-inline: auto");
  });

  it("opens focused on the newest end (anchor=end parks the strip)", async () => {
    const c = mount(
      h(HkCalendarHeatmap, { days: daysFrom(CLEAN_HEAD_MON, 7), first: null }),
    );
    const viewport = viewportOf(c);
    stubStrip(viewport, 300, 100);
    viewport.dispatchEvent(new Event("scroll"));
    await flushFrames();
    expect(viewport.scrollLeft, "parked at max = 300 - 100").toBe(200);
  });

  it("forwards anchor=start so a host can opt back to the oldest end", async () => {
    const c = mount(
      h(HkCalendarHeatmap, {
        days: daysFrom(CLEAN_HEAD_MON, 7),
        first: null,
        anchor: "start",
      }),
    );
    const viewport = viewportOf(c);
    stubStrip(viewport, 300, 100);
    viewport.dispatchEvent(new Event("scroll"));
    await flushFrames();
    expect(viewport.scrollLeft).toBe(0);
  });

  it("re-parks at the end when the series is replaced (range switch)", async () => {
    const state = reactive({ days: daysFrom(CLEAN_HEAD_MON, 7) });
    const c = mountLive(() => h(HkCalendarHeatmap, { days: state.days, first: null }));
    const viewport = viewportOf(c);
    stubStrip(viewport, 300, 100);
    viewport.dispatchEvent(new Event("scroll"));
    await flushFrames();
    expect(viewport.scrollLeft, "initial end focus").toBe(200);

    // A reader scrolls back to the oldest day…
    viewport.scrollLeft = 0;
    // …then switches range: the new series must land on ITS newest end
    // (the container's sticky anchor deliberately would not, since the
    // reader is no longer parked — the days watcher is the deterministic
    // re-park).
    state.days = daysFrom("2025-11-01", 30);
    await nextTick();
    await nextTick();
    expect(viewport.scrollLeft).toBe(200);
  });
});
