import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkDateTimePicker from "./HkDateTimePicker";
import { setLocale } from "../i18n/context";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
const originalWidth = window.innerWidth;

interface PickerHarness {
  container: HTMLElement;
  emitted: Date[];
}

function mountPicker(props: Record<string, unknown> = {}): PickerHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref(props.modelValue as Date ?? new Date(2026, 7, 16, 9, 30));
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
    const zhMonth = new Intl.DateTimeFormat("zh-Hans", { month: "long" }).format(new Date(2026, 7, 1));
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
    expect(stage?.getAttribute("data-dir")).toBe("fwd");
    expect(picker()?.querySelector<HTMLElement>(".hk-dtp-stage")).toBe(stage);
    expect(stage?.children.length).toBe(1); // one pane at a time after settle
    // The time row lives outside the transitioned pane and stays in every
    // view, so the picker's footprint never changes.
    expect(picker()?.querySelectorAll(".hk-dtp-time").length).toBe(1);
    expect(picker()?.querySelectorAll(".hk-dtp-step").length).toBe(2);
    picker()?.querySelector<HTMLButtonElement>(".hk-dtp-back")?.click();
    await settle();
    expect(stage?.getAttribute("data-dir")).toBe("back");
    expect(dayCells().length).toBe(42);
  });

  it("shifts the year with the chevrons inside the month view", async () => {
    mountPicker();
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    expect(picker()?.querySelector<HTMLButtonElement>(".hk-dtp-title-btn")?.textContent).toBe("2026");
    const navs = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-nav");
    navs?.[1].click();
    await nextTick();
    expect(picker()?.querySelector<HTMLButtonElement>(".hk-dtp-title-btn")?.textContent).toBe("2027");
    navs?.[0].click();
    await nextTick();
    expect(picker()?.querySelector<HTMLButtonElement>(".hk-dtp-title-btn")?.textContent).toBe("2026");
  });

  it("time stepper bumps keep the drilled month view instead of snapping back", async () => {
    mountPicker();
    const monthBtn = picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-title-btn")[0];
    monthBtn?.click();
    await settle();
    expect(picker()?.querySelectorAll<HTMLButtonElement>(".hk-dtp-cell[data-variant='pick']").length).toBe(12);
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
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 20]);
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 30]);
  });

  it("disables days outside the inclusive min/max bounds", () => {
    mountPicker({
      min: new Date(2026, 7, 10, 0, 0),
      max: new Date(2026, 7, 20, 23, 59),
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
    const p = mountPicker({ max: new Date(2026, 7, 20, 23, 59) });
    clickDay(25);
    await nextTick();
    expect(p.emitted).toEqual([]);
  });

  it("marks days present in markedDays with a dot", () => {
    mountPicker({ markedDays: new Set(["2026-08-18"]) });
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
    expect(input?.value).toBe("2026-08-16T09:30");
    expect(p.container.querySelector(".hk-dtp")).toBeNull();
    expect(p.container.querySelector(".hk-dtp-grid")).toBeNull();
  });

  it("uses a native date input when showTime is false", () => {
    useMobileViewport();
    const p = mountPicker({ showTime: false });
    const input = nativeInput(p.container);
    expect(input?.type).toBe("date");
    expect(input?.value).toBe("2026-08-16");
  });

  it("passes min/max through to the native input in its wire format", () => {
    useMobileViewport();
    const p = mountPicker({
      min: new Date(2026, 7, 10, 8, 0),
      max: new Date(2026, 7, 20, 18, 30),
    });
    const input = nativeInput(p.container);
    expect(input?.min).toBe("2026-08-10T08:00");
    expect(input?.max).toBe("2026-08-20T18:30");
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
    input!.value = "2026-08-20T14:05";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted.length).toBe(1);
    expect(p.emitted[0].getTime()).toBe(new Date(2026, 7, 20, 14, 5).getTime());
    expect(input?.value).toBe("2026-08-20T14:05");
  });

  it("native date edits preserve the clock time when showTime is false", async () => {
    useMobileViewport();
    const p = mountPicker({ showTime: false });
    const input = nativeInput(p.container);
    input!.value = "2026-08-20";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted[0].getTime()).toBe(new Date(2026, 7, 20, 9, 30).getTime());
  });

  it("native input edits outside the bounds are rejected and re-synced", async () => {
    useMobileViewport();
    const p = mountPicker({ max: new Date(2026, 7, 20, 23, 59) });
    const input = nativeInput(p.container);
    input!.value = "2026-09-01T10:00";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([]);
    expect(input?.value).toBe("2026-08-16T09:30");
  });

  it("clearing the native input falls back to the model value", async () => {
    useMobileViewport();
    const p = mountPicker();
    const input = nativeInput(p.container);
    input!.value = "";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(p.emitted).toEqual([]);
    expect(input?.value).toBe("2026-08-16T09:30");
  });

  it("native input replaces even the popup chrome on mobile", () => {
    useMobileViewport();
    const p = mountPicker({ mode: "popup", confirmLabel: "Confirm" });
    expect(nativeInput(p.container)).not.toBeNull();
    expect(p.container.querySelector(".hk-dtp-trigger")).toBeNull();
  });
});
