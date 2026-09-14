import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkDatePicker from "./HkDatePicker";
import { setLocale } from "../i18n/context";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
const originalWidth = window.innerWidth;

interface PickerHarness {
  container: HTMLElement;
  emitted: Array<string | null>;
}

function mountPicker(props: Record<string, unknown> = {}): PickerHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref(props.modelValue as string | null ?? null);
  const emitted: Array<string | null> = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkDatePicker, {
          ...props,
          modelValue: value.value,
          "onUpdate:modelValue": (v: string | null) => { emitted.push(v); value.value = v; },
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, emitted };
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-dp-panel");
}

/** Poll until the drilled view's title button reads `expected`. The drill
 *  transition is frame/timeout based and a fixed 20 ms settle raced it on
 *  the CI runner (the year-grid test once read the previous view's title),
 *  so the view STATE — not a sleep — is what this waits on. */
function titleText(): string {
  return panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.textContent ?? "";
}

async function waitForTitle(expected: string): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    if (titleText() === expected) return;
    if (Date.now() > deadline) {
      throw new Error(`title never became ${JSON.stringify(expected)} (last: ${JSON.stringify(titleText())})`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Generic state poll over the same drill race: wait until `probe` holds
 *  STABLY. A single true evaluation can be a mid-transition transient
 *  (the leaving pane's cells vanish one tick before its container
 *  unmounts), so the probe must hold across a 10 ms window before the
 *  wait resolves — otherwise the raw asserts after it race the teardown
 *  timers (observed on the hosted runner: pickCount read 24 right after
 *  a "settled" poll). */
async function waitForView(desc: string, probe: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  let holdSince: number | null = null;
  for (;;) {
    if (probe()) {
      holdSince ??= Date.now();
      if (Date.now() - holdSince >= 10) return;
    } else {
      holdSince = null;
    }
    if (Date.now() > deadline) throw new Error(`view never reached: ${desc}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

function titleBtn(): HTMLButtonElement | null | undefined {
  return panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn");
}

/** The pick cells of the CURRENT view (months or years, both carry 12). */
function pickCells(): HTMLButtonElement[] {
  return Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell[data-variant='pick']") ?? []);
}

function openViaEnter(harness: PickerHarness) {
  const trigger = harness.container.querySelector<HTMLElement>(".hk-dp-trigger");
  trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

function dayCells(): HTMLButtonElement[] {
  return Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell") ?? []);
}

function clickDay(day: number) {
  const target = dayCells().find((c) => c.textContent === String(day) && !c.classList.contains("is-out"));
  target?.click();
}

/** Pretend the viewport is touch-sized so `useBreakpoint` reports mobile. */
function useMobileViewport() {
  (window as unknown as { innerWidth: number }).innerWidth = 375;
}

function nativeInput(root: ParentNode): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>("input.hk-dp-native");
}

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.querySelectorAll(".hk-dp-panel, .hk-popover-backdrop").forEach((el) => el.remove());
  (window as unknown as { innerWidth: number }).innerWidth = originalWidth;
  await setLocale("en");
});

describe("HkDatePicker", () => {
  it("renders the trigger with a placeholder when the value is null", () => {
    const p = mountPicker({ placeholder: "Choose a day" });
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    expect(value).not.toBeNull();
    expect(value?.getAttribute("data-empty")).not.toBeUndefined();
    expect(value?.textContent).toContain("Choose a day");
    expect(p.container.querySelector(".hk-dp-clear")).toBeNull();
  });

  it("falls back to a localized default placeholder when none is given", () => {
    const p = mountPicker();
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    expect(value?.textContent).toContain("Pick a date");
  });

  it("re-derives the displayed date from Intl when the locale changes", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    expect(value?.textContent).toContain("Aug 16, 2026");
    await setLocale("zh-Hans");
    await nextTick();
    const zh = new Intl.DateTimeFormat("zh-Hans", { dateStyle: "medium" }).format(
      new Date(2026, 7, 16),
    );
    expect(value?.textContent).toContain(zh);
  });

  it("shows the selected date localized via Intl for the active locale", () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    const expected = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
      new Date(2026, 7, 16),
    );
    expect(value?.getAttribute("data-empty")).toBeNull();
    expect(value?.textContent).toContain(expected);
  });

  it("opens the popup on Enter on the trigger and closes on Escape", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    expect(panel()).toBeNull();
    openViaEnter(p);
    await nextTick();
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelectorAll(".hk-dp-cell").length).toBe(42);

    panel()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitForView("the popup to close on Escape", () => panel() === null);
  });

  it("derives weekday header labels from Intl for the locale", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const labels = Array.from(panel()?.querySelectorAll<HTMLElement>(".hk-dp-wd") ?? [])
      .map((el) => el.textContent);
    const expected = Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(new Date(2024, 0, 7 + i)));
    expect(labels).toEqual(expected);
  });

  it("selecting a day emits the ISO date and closes the popup", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    clickDay(20);
    await nextTick();
    expect(p.emitted).toEqual(["2026-08-20"]);
    await waitForView("the popup to close after picking a day", () => panel() === null);
  });

  it("disables days outside the inclusive min/max bounds", async () => {
    const p = mountPicker({ modelValue: "2026-08-16", min: "2026-08-10", max: "2026-08-20" });
    openViaEnter(p);
    await nextTick();
    const byDay = new Map(
      dayCells().filter((c) => !c.classList.contains("is-out")).map((c) => [c.textContent ?? "", c]),
    );
    expect(byDay.get("9")?.disabled).toBe(true);
    expect(byDay.get("10")?.disabled).toBe(false);
    expect(byDay.get("20")?.disabled).toBe(false);
    expect(byDay.get("21")?.disabled).toBe(true);
  });

  it("blocked days never emit an update when clicked", async () => {
    const p = mountPicker({ modelValue: "2026-08-16", max: "2026-08-20" });
    openViaEnter(p);
    await nextTick();
    clickDay(25);
    await nextTick();
    expect(p.emitted).toEqual([]);
  });

  it("clearing emits null and empties the trigger", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    const clear = p.container.querySelector<HTMLButtonElement>(".hk-dp-clear");
    expect(clear).not.toBeNull();
    clear?.click();
    await nextTick();
    expect(p.emitted).toEqual([null]);
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    expect(value?.getAttribute("data-empty")).not.toBeUndefined();
    expect(p.container.querySelector(".hk-dp-clear")).toBeNull();
  });

  it("does not render the clear button when clearable is false", () => {
    const p = mountPicker({ modelValue: "2026-08-16", clearable: false });
    expect(p.container.querySelector(".hk-dp-clear")).toBeNull();
  });

  it("clears from the keyboard with Backspace on the trigger", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    const trigger = p.container.querySelector<HTMLElement>(".hk-dp-trigger");
    trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([null]);
    expect(p.container.querySelector<HTMLElement>(".hk-dp-value")?.getAttribute("data-empty")).not.toBeNull();
  });

  it("toggles the popup on trigger click and ignores clicks when disabled", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    const trigger = p.container.querySelector<HTMLElement>(".hk-dp-trigger");
    trigger?.click();
    await nextTick();
    expect(panel()).not.toBeNull();
    trigger?.click();
    await waitForView("the popup to close on trigger toggle", () => panel() === null);

    const d = mountPicker({ modelValue: "2026-08-16", disabled: true });
    const disabledTrigger = d.container.querySelector<HTMLElement>(".hk-dp-trigger");
    disabledTrigger?.click();
    await nextTick();
    expect(panel()).toBeNull();
    expect(disabledTrigger?.tabIndex).toBe(-1);
  });

  it("moves between months with the prev and next arrows", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const header = () => panel()?.querySelector<HTMLElement>(".hk-dp-title")?.textContent ?? "";
    const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" });
    const aug = fmt.format(new Date(2026, 7, 1));
    expect(header()).toContain(aug);

    const navs = () => panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-nav");
    navs()?.[1].click();
    await nextTick();
    expect(header()).toContain(fmt.format(new Date(2026, 8, 1)));

    navs()?.[0].click();
    await nextTick();
    expect(header()).toContain(aug);
  });

  it("marks the selected day and today in the grid", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const selected = panel()?.querySelector(".hk-dp-cell.is-selected");
    expect(selected?.textContent).toBe("16");
    // Today carries the highlight only when it falls inside the viewed month.
    const now = new Date();
    const todayInView = now.getFullYear() === 2026 && now.getMonth() === 7;
    expect(panel()?.querySelectorAll(".hk-dp-cell.is-today").length).toBe(todayInView ? 1 : 0);
  });

  it("treats an invalid ISO modelValue as empty and shows the placeholder", () => {
    const p = mountPicker({ modelValue: "2026-02-31" });
    const value = p.container.querySelector<HTMLElement>(".hk-dp-value");
    expect(value?.getAttribute("data-empty")).not.toBeNull();
    expect(value?.textContent).toContain("Pick a date");
    expect(p.container.querySelector(".hk-dp-clear")).toBeNull();
  });

  it("emits a leap-day ISO date when selecting February 29", async () => {
    const p = mountPicker({ modelValue: "2028-02-01" });
    openViaEnter(p);
    await nextTick();
    clickDay(29);
    await nextTick();
    expect(p.emitted).toEqual(["2028-02-29"]);
  });

  it("rolls over December to January of the next year via the arrows", async () => {
    const p = mountPicker({ modelValue: "2026-12-15" });
    openViaEnter(p);
    await nextTick();
    const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" });
    expect(panel()?.querySelector<HTMLElement>(".hk-dp-title")?.textContent).toContain(
      fmt.format(new Date(2026, 11, 1)),
    );
    const navs = () => panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-nav");
    navs()?.[1].click();
    await nextTick();
    expect(panel()?.querySelector<HTMLElement>(".hk-dp-title")?.textContent).toContain(
      fmt.format(new Date(2027, 0, 1)),
    );
    // Back across the year boundary again.
    navs()?.[0].click();
    await nextTick();
    expect(panel()?.querySelector<HTMLElement>(".hk-dp-title")?.textContent).toContain(
      fmt.format(new Date(2026, 11, 1)),
    );
  });

  it("jumps to today from the footer button", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const todayBtn = panel()?.querySelector<HTMLButtonElement>(".hk-dp-footer button");
    todayBtn?.click();
    await nextTick();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(p.emitted).toEqual([expected]);
  });

  // ── Month / year drill-down views ──────────────────────────────

  it("drills into the month grid from the header title and back to days", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const stage = panel()?.querySelector<HTMLElement>(".hk-dp-stage");
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.click();
    // Wait out the drill transition before reading the grid: a raced
    // read still sees the leaving days pane (54 cells).
    await waitForView("the months grid settled to one pane", () =>
      panel()?.querySelectorAll(".hk-dp-cell").length === 12);
    expect(stage?.getAttribute("data-dir")).toBe("fwd");
    const picks = Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell[data-variant='pick']") ?? []);
    expect(picks.length).toBe(12);
    expect(picks.map((c) => c.textContent)).toEqual(
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2024, i, 15))),
    );
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-back")?.click();
    await waitForView("the days grid settled to one pane", () =>
      panel()?.querySelectorAll(".hk-dp-cell").length === 42);
    expect(stage?.getAttribute("data-dir")).toBe("back");
  });

  it("picks a year from the year grid and lands back on days with that year", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    // Every drill below waits for the DESTINATION view's state, not a
    // fixed settle: the transition is frame/timeout based and the CI
    // runner raced both the days→months click (the second click landed
    // mid-transition and was swallowed) and the months→years read.
    // days → months: the title button becomes the view year.
    titleBtn()?.click();
    await waitForView("the months grid of 2026", () => titleText() === "2026");
    // months → years (the year button is the months-view title): the
    // 2016–2027 block of the 2026 view year holds a 2027 cell.
    titleBtn()?.click();
    await waitForView("the year grid showing 2027", () =>
      pickCells().some((c) => c.textContent === "2027"));
    pickCells().find((c) => c.textContent === "2027")?.click();
    // Picking a year lands on the months grid of that year.
    await waitForTitle("2027");
    pickCells()[6]?.click(); // July
    // ...and picking a month lands back on the days grid.
    await waitForView("the days grid", () => panel()?.querySelectorAll(".hk-dp-cell").length === 42);
    const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" });
    expect(panel()?.querySelector<HTMLElement>(".hk-dp-title")?.textContent).toContain(
      fmt.format(new Date(2027, 6, 1)),
    );
  });

  it("shifts the year with the chevrons inside the month view", async () => {
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.click();
    await waitForTitle("2026");
    const navs = () => panel()?.querySelectorAll<HTMLButtonElement>(".hk-dp-nav");
    navs()?.[1].click();
    await nextTick();
    expect(panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.textContent).toBe("2027");
    navs()?.[0].click();
    await nextTick();
    expect(panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.textContent).toBe("2026");
  });

  it("keeps the same fixed stage node across every view", async () => {
    // happy-dom performs no layout, so the geometry contract is asserted
    // structurally here — one persistent stage element, re-keyed panes —
    // and pixel-verified in the browser demo instead.
    const p = mountPicker({ modelValue: "2026-08-16" });
    openViaEnter(p);
    await nextTick();
    const stage = panel()?.querySelector<HTMLElement>(".hk-dp-stage");
    expect(stage).not.toBeNull();
    expect(stage?.children.length).toBe(1); // the single days pane
    const pickCount = () =>
      stage?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell[data-variant='pick']").length ?? 0;
    // Destination state = the entering pane mounted AND the leaving pane
    // gone; mid-transition both conditions half-hold.
    const settledDrill = (days: boolean) => (): boolean =>
      days
        ? stage?.children.length === 1 &&
          stage?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell:not([data-variant])").length === 42
        : pickCount() === 12 && stage?.children.length === 1;
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.click();
    await waitForView("the months grid settled to one pane", settledDrill(false));
    expect(panel()?.querySelector<HTMLElement>(".hk-dp-stage")).toBe(stage);
    expect(stage?.getAttribute("data-dir")).toBe("fwd");
    expect(stage?.children.length).toBe(1); // one pane at a time after settle
    expect(pickCount()).toBe(12);
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-title-btn")?.click();
    await waitForView("the years grid settled to one pane", settledDrill(false));
    expect(stage?.getAttribute("data-dir")).toBe("fwd");
    expect(pickCount()).toBe(12);
    // back steps down the stack one level at a time: years → months → days.
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-back")?.click();
    await waitForView("the months grid again, one pane", settledDrill(false));
    expect(stage?.getAttribute("data-dir")).toBe("back");
    expect(pickCount()).toBe(12);
    panel()?.querySelector<HTMLButtonElement>(".hk-dp-back")?.click();
    await waitForView("the days grid settled to one pane", settledDrill(true));
    expect(stage?.getAttribute("data-dir")).toBe("back");
    expect(stage?.querySelectorAll<HTMLButtonElement>(".hk-dp-cell:not([data-variant])").length).toBe(42);
  });

  // ── Mobile pass-through to the native OS control ────────────────

  it("renders a native date input instead of the calendar on mobile", () => {
    useMobileViewport();
    const p = mountPicker({ modelValue: "2026-08-16" });
    const input = nativeInput(p.container);
    expect(input).not.toBeNull();
    expect(input?.type).toBe("date");
    expect(input?.value).toBe("2026-08-16");
    expect(p.container.querySelector(".hk-dp-trigger")).toBeNull();
    expect(p.container.querySelector(".hk-dp-panel")).toBeNull();
  });

  it("keeps the custom calendar on mobile when nativeOnMobile is false", async () => {
    useMobileViewport();
    const p = mountPicker({ modelValue: "2026-08-16", nativeOnMobile: false });
    expect(p.container.querySelector(".hk-dp-trigger")).not.toBeNull();
    expect(nativeInput(p.container)).toBeNull();
    openViaEnter(p);
    await nextTick();
    // The custom panel is portaled to the body, not the container.
    expect(panel()).not.toBeNull();
    // Mobile custom calendar gets the enlarged touch geometry variant.
    expect(panel()?.classList.contains("is-touch")).toBe(true);
  });

  it("passes min/max through to the native input", () => {
    useMobileViewport();
    const p = mountPicker({ modelValue: "2026-08-16", min: "2026-08-10", max: "2026-08-20" });
    const input = nativeInput(p.container);
    expect(input?.min).toBe("2026-08-10");
    expect(input?.max).toBe("2026-08-20");
  });

  it("native input edits emit the ISO date and clearing emits null", async () => {
    useMobileViewport();
    const p = mountPicker({ modelValue: "2026-08-16" });
    const input = nativeInput(p.container);
    input!.value = "2026-08-20";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual(["2026-08-20"]);
    expect(input?.value).toBe("2026-08-20");

    input!.value = "";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual(["2026-08-20", null]);
  });

  it("native input edits outside the bounds are rejected and re-synced", async () => {
    useMobileViewport();
    const p = mountPicker({ modelValue: "2026-08-16", max: "2026-08-20" });
    const input = nativeInput(p.container);
    input!.value = "2026-09-01";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([]);
    expect(input?.value).toBe("2026-08-16");
  });
});
