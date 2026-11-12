import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTimePicker, {
  angleToHour12,
  angleToMinute,
  dialPoint,
  formatHhmm,
  from12Hour,
  parseHhmm,
  snapMinute,
  to12Hour,
} from "./HkTimePicker";
import { setLocale } from "../i18n/context";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface PickerHarness {
  container: HTMLElement;
  emitted: string[];
  changes: string[];
}

function mountPicker(props: Record<string, unknown> = {}): PickerHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref((props.modelValue as string) ?? "");
  const emitted: string[] = [];
  const changes: string[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkTimePicker, {
          ...props,
          modelValue: value.value,
          "onUpdate:modelValue": (v: string) => {
            emitted.push(v);
            value.value = v;
          },
          onChange: (v: string) => changes.push(v),
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, emitted, changes };
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-tp-panel");
}

function trigger(harness: PickerHarness): HTMLElement {
  return harness.container.querySelector<HTMLElement>(".hk-tp-trigger")!;
}

async function openPicker(harness: PickerHarness): Promise<void> {
  trigger(harness).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await nextTick();
}

async function waitFor(description: string, probe: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    if (probe()) return;
    if (Date.now() > deadline) throw new Error(`${description} never happened`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function numbers(): HTMLButtonElement[] {
  return Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-tp-number") ?? []);
}

function clickNumber(label: string): void {
  const target = numbers().find((button) => button.textContent === label);
  if (!target) throw new Error(`dial number ${label} not rendered`);
  target.click();
}

function readoutButtons(): HTMLButtonElement[] {
  return Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-tp-readout-btn") ?? []);
}

function periodButtons(): HTMLButtonElement[] {
  return Array.from(panel()?.querySelectorAll<HTMLButtonElement>(".hk-tp-period-btn") ?? []);
}

function face(): HTMLElement {
  return panel()!.querySelector<HTMLElement>(".hk-tp-face")!;
}

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.querySelectorAll(".hk-tp-panel, .hk-popover-backdrop, .hk-popover-panel").forEach((el) => el.remove());
  vi.useRealTimers();
  await setLocale("en");
});

