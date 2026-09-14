import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkDateTimePicker from "./HkDateTimePicker";
import { setLocale } from "../i18n/context";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
const originalWidth = window.innerWidth;

/** The fixed model the suite mounts with. Every expected year/month/day
 *  in the assertions derives from THIS constant — never from a bare
 *  literal, and never from Date.now() — so the file cannot rot when a
 *  calendar year rolls over. */
const BASE = new Date(2026, 7, 16, 9, 30);

/** Local-ISO day (`YYYY-MM-DD`) — the native date input's wire format. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local-ISO minute (`YYYY-MM-DDTHH:mm`) — datetime-local's wire format. */
function isoMinute(d: Date): string {
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** A day inside the mounted (BASE) month, optionally with a clock time. */
function dayOf(day: number, hours?: number, minutes?: number): Date {
  return hours === undefined
    ? new Date(BASE.getFullYear(), BASE.getMonth(), day)
    : new Date(BASE.getFullYear(), BASE.getMonth(), day, hours, minutes ?? 0);
}

interface PickerHarness {
  container: HTMLElement;
  emitted: Date[];
}

function mountPicker(props: Record<string, unknown> = {}): PickerHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref(props.modelValue as Date ?? BASE);
  const emitted: Date[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkDateTimePicker, {
          ...props,
          modelValue: value.value,
          "onUpdate:modelValue": (v: Date) => { emitted.push(v); value.value = v; },
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, emitted };
}

/** Let Vue's leave transitions (frame/timeout based) finish in happy-dom. */
async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 20));
  await nextTick();
}

/** Poll until the drilled view's title button reads `expected`. The drill
 *  transition is frame/timeout based and a fixed 20 ms settle raced it
 *  under full-suite load (the assertion once read the days-view title),
 *  so the view STATE — not a sleep — is what this waits on. */
