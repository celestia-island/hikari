import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkWeekdayPicker from "./HkWeekdayPicker";
import { setLocale } from "../i18n/context";
import type { HostWindow } from "../utils/typing";

/**
 * HkWeekdayPicker — the calendar-shaped weekday picker. These cases pin
 * the SELECTION contract (empty model = every day, header/date clicks
 * toggle a weekday, all-seven normalizes back to `[]`), the single band
 * layer behind the grid, month navigation as display-only, the disabled
 * gate and the locale-driven week order.
 */

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
const originalWidth = window.innerWidth;

interface Harness {
  container: HTMLElement;
  /** `update:modelValue` payloads, in order. */
  emitted: number[][];
  /** `change` payloads, in order. */
  changes: number[][];
}

/** August 2026 — the month every case pins its expectations on. Its 1st
 *  is a Saturday, so the leading (Sunday-first) cells belong to July. */
const AUGUST_2026 = new Date(2026, 7, 1);

/** `Intl.Locale#weekInfo` is newer than the ES2022 lib target — probe the
 *  runtime through a cast; the fallback path is a documented behaviour. */
const HAS_WEEK_INFO = (() => {
  try {
    const loc = new Intl.Locale("de-DE") as Intl.Locale & { weekInfo?: unknown };
    return loc.weekInfo !== undefined;
  } catch {
    return false;
  }
})();

function mountPicker(props: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref<number[]>((props.modelValue as number[] | undefined) ?? []);
  const emitted: number[][] = [];
  const changes: number[][] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkWeekdayPicker, {
          initialMonth: AUGUST_2026,
          ...props,
          modelValue: value.value,
          "onUpdate:modelValue": (days: number[]) => {
            emitted.push(days);
            value.value = days;
          },
          onChange: (days: number[]) => {
            changes.push(days);
          },
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, emitted, changes };
}

function weekdayButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(".hk-wp-wd"));
}

function weekdayLabels(container: HTMLElement): string[] {
  return weekdayButtons(container).map((b) => b.textContent ?? "");
}

function cells(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(".hk-wp-cell"));
}

function bands(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".hk-wp-band"));
}

function title(container: HTMLElement): string {
  return container.querySelector<HTMLElement>(".hk-wp-title")?.textContent ?? "";
}

function summary(container: HTMLElement): string {
  return container.querySelector<HTMLElement>(".hk-wp-summary")?.textContent ?? "";
}

function everyChip(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-test="hk-wp-every"]');
  expect(el, "the every-day button renders").not.toBeNull();
  return el!;
}

/** Click the weekday HEADER for a JS weekday (0 = Sunday … 6 = Saturday)
 *  by its localized long name, so the lookup survives week reordering. */
async function clickWeekdayHeader(harness: Harness, jsDay: number, locale = "en") {
  const long = new Intl.DateTimeFormat(locale, { weekday: "long" })
    .format(new Date(2024, 0, 7 + jsDay));
  const button = weekdayButtons(harness.container)
    .find((b) => (b.getAttribute("aria-label") ?? "").includes(long));
  expect(button, `weekday header for ${long} renders`).toBeTruthy();
  button!.click();
  await nextTick();
}

/** Click the in-month date cell carrying `day`. */
async function clickInMonthDay(harness: Harness, day: number) {
  const cell = cells(harness.container)
    .find((c) => c.textContent === String(day) && !c.classList.contains("is-out"));
  expect(cell, `in-month cell ${day} renders`).toBeTruthy();
  cell!.click();
  await nextTick();
}

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
  (window as HostWindow<{ innerWidth: number }>).innerWidth = originalWidth;
  await setLocale("en");
});