describe("HkTimePicker helpers", () => {
  it("parses and formats the HH:mm wire format", () => {
    expect(parseHhmm("09:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseHhmm("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseHhmm("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseHhmm("")).toBeNull();
    expect(parseHhmm("24:00")).toBeNull();
    expect(parseHhmm("9:5")).toBeNull();
    expect(parseHhmm(" 07:05 ")).toEqual({ hour: 7, minute: 5 });
    expect(formatHhmm(0, 0)).toBe("00:00");
    expect(formatHhmm(9, 5)).toBe("09:05");
    expect(formatHhmm(23, 59)).toBe("23:59");
  });

  it("splits and rebuilds the 12-hour face", () => {
    expect(to12Hour(0)).toEqual({ hour12: 12, pm: false });
    expect(to12Hour(9)).toEqual({ hour12: 9, pm: false });
    expect(to12Hour(12)).toEqual({ hour12: 12, pm: true });
    expect(to12Hour(21)).toEqual({ hour12: 9, pm: true });
    expect(from12Hour(12, false)).toBe(0);
    expect(from12Hour(12, true)).toBe(12);
    expect(from12Hour(9, true)).toBe(21);
  });

  it("maps dial angles to hours and snapped minutes", () => {
    expect(angleToHour12(0)).toBe(12);
    expect(angleToHour12(30)).toBe(1);
    expect(angleToHour12(90)).toBe(3);
    expect(angleToHour12(180)).toBe(6);
    expect(angleToHour12(330)).toBe(11);
    expect(angleToHour12(359)).toBe(12);
    expect(angleToHour12(-30)).toBe(11);
    expect(angleToMinute(0)).toBe(0);
    expect(angleToMinute(6)).toBe(1);
    expect(angleToMinute(354)).toBe(59);
    expect(angleToMinute(359)).toBe(0);
    // 7 degrees is 1.17 minutes, i.e. closer to 0 than to 5.
    expect(angleToMinute(7, 5)).toBe(0);
    expect(angleToMinute(28, 5)).toBe(5);
    expect(angleToMinute(31, 5)).toBe(5);
    expect(angleToMinute(359, 15)).toBe(0);
  });

  it("snaps absolute minutes onto the step grid", () => {
    expect(snapMinute(0, 1)).toBe(0);
    expect(snapMinute(59, 1)).toBe(59);
    expect(snapMinute(5, 15)).toBe(0);
    expect(snapMinute(7, 15)).toBe(0);
    expect(snapMinute(8, 15)).toBe(15);
    expect(snapMinute(22, 15)).toBe(15);
    expect(snapMinute(23, 15)).toBe(30);
    expect(snapMinute(59, 15)).toBe(0);
    expect(snapMinute(59, 30)).toBe(0);
    expect(snapMinute(60, 15)).toBe(0);
    expect(snapMinute(-7, 15)).toBe(0);
    expect(snapMinute(-8, 15)).toBe(45);
  });

  it("places dial values on the face (0 at 12 o'clock, clockwise)", () => {
    const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);
    const north = dialPoint(0, 12);
    const east = dialPoint(3, 12);
    const south = dialPoint(6, 12);
    const west = dialPoint(9, 12);
    close(north.x, 50);
    close(north.y, 12);
    close(east.x, 88);
    close(east.y, 50);
    close(south.x, 50);
    close(south.y, 88);
    close(west.x, 12);
    close(west.y, 50);
    const zero = dialPoint(0, 60);
    const fifteen = dialPoint(15, 60);
    expect(zero.x).toBeCloseTo(50, 5);
    expect(zero.y).toBeCloseTo(12, 5);
    expect(fifteen.x).toBeCloseTo(88, 5);
    expect(fifteen.y).toBeCloseTo(50, 5);
  });
});

describe("HkTimePicker", () => {
  it("renders the trigger value and falls back to a localized placeholder", () => {
    const p = mountPicker({ modelValue: "09:30" });
    const value = p.container.querySelector<HTMLElement>(".hk-tp-value");
    expect(value?.textContent).toContain("09:30");
    expect(value?.getAttribute("data-empty")).toBeNull();

    const empty = mountPicker();
    const emptyValue = empty.container.querySelector<HTMLElement>(".hk-tp-value");
    expect(emptyValue?.textContent).toContain("Pick a time");
    expect(emptyValue?.getAttribute("data-empty")).not.toBeUndefined();
  });

  it("treats an invalid model as empty", () => {
    const p = mountPicker({ modelValue: "9:5", placeholder: "Pick a time" });
    const value = p.container.querySelector<HTMLElement>(".hk-tp-value");
    expect(value?.textContent).toContain("Pick a time");
    expect(p.container.querySelector(".hk-tp-clear")).toBeNull();
  });

  it("opens on Enter and closes on Escape without emitting", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    expect(panel()).toBeNull();
    await openPicker(p);
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelectorAll(".hk-tp-number").length).toBe(12);

    face().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor("the popup to close on Escape", () => panel() === null);
    expect(p.emitted).toEqual([]);
  });

  it("picks an hour then a minute and commits HH:mm on confirm", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    await openPicker(p);
    clickNumber("9");
    await nextTick();
    // The hour pick advances to the minute face.
    expect(panel()?.querySelectorAll(".hk-tp-number").length).toBe(12);
    clickNumber("30");
    await nextTick();
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-confirm")!.click();
    await nextTick();
    expect(p.emitted).toEqual(["09:30"]);
    expect(p.changes).toEqual(["09:30"]);
    await waitFor("the popup to close after confirm", () => panel() === null);
  });

  it("starts a new rule on the current clock time and confirms it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 4, 6, 14, 7, 0));
    const p = mountPicker();
    trigger(p).click();
    await nextTick();
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-confirm")!.click();
    await nextTick();
    expect(p.emitted).toEqual(["14:07"]);
  });

  it("toggles the day period and converts the hour", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    await openPicker(p);
    const [am, pm] = periodButtons();
    expect(am?.getAttribute("aria-pressed")).toBe("true");
    expect(pm?.getAttribute("aria-pressed")).toBe("false");
    pm!.click();
    await nextTick();
    expect(periodButtons()[1].getAttribute("aria-pressed")).toBe("true");
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-confirm")!.click();
    await nextTick();
    expect(p.emitted).toEqual(["21:30"]);
  });

  it("shows 12 for midnight/noon and marks the correct half", async () => {
    const midnight = mountPicker({ modelValue: "00:30" });
    await openPicker(midnight);
    expect(readoutButtons()[0].textContent).toBe("12");
    expect(periodButtons()[0].getAttribute("aria-pressed")).toBe("true");
    expect(periodButtons()[1].getAttribute("aria-pressed")).toBe("false");

    face().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor("midnight picker to close", () => panel() === null);

    const noon = mountPicker({ modelValue: "12:30" });
    await openPicker(noon);
    expect(readoutButtons()[0].textContent).toBe("12");
    expect(periodButtons()[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("supports keyboard adjustments on the face", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    await openPicker(p);
    const faceEl = face();
    expect(faceEl.getAttribute("role")).toBe("slider");
    expect(faceEl.getAttribute("aria-valuenow")).toBe("9");

    faceEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("10");

    readoutButtons()[1].click();
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("30");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("31");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("36");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("0");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("59");
  });

  it("renders only reachable dial labels for a coarse minuteStep", async () => {
    const p = mountPicker({ modelValue: "09:15", minuteStep: 15 });
    await openPicker(p);
    readoutButtons()[1].click();
    await nextTick();
    expect(numbers().map((b) => b.textContent)).toEqual(["00", "15", "30", "45"]);
    clickNumber("30");
    await nextTick();
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-confirm")!.click();
    await nextTick();
    expect(p.emitted).toEqual(["09:30"]);
  });

  it("keeps Home/End/Page steps on the minute grid", async () => {
    const p = mountPicker({ modelValue: "09:15", minuteStep: 30 });
    await openPicker(p);
    readoutButtons()[1].click();
    await nextTick();
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("30");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("0");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("30");
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("0");
  });

  it("honours minuteStep for keyboard and dial snapping", async () => {
    const p = mountPicker({ modelValue: "09:30", minuteStep: 5 });
    await openPicker(p);
    readoutButtons()[1].click();
    await nextTick();
    face().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(face().getAttribute("aria-valuenow")).toBe("35");
  });

  it("cancelling discards the draft and keeps the model untouched", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    await openPicker(p);
    clickNumber("10");
    await nextTick();
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-cancel")!.click();
    await nextTick();
    expect(p.emitted).toEqual([]);
    await waitFor("the popup to close on cancel", () => panel() === null);
    expect(p.container.querySelector<HTMLElement>(".hk-tp-value")?.textContent).toContain("09:30");
  });

  it("sets the current time from Now and commits", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 4, 6, 14, 7, 0));
    const p = mountPicker({ modelValue: "09:30" });
    trigger(p).click();
    await nextTick();
    panel()!.querySelector<HTMLButtonElement>(".hk-tp-now")!.click();
    await nextTick();
    expect(p.emitted).toEqual(["14:07"]);
  });

  it("clears to an empty value without opening", async () => {
    const p = mountPicker({ modelValue: "09:30" });
    expect(panel()).toBeNull();
    p.container.querySelector<HTMLButtonElement>(".hk-tp-clear")!.click();
    await nextTick();
    expect(p.emitted).toEqual([""]);
    expect(panel()).toBeNull();
    expect(p.container.querySelector<HTMLElement>(".hk-tp-value")?.getAttribute("data-empty")).not.toBeUndefined();
  });

  it("closes an open editor when the host disables the field", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const disabled = ref(false);
    const emitted: string[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkTimePicker, {
            modelValue: "09:30",
            disabled: disabled.value,
            "onUpdate:modelValue": (v: string) => emitted.push(v),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    trigger({ container, emitted, changes: [] }).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await nextTick();
    expect(panel()).not.toBeNull();
    disabled.value = true;
    await nextTick();
    await waitFor("the panel to close on disable", () => panel() === null);
    expect(emitted).toEqual([]);
  });

  it("never opens while disabled", async () => {
    const p = mountPicker({ modelValue: "09:30", disabled: true });
    expect(trigger(p).getAttribute("aria-disabled")).not.toBeNull();
    expect(trigger(p).getAttribute("tabindex")).toBe("-1");
    trigger(p).click();
    await nextTick();
    expect(panel()).toBeNull();
  });

  it("associates a visible label and falls back to it for the trigger name", () => {
    const p = mountPicker({ label: "Start", modelValue: "09:30" });
    const label = p.container.querySelector<HTMLElement>(".hk-tp-label");
    expect(label?.textContent).toBe("Start");
    const triggerEl = trigger(p);
    expect(triggerEl.getAttribute("aria-labelledby")).toBe(label?.id);
    expect(triggerEl.getAttribute("aria-label")).toBeNull();

    const hidden = mountPicker({ label: "Start", hideLabel: true });
    const hiddenTrigger = hidden.container.querySelector<HTMLElement>(".hk-tp-trigger")!;
    expect(hidden.container.querySelector(".hk-tp-label")).toBeNull();
    expect(hiddenTrigger.getAttribute("aria-label")).toBe("Start");
  });
});