async function waitForTitle(expected: string): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const title = picker()?.querySelector<HTMLButtonElement>(".hk-dtp-title-btn")?.textContent ?? "";
    if (title === expected) return;
    if (Date.now() > deadline) {
      throw new Error(`title never became ${JSON.stringify(expected)} (last: ${JSON.stringify(title)})`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** The pick cells of the drilled months view (exactly 12 once mounted). */
function pickCells(): HTMLButtonElement[] {
  return Array.from(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell[data-variant='pick']") ?? []);
}

/** Generic state poll over the same drill race: wait until `probe` holds. */
async function waitForView(desc: string, probe: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!probe()) {
    if (Date.now() > deadline) throw new Error(`view never reached: ${desc}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

function picker(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-dtp");
}

function dayCells(): HTMLButtonElement[] {
  return Array.from(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell") ?? []);
}

function clickDay(day: number) {
  const target = dayCells().find((c) => c.textContent === String(day) && !c.classList.contains("is-out"));
  target?.click();
}

function weekdayLabels(): string[] {
  return Array.from(picker()?.querySelectorAll<HTMLElement>(".hk-dtp-wd") ?? [])
    .map((el) => el.textContent ?? "");
}

/** Mirror of the component's week-start derivation (ISO 1..6, Sunday → 0). */
function firstWeekdayOfLocale(locale: string): number {
  try {
    const n = Number((new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo?.firstDay);
    if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
  } catch {
    // Fall through to the Sunday default.
  }
  return 0;
}

function expectedWeekdayLabels(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const first = firstWeekdayOfLocale(locale);
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + ((first + i) % 7))));
}

/** Pretend the viewport is touch-sized so `useBreakpoint` reports mobile. */
function useMobileViewport() {
  (window as unknown as { innerWidth: number }).innerWidth = 375;
}

function nativeInput(root: ParentNode = document): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>("input.hk-dtp-native");
}

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.querySelectorAll(".hk-dtp-popup, .hk-popover-backdrop").forEach((el) => el.remove());
  (window as unknown as { innerWidth: number }).innerWidth = originalWidth;
  await setLocale("en");
});

describe("HkDateTimePicker", () => {
  it("renders the inline calendar with a 42-cell month grid", () => {
    const p = mountPicker();
    expect(p.container.querySelector(".hk-dtp")).not.toBeNull();
    expect(dayCells().length).toBe(42);
    expect(p.container.querySelector(".hk-dtp-native")).toBeNull();
  });

  it("derives weekday header labels from Intl for the locale", () => {
    mountPicker();
    expect(weekdayLabels()).toEqual(expectedWeekdayLabels("en"));
  });

  it("keeps the week column order on a Monday-first locale", async () => {
    mountPicker();
    await setLocale("de");
    await nextTick();
    // de-DE weeks start Monday when the runtime exposes weekInfo; the grid
    // start shifts with it, so the first label is Monday's short name.
    const first = new Intl.DateTimeFormat("de", { weekday: "short" }).format(new Date(2024, 0, 1));
    if (firstWeekdayOfLocale("de") === 1) {
      expect(weekdayLabels()[0]).toBe(first);
    }
    expect(weekdayLabels()).toEqual(expectedWeekdayLabels("de"));
  });

  it("re-derives month and weekday labels after a locale switch", async () => {
    mountPicker();
    const zhMonth = new Intl.DateTimeFormat("zh-Hans", { month: "long" }).format(
      new Date(BASE.getFullYear(), BASE.getMonth(), 1),
    );
    await setLocale("zh-Hans");
    await nextTick();
    const title = picker()?.querySelector<HTMLElement>(".hk-dtp-title-btn")?.textContent ?? "";
    expect(title).toContain(zhMonth);
    expect(weekdayLabels()).toEqual(expectedWeekdayLabels("zh-Hans"));
  });

  it("localizes month names in the drill-down grid", async () => {
    mountPicker();
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    // Destination state = the months pane mounted AND the leaving days
    // pane gone — mid-transition both conditions half-hold.
    await waitForView("the months grid settled to one pane", () =>
      pickCells().length === 12 && picker()?.querySelectorAll(".hk-dtp-cell").length === 12);
    const cells = Array.from(picker()?.querySelectorAll<HTMLElement>(".hk-dtp-cell") ?? [])
      .map((c) => c.textContent ?? "");
    const expected = Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2024, i, 15)));
    expect(cells).toEqual(expected);
  });

  it("keeps the time row and the fixed stage across view drills", async () => {
    // happy-dom performs no layout, so the geometry contract is asserted
    // structurally here (persistent stage node, re-keyed panes) and
    // pixel-verified in the browser demo instead.
    mountPicker();
    const stage = picker()?.querySelector<HTMLElement>(".hk-dtp-stage");
    expect(stage).not.toBeNull();
    expect(stage?.children.length).toBe(1); // the single days pane
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    await waitForView("the months grid", () => pickCells().length === 12);
    expect(stage?.getAttribute("data-dir")).toBe("fwd");
    expect(picker()?.querySelector<HTMLElement>(".hk-dtp-stage")).toBe(stage);
    expect(stage?.children.length).toBe(1); // one pane at a time after settle
    // The time row lives outside the transitioned pane and stays in every
    // view, so the picker's footprint never changes.
    expect(picker()?.querySelectorAll(".hk-dtp-time").length).toBe(1);
    expect(picker()?.querySelectorAll(".hk-dtp-step").length).toBe(2);
    picker()?.querySelector<HTMLButtonElement>(".hk-dtp-back")?.click();
    await settle();
    await waitForView("the days grid settled to one pane", () =>
      dayCells().length === 42 && stage?.children.length === 1);
    expect(stage?.getAttribute("data-dir")).toBe("back");
  });

  it("shifts the year with the chevrons inside the month view", async () => {
    mountPicker();
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    await waitForTitle(String(BASE.getFullYear()));
    const navs = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-nav");
    navs?.[1].click();
    await nextTick();
    await waitForTitle(String(BASE.getFullYear() + 1));
    navs?.[0].click();
    await nextTick();
    await waitForTitle(String(BASE.getFullYear()));
  });

  it("time stepper bumps keep the drilled month view instead of snapping back", async () => {
    mountPicker();
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    await waitForView("the months grid", () => pickCells().length === 12);
    expect(pickCells().length).toBe(12);
    // The first step button is "Hour +"; bumping it changes only the time
    // part of the model, which must not yank the view back to days.
    const upBtn = picker()?.querySelector<HTMLButtonElement>(".hk-dtp-step-btn");
    upBtn?.click();
    await nextTick();
    expect(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell[data-variant='pick']").length).toBe(12);
    expect(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell:not([data-variant])").length).toBe(0);
  });

  it("selecting a day emits a new Date preserving the time of day", async () => {
    const p = mountPicker();
    clickDay(20);
    await nextTick();
    expect(p.emitted.length).toBe(1);
    const d = p.emitted[0];
    expect(d instanceof Date).toBe(true);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([BASE.getFullYear(), BASE.getMonth(), 20]);
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 30]);
  });

  it("disables days outside the inclusive min/max bounds", () => {
    mountPicker({
      min: new Date(BASE.getFullYear(), BASE.getMonth(), 10, 0, 0),
      max: new Date(BASE.getFullYear(), BASE.getMonth(), 20, 23, 59),
    });
    const byDay = new Map(
      dayCells().filter((c) => !c.classList.contains("is-out")).map((c) => [c.textContent ?? "", c]),
    );
    expect(byDay.get("9")?.disabled).toBe(true);
    expect(byDay.get("10")?.disabled).toBe(false);
    expect(byDay.get("20")?.disabled).toBe(false);
    expect(byDay.get("21")?.disabled).toBe(true);
  });

  it("blocked days never emit an update when clicked", async () => {
    const p = mountPicker({ max: dayOf(20, 23, 59) });
    clickDay(25);
    await nextTick();
    expect(p.emitted).toEqual([]);
  });

  it("marks days present in markedDays with a dot", () => {
    mountPicker({ markedDays: new Set([isoDay(dayOf(18))]) });
    const marked = Array.from(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell") ?? [])
      .filter((c) => c.querySelector(".hk-dtp-cell-dot"));
    expect(marked.length).toBe(1);
    expect(marked[0].textContent).toBe("18");
  });

  it("opens in popup mode from the trigger button", async () => {
    const p = mountPicker({ mode: "popup", confirmLabel: "Confirm" });
    const trigger = p.container.querySelector<HTMLButtonElement>(".hk-dtp-trigger");
    expect(trigger).not.toBeNull();
    expect(document.querySelector(".hk-dtp-popup")).toBeNull();
    trigger?.click();
    await nextTick();
    expect(document.querySelector(".hk-dtp-popup")).not.toBeNull();
    expect(document.querySelectorAll(".hk-dtp-popup .hk-dtp-cell").length).toBe(42);
  });

  // ── Mobile pass-through to the native OS control ────────────────

  it("renders a native datetime-local input instead of the calendar on mobile", () => {
    useMobileViewport();
    const p = mountPicker();
    const input = nativeInput(p.container);
    expect(input).not.toBeNull();
    expect(input?.type).toBe("datetime-local");
    expect(input?.value).toBe(isoMinute(BASE));
    expect(p.container.querySelector(".hk-dtp")).toBeNull();
    expect(p.container.querySelector(".hk-dtp-grid")).toBeNull();
  });

  it("uses a native date input when showTime is false", () => {
    useMobileViewport();
    const p = mountPicker({ showTime: false });
    const input = nativeInput(p.container);
    expect(input?.type).toBe("date");
    expect(input?.value).toBe(isoDay(BASE));
  });

  it("passes min/max through to the native input in its wire format", () => {
    useMobileViewport();
    const p = mountPicker({ min: dayOf(10, 8, 0), max: dayOf(20, 18, 30) });
    const input = nativeInput(p.container);
    expect(input?.min).toBe(isoMinute(dayOf(10, 8, 0)));
    expect(input?.max).toBe(isoMinute(dayOf(20, 18, 30)));
  });

  it("keeps the custom calendar on mobile when nativeOnMobile is false", () => {
    useMobileViewport();
    const p = mountPicker({ nativeOnMobile: false });
    expect(p.container.querySelector(".hk-dtp")).not.toBeNull();
    expect(dayCells().length).toBe(42);
    expect(nativeInput(p.container)).toBeNull();
    // Mobile custom calendar gets the enlarged touch geometry variant.
    expect(p.container.querySelector(".hk-dtp")?.classList.contains("is-touch")).toBe(true);
  });

  it("native input edits update the model as a local-time Date", async () => {
    useMobileViewport();
    const p = mountPicker();
    const input = nativeInput(p.container);
    input!.value = isoMinute(dayOf(20, 14, 5));
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted.length).toBe(1);
    expect(p.emitted[0].getTime()).toBe(dayOf(20, 14, 5).getTime());
    expect(input?.value).toBe(isoMinute(dayOf(20, 14, 5)));
  });

  it("native date edits preserve the clock time when showTime is false", async () => {
    useMobileViewport();
    const p = mountPicker({ showTime: false });
    const input = nativeInput(p.container);
    input!.value = isoDay(dayOf(20));
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted[0].getTime()).toBe(dayOf(20, 9, 30).getTime());
  });

  it("native input edits outside the bounds are rejected and re-synced", async () => {
    useMobileViewport();
    const p = mountPicker({ max: dayOf(20, 23, 59) });
    const input = nativeInput(p.container);
    // Next month, past the max bound.
    input!.value = isoMinute(new Date(BASE.getFullYear(), BASE.getMonth() + 1, 1, 10, 0));
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([]);
    expect(input?.value).toBe(isoMinute(BASE));
  });

  it("clearing the native input falls back to the model value", async () => {
    useMobileViewport();
    const p = mountPicker();
    const input = nativeInput(p.container);
    input!.value = "";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([]);
    expect(input?.value).toBe(isoMinute(BASE));
  });

  it("native input replaces even the popup chrome on mobile", () => {
    useMobileViewport();
    const p = mountPicker({ mode: "popup", confirmLabel: "Confirm" });
    expect(nativeInput(p.container)).not.toBeNull();
    expect(p.container.querySelector(".hk-dtp-trigger")).toBeNull();
  });
});