describe("HkWeekdayPicker — empty model / every day", () => {
  it("renders a 42-cell grid with seven weekday headers", () => {
    const harness = mountPicker();
    expect(cells(harness.container)).toHaveLength(42);
    expect(weekdayButtons(harness.container)).toHaveLength(7);
    const grid = harness.container.querySelector(".hk-wp-grid");
    expect(grid?.getAttribute("role")).toBe("group");
    // Plain toggle buttons (the house HkDatePicker pattern) rather than
    // gridcells: no row/gridcell parent contract to violate, and each
    // date keeps its native button semantics.
    expect(cells(harness.container).every((c) => c.getAttribute("role") === null)).toBe(true);
    expect(cells(harness.container).every((c) => c.hasAttribute("aria-pressed"))).toBe(true);
  });

  it("treats an empty model as every day: chip pressed, no bands, no aria-pressed headers", () => {
    const harness = mountPicker();
    const chip = everyChip(harness.container);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.textContent).toContain("Every day");
    expect(bands(harness.container)).toHaveLength(0);
    expect(weekdayButtons(harness.container).map((b) => b.getAttribute("aria-pressed")))
      .toEqual(["false", "false", "false", "false", "false", "false", "false"]);
    expect(summary(harness.container)).toContain("Every day");
  });

  it("keeps the month title on the initial month", () => {
    const harness = mountPicker();
    const expected = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" })
      .format(AUGUST_2026);
    expect(title(harness.container)).toBe(expected);
  });

  it("normalizes an all-seven model to the every-day state", () => {
    const harness = mountPicker({ modelValue: [1, 2, 3, 4, 5, 6, 7] });
    expect(everyChip(harness.container).getAttribute("aria-pressed")).toBe("true");
    expect(bands(harness.container)).toHaveLength(0);
  });
});

describe("HkWeekdayPicker — weekday toggling", () => {
  it("selects exactly that weekday when clicked from the empty model", async () => {
    const harness = mountPicker();
    // Monday is JS day 1 → ISO weekday 1.
    await clickWeekdayHeader(harness, 1);
    expect(harness.emitted).toEqual([[1]]);
    expect(harness.changes).toEqual([[1]]);
    expect(everyChip(harness.container).getAttribute("aria-pressed")).toBe("false");
    expect(
      weekdayButtons(harness.container)
        .find((b) => (b.getAttribute("aria-label") ?? "").includes("Monday"))
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("paints exactly one band on the selected column, in one layer behind the grid", async () => {
    const harness = mountPicker({ modelValue: [1, 3] });
    const layers = harness.container.querySelectorAll(".hk-wp-bands");
    expect(layers).toHaveLength(1);
    // The layer is a sibling that precedes the grid, inside the wrapper.
    const wrap = harness.container.querySelector(".hk-wp-grid-wrap");
    expect(wrap?.querySelectorAll(".hk-wp-bands").length).toBe(1);
    const layer = layers[0]!;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(Array.from(wrap!.children).map((c) => c.className)).toEqual([
      "hk-wp-bands",
      "hk-wp-grid",
    ]);
    expect(bands(harness.container)).toHaveLength(2);
    // Monday is the 2nd column (Sunday-first) and Wednesday the 4th —
    // the band carries its column index to the stylesheet.
    const columns = bands(harness.container)
      .map((band) => band.style.getPropertyValue("--hk-wp-col"));
    expect(columns).toEqual(["1", "3"]);
  });

  it("marks the in-month dates of a selected column and leaves the rest plain", () => {
    const harness = mountPicker({ modelValue: [2] }); // Tuesdays
    const active = cells(harness.container).filter((c) => c.classList.contains("is-active"));
    // Five Tuesdays inside August 2026 (4, 11, 18, 25 — plus the
    // out-of-month Tuesday in the trailing week).
    const inMonth = active.filter((c) => !c.classList.contains("is-out"));
    expect(inMonth.map((c) => c.textContent)).toEqual(["4", "11", "18", "25"]);
    expect(active.every((c) => c.getAttribute("aria-pressed") === "true")).toBe(true);
    const plain = cells(harness.container).find((c) => c.textContent === "17");
    expect(plain?.classList.contains("is-active")).toBe(false);
    expect(plain?.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking a date cell toggles that weekday", async () => {
    const harness = mountPicker({ modelValue: [1] });
    // 2026-08-18 is a Tuesday → add 2.
    await clickInMonthDay(harness, 18);
    expect(harness.emitted).toEqual([[1, 2]]);
    expect(harness.changes).toEqual([[1, 2]]);
    // Another Tuesday toggles the same weekday back off.
    await clickInMonthDay(harness, 4);
    expect(harness.emitted.at(-1)).toEqual([1]);
  });

  it("toggles the last selected weekday off into the every-day state", async () => {
    const harness = mountPicker({ modelValue: [1] });
    await clickInMonthDay(harness, 17); // Monday
    expect(harness.emitted).toEqual([[]]);
    expect(everyChip(harness.container).getAttribute("aria-pressed")).toBe("true");
    expect(bands(harness.container)).toHaveLength(0);
  });

  it("normalizes selecting all seven weekdays back to []", async () => {
    const harness = mountPicker();
    const order = [0, 2, 3, 4, 5, 6, 1]; // Sunday … Saturday, Monday last
    for (const jsDay of order) await clickWeekdayHeader(harness, jsDay);
    expect(harness.emitted).toHaveLength(7);
    expect(harness.emitted.at(-1)).toEqual([]);
    // The intermediate payloads grew one weekday at a time.
    expect(harness.emitted.map((days) => days.length)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(bands(harness.container)).toHaveLength(0);
  });

  it("makes out-of-month dates clickable and toggles their weekday", async () => {
    const harness = mountPicker();
    // The Sunday-first grid of August 2026 opens on July 26.
    const leading = cells(harness.container)
      .find((c) => c.textContent === "26" && c.classList.contains("is-out"));
    expect(leading, "the trailing July cell of the first week renders").toBeTruthy();
    leading!.click();
    await nextTick();
    expect(harness.emitted).toEqual([[7]]); // Sunday
  });

  it("re-selecting every day from the chip emits [] once", async () => {
    const harness = mountPicker({ modelValue: [2, 4] });
    everyChip(harness.container).click();
    await nextTick();
    expect(harness.emitted).toEqual([[]]);
    // Pressing the chip again is a no-op, not a duplicate emit.
    everyChip(harness.container).click();
    await nextTick();
    expect(harness.emitted).toEqual([[]]);
  });
});

describe("HkWeekdayPicker — month navigation", () => {
  it("moves the displayed month without touching the selection", async () => {
    const harness = mountPicker({ modelValue: [4] });
    const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" });
    expect(title(harness.container)).toBe(fmt.format(new Date(2026, 7, 1)));

    const navs = harness.container.querySelectorAll<HTMLButtonElement>('[data-test="hk-wp-prev"], [data-test="hk-wp-next"]');
    navs[1]!.click();
    await nextTick();
    expect(title(harness.container)).toBe(fmt.format(new Date(2026, 8, 1)));
    expect(harness.emitted).toEqual([]);
    expect(bands(harness.container)).toHaveLength(1);

    // December → January crosses the year boundary.
    for (let i = 0; i < 4; i += 1) {
      navs[1]!.click();
      await nextTick();
    }
    expect(title(harness.container)).toBe(fmt.format(new Date(2026, 12, 1)));
    expect(title(harness.container)).toBe(fmt.format(new Date(2027, 0, 1)));

    navs[0]!.click();
    await nextTick();
    expect(title(harness.container)).toBe(fmt.format(new Date(2026, 11, 1)));
    expect(harness.emitted).toEqual([]);
  });

  it("keeps the weekday bands after navigating to another month", async () => {
    const harness = mountPicker({ modelValue: [5] }); // Fridays
    harness.container.querySelectorAll<HTMLButtonElement>('[data-test="hk-wp-prev"], [data-test="hk-wp-next"]')[1]!.click();
    await nextTick();
    expect(bands(harness.container)).toHaveLength(1);
    const active = cells(harness.container).filter((c) => c.classList.contains("is-active"));
    expect(active.length).toBeGreaterThan(0);
    // 2026-09-04 is the first Friday of September 2026.
    expect(active.some((c) => c.textContent === "4")).toBe(true);
  });
});

  it("follows a late initialMonth prop without moving the selection", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const month = ref<Date | null>(new Date(2026, 7, 1));
    const Wrapper = defineComponent({
      setup: () => () => h(HkWeekdayPicker, { modelValue: [1], initialMonth: month.value }),
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" });
    expect(title(container)).toBe(fmt.format(new Date(2026, 7, 1)));
    month.value = new Date(2026, 2, 1);
    await nextTick();
    expect(title(container)).toBe(fmt.format(new Date(2026, 2, 1)));
    expect(container.querySelectorAll(".hk-wp-band")).toHaveLength(1);
  });

describe("HkWeekdayPicker — disabled + accessibility", () => {
  it("blocks every interaction when disabled", async () => {
    const harness = mountPicker({ modelValue: [1], disabled: true });
    const root = harness.container.querySelector<HTMLElement>(".hk-wp");
    expect(root?.classList.contains("is-disabled")).toBe(true);
    expect(root?.getAttribute("aria-disabled")).toBe("true");
    const buttons = Array.from(harness.container.querySelectorAll<HTMLButtonElement>("button"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    // A raw event bypasses the browser's own disabled guard, so this pins
    // the component's handler gate as well.
    for (const button of buttons) {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await nextTick();
    expect(harness.emitted).toEqual([]);
  });

  it("gives every weekday header and cell a localized accessible name", () => {
    const harness = mountPicker({ modelValue: [1] });
    const monday = weekdayButtons(harness.container)
      .find((b) => (b.getAttribute("aria-label") ?? "").includes("Monday"));
    expect(monday?.getAttribute("aria-label")).toContain("Select every Monday");
    const full = new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(2026, 7, 17));
    const cell = cells(harness.container).find((c) => c.getAttribute("aria-label") === full);
    expect(cell, "cells are named by their full date").toBeTruthy();
    expect(cell?.textContent).toBe("17");
  });

  it("shows the localized default caption and hides it on demand", () => {
    const withLabel = mountPicker({ label: "Effective days" });
    expect(withLabel.container.querySelector(".hk-wp-label")?.textContent).toBe("Effective days");
    expect(
      withLabel.container.querySelector(".hk-wp-grid")?.getAttribute("aria-label"),
    ).toBe("Effective days");

    const hidden = mountPicker({ label: "Effective days", hideLabel: true });
    expect(hidden.container.querySelector(".hk-wp-label")).toBeNull();
    expect(hidden.container.querySelector(".hk-wp-grid")?.getAttribute("aria-label"))
      .toBe("Effective days");

    const bare = mountPicker();
    expect(bare.container.querySelector(".hk-wp-label")?.textContent).toBe("Active days");
  });

  it("carries the size variant on the root", () => {
    const sm = mountPicker({ size: "sm" });
    expect(sm.container.querySelector(".hk-wp")?.classList.contains("hk-wp-sm")).toBe(true);
    const md = mountPicker();
    expect(md.container.querySelector(".hk-wp")?.classList.contains("hk-wp-md")).toBe(true);
  });
});

describe("HkWeekdayPicker — locale", () => {
  it("reorders the weekday header for a Monday-first locale", async () => {
    const harness = mountPicker({ modelValue: [1] });
    const enShort = new Intl.DateTimeFormat("en", { weekday: "short" });
    expect(weekdayLabels(harness.container)[0]).toBe(enShort.format(new Date(2024, 0, 7)));

    await setLocale("de-DE");
    await nextTick();
    const deShort = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
    if (HAS_WEEK_INFO) {
      // de-DE starts the week on Monday.
      expect(weekdayLabels(harness.container)[0]).toBe(deShort.format(new Date(2024, 0, 8)));
    } else {
      expect(weekdayLabels(harness.container)[0]).toBe(deShort.format(new Date(2024, 0, 7)));
    }
    // The model is locale-independent: the same Monday stays selected.
    expect(
      weekdayButtons(harness.container)
        .find((b) => (b.getAttribute("aria-label") ?? "").includes("Montag"))
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("re-derives the month title from the active locale", async () => {
    const harness = mountPicker();
    await setLocale("zh-Hans");
    await nextTick();
    const expected = new Intl.DateTimeFormat("zh-Hans", { year: "numeric", month: "long" })
      .format(AUGUST_2026);
    expect(title(harness.container)).toBe(expected);
  });
});
