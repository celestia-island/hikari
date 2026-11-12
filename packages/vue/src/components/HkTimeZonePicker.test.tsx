import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

/**
 * HkTimeZonePicker — the field around the IANA globe picker.
 *
 * The globe is MOCKED here: it is a `defineAsyncComponent` over a
 * three.js board, and these cases pin the WRAPPER contract (trigger
 * chrome, offset chip, lazy-globe wiring, exact-zone select, clear /
 * use-system, disabled and sheet form factor) — not WebGL. The stub is
 * a real component with the globe's public props/emits, so the wrapper's
 * forwarding is exercised for real; the globe's own no-WebGL fallback
 * list has its own suite (HkTimeZoneGlobe.test.tsx).
 */
vi.mock("./HkTimeZoneGlobe", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    // `__esModule` is what vue's defineAsyncComponent reads to unwrap the
    // namespace object; without it the module proxy itself would be
    // mounted as a component.
    __esModule: true,
    default: defineComponent({
      name: "HkTimeZoneGlobeStub",
      props: { modelValue: { type: String, default: "" } },
      emits: ["update:modelValue", "update"],
      setup(props, { emit }) {
        return () =>
          h("div", { "data-test": "tzp-globe-stub", "data-zone": props.modelValue }, [
            h(
              "button",
              {
                type: "button",
                "data-test": "tzp-globe-pick",
                onClick: () => {
                  emit("update:modelValue", "Asia/Kolkata");
                  emit("update", "Asia/Kolkata");
                },
              },
              "pick-kolkata",
            ),
          ]);
      },
    }),
  };
});

import HkTimeZonePicker, { formatZoneOffset } from "./HkTimeZonePicker";
import { setLocale } from "../i18n/context";
import type { HostWindow } from "../utils/typing";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
const originalWidth = window.innerWidth;

interface Harness {
  container: HTMLElement;
  emitted: string[];
  changes: string[];
}

function mountPicker(props: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref<string>((props.modelValue as string | undefined) ?? "");
  const emitted: string[] = [];
  const changes: string[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkTimeZonePicker, {
          ...props,
          modelValue: value.value,
          "onUpdate:modelValue": (zone: string) => {
            emitted.push(zone);
            value.value = zone;
          },
          onChange: (zone: string) => {
            changes.push(zone);
          },
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, emitted, changes };
}

function trigger(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".hk-tzp-trigger");
  expect(el, ".hk-tzp-trigger renders").not.toBeNull();
  return el!;
}

function valueText(container: HTMLElement): string {
  return container.querySelector<HTMLElement>(".hk-tzp-value")?.textContent ?? "";
}

function offsetChip(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(".hk-tzp-offset");
}

function popoverPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-popover-panel");
}

function globeStub(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-test="tzp-globe-stub"]');
}

/** Poll until `probe` holds (the popover surface and the lazy chunk both
 *  settle asynchronously — the transitions are timeout driven). */
async function waitFor(desc: string, probe: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (probe()) return;
    if (Date.now() > deadline) throw new Error(`never reached: ${desc}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function openPicker(harness: Harness) {
  trigger(harness.container).click();
  await waitFor("the popover panel", () => popoverPanel() !== null);
  await waitFor("the lazy globe stub", () => globeStub() !== null);
}

function setViewportWidth(px: number): void {
  (window as HostWindow<{ innerWidth: number }>).innerWidth = px;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.querySelectorAll<HTMLElement>("#hk-overlay-root > *").forEach((el) => el.remove());
  setViewportWidth(originalWidth);
  await setLocale("en");
});

describe("formatZoneOffset", () => {
  it("formats whole-hour offsets", () => {
    expect(formatZoneOffset("Asia/Shanghai")).toBe("UTC+08:00");
    expect(formatZoneOffset("Europe/Berlin", new Date(2026, 0, 15))).toBe("UTC+01:00");
  });

  it("normalizes the zero offset to bare UTC", () => {
    expect(formatZoneOffset("UTC")).toBe("UTC");
    expect(formatZoneOffset("Etc/UTC")).toBe("UTC");
    expect(formatZoneOffset("Atlantic/Reykjavik")).toBe("UTC");
  });

  it("formats half-hour and negative offsets", () => {
    expect(formatZoneOffset("Asia/Kolkata")).toBe("UTC+05:30");
    expect(formatZoneOffset("America/St_Johns", new Date(2026, 0, 15))).toBe("UTC-03:30");
    expect(formatZoneOffset("America/New_York", new Date(2026, 0, 15))).toBe("UTC-05:00");
  });

  it("follows the instant it is asked about (DST)", () => {
    expect(formatZoneOffset("America/New_York", new Date(2026, 0, 15))).toBe("UTC-05:00");
    expect(formatZoneOffset("America/New_York", new Date(2026, 6, 15))).toBe("UTC-04:00");
  });

  it("returns an empty string for unusable ids instead of throwing", () => {
    expect(formatZoneOffset("")).toBe("");
    expect(formatZoneOffset("Not/AZone")).toBe("");
    expect(() => formatZoneOffset("../../etc/passwd")).not.toThrow();
    expect(formatZoneOffset("../../etc/passwd")).toBe("");
  });
});

describe("HkTimeZonePicker — trigger", () => {
  it("shows the zone id and its exact offset chip", () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    expect(valueText(harness.container)).toBe("Asia/Shanghai");
    expect(offsetChip(harness.container)?.textContent).toBe("UTC+08:00");
    expect(
      harness.container.querySelector(".hk-tzp-value")?.getAttribute("data-empty"),
    ).toBeNull();
  });

  it("shows the half-hour id verbatim (never rewritten to a sector id)", () => {
    const harness = mountPicker({ modelValue: "Asia/Kolkata" });
    expect(valueText(harness.container)).toBe("Asia/Kolkata");
    expect(offsetChip(harness.container)?.textContent).toBe("UTC+05:30");
    expect(harness.emitted).toEqual([]);
  });

  it("renders the system-zone label for the empty model, with no offset", () => {
    const harness = mountPicker();
    expect(valueText(harness.container)).toBe("System time zone");
    expect(
      harness.container.querySelector(".hk-tzp-value")?.getAttribute("data-empty"),
    ).not.toBeNull();
    expect(offsetChip(harness.container)).toBeNull();
  });

  it("honours a host-supplied emptyLabel", () => {
    const harness = mountPicker({ emptyLabel: "Server local time" });
    expect(valueText(harness.container)).toBe("Server local time");
  });

  it("shows an unknown id without inventing an offset", () => {
    const harness = mountPicker({ modelValue: "Mars/Olympus_Mons" });
    expect(valueText(harness.container)).toBe("Mars/Olympus_Mons");
    expect(offsetChip(harness.container)).toBeNull();
  });

  it("exposes the combobox contract on the trigger", () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    const el = trigger(harness.container);
    expect(el.getAttribute("role")).toBe("combobox");
    expect(el.getAttribute("aria-haspopup")).toBe("dialog");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    expect(el.getAttribute("tabindex")).toBe("0");
  });

  it("renders the caption, and `size=sm` on the field", () => {
    const harness = mountPicker({ label: "Time zone", size: "sm" });
    expect(harness.container.querySelector(".hk-tzp-label")?.textContent).toBe("Time zone");
    expect(trigger(harness.container).classList.contains("hk-tzp-trigger-sm")).toBe(true);
    const hidden = mountPicker({ label: "Time zone", hideLabel: true });
    expect(hidden.container.querySelector(".hk-tzp-label")).toBeNull();
    expect(trigger(hidden.container).getAttribute("aria-label")).toBe("Time zone");
  });
});

describe("HkTimeZonePicker — popover", () => {
  it("opens on click and renders the globe plus the exact-zone select", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    expect(popoverPanel()).toBeNull();
    await openPicker(harness);

    expect(trigger(harness.container).getAttribute("aria-expanded")).toBe("true");
    expect(trigger(harness.container).classList.contains("is-open")).toBe(true);
    expect(popoverPanel()?.getAttribute("role")).toBe("dialog");
    expect(popoverPanel()?.getAttribute("aria-label")).toBe("Pick a time zone");
    // The globe receives the CURRENT id verbatim.
    expect(globeStub()?.getAttribute("data-zone")).toBe("Asia/Shanghai");
    // ...and the exact-zone select sits below it, labelled by the i18n key.
    expect(popoverPanel()?.querySelector(".hk-tzp-exact .hk-select-trigger")).not.toBeNull();
    expect(popoverPanel()?.querySelector(".hk-select-label")?.textContent)
      .toBe("Exact time zone");
  });

  it("opens from the keyboard (Enter) and closes on Escape", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    trigger(harness.container)
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitFor("the popover to open on Enter", () => popoverPanel() !== null);

    trigger(harness.container)
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor("the popover to close on Escape", () => popoverPanel() === null);
    expect(trigger(harness.container).getAttribute("aria-expanded")).toBe("false");
  });

  it("orients the globe to the resolved system zone for the empty model", async () => {
    const systemZone = (() => {
      try {
        return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        return "UTC";
      }
    })();
    const harness = mountPicker();
    await openPicker(harness);
    // The globe has no "empty" sector — feeding it "" would point at the
    // UTC wedge while the trigger reads "System time zone".
    const displayZone = globeStub()?.getAttribute("data-zone") ?? "";
    expect(displayZone).not.toBe("");
    expect(displayZone).toBe(systemZone);
    // ...but the WRAPPER's model is untouched: still "", still no emit.
    expect(valueText(harness.container)).toBe("System time zone");
    expect(harness.emitted).toEqual([]);
    expect(harness.changes).toEqual([]);
  });

  it("includes a stored zone outside the candidate list, selected and shown", async () => {
    // The chest's curated list is ~50 ids and the globe emits its own 24
    // representatives, so a stored row can hold an id neither speaks —
    // it must still round-trip visibly instead of rendering against no
    // matching option.
    const harness = mountPicker({
      modelValue: "Pacific/Pago_Pago",
      zones: ["Asia/Shanghai", "Europe/Berlin"],
    });
    expect(valueText(harness.container)).toBe("Pacific/Pago_Pago");
    expect(offsetChip(harness.container)?.textContent).toBe("UTC-11:00");

    await openPicker(harness);
    popoverPanel()!.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await waitFor("the select popout", () => document.querySelector(".hk-select-option") !== null);
    const options = Array.from(document.querySelectorAll<HTMLElement>(".hk-select-option"));
    expect(options.map((o) => o.textContent)).toEqual([
      "Pacific/Pago_Pago",
      "Asia/Shanghai",
      "Europe/Berlin",
    ]);
    // The injected row is the SELECTED one, and the field still shows the
    // id verbatim.
    expect(options[0]!.getAttribute("data-checked")).toBe("true");
    expect(
      popoverPanel()!.querySelector(".hk-select-value")?.textContent,
    ).toBe("Pacific/Pago_Pago");
    expect(harness.emitted).toEqual([]);
  });

  it("does not duplicate the current zone when it is already a candidate", async () => {
    const harness = mountPicker({
      modelValue: "Asia/Shanghai",
      zones: ["Asia/Shanghai", "Europe/Berlin"],
    });
    await openPicker(harness);
    popoverPanel()!.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await waitFor("the select popout", () => document.querySelector(".hk-select-option") !== null);
    const labels = Array.from(document.querySelectorAll<HTMLElement>(".hk-select-option"))
      .map((o) => o.textContent);
    expect(labels).toEqual(["Asia/Shanghai", "Europe/Berlin"]);
    expect(labels.filter((label) => label === "Asia/Shanghai")).toHaveLength(1);
  });

  it("forwards the globe's emitted zone as update + change", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    await openPicker(harness);
    document.querySelector<HTMLButtonElement>('[data-test="tzp-globe-pick"]')!.click();
    await nextTick();
    expect(harness.emitted).toEqual(["Asia/Kolkata"]);
    expect(harness.changes).toEqual(["Asia/Kolkata"]);
    expect(valueText(harness.container)).toBe("Asia/Kolkata");
    expect(globeStub()?.getAttribute("data-zone")).toBe("Asia/Kolkata");
  });

  it("picking a zone from the exact select emits it", async () => {
    const harness = mountPicker({
      modelValue: "Asia/Shanghai",
      zones: ["Asia/Shanghai", "Europe/Berlin", "America/St_Johns"],
    });
    await openPicker(harness);

    popoverPanel()!.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await waitFor("the select popout", () => document.querySelector(".hk-select-option") !== null);
    const options = Array.from(document.querySelectorAll<HTMLElement>(".hk-select-option"));
    expect(options.map((o) => o.textContent)).toEqual([
      "Asia/Shanghai",
      "Europe/Berlin",
      "America/St_Johns",
    ]);
    options.find((o) => o.textContent === "Europe/Berlin")!.click();
    await nextTick();
    expect(harness.emitted).toEqual(["Europe/Berlin"]);
    expect(harness.changes).toEqual(["Europe/Berlin"]);
    expect(valueText(harness.container)).toBe("Europe/Berlin");
    expect(offsetChip(harness.container)?.textContent).toBe("UTC+01:00");
  });

  it("offers the system-zone row, which clears the model", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    await openPicker(harness);
    const systemRow = popoverPanel()!.querySelector<HTMLButtonElement>(".hk-tzp-system");
    expect(systemRow?.textContent).toBe("Use system time zone");
    systemRow!.click();
    await nextTick();
    expect(harness.emitted).toEqual([""]);
    expect(harness.changes).toEqual([""]);
    expect(valueText(harness.container)).toBe("System time zone");
    expect(offsetChip(harness.container)).toBeNull();
  });

  it("hides the select when no zone source is available (globe stays)", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new Error("unsupported runtime");
    });
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    await openPicker(harness);
    expect(popoverPanel()?.querySelector(".hk-select-trigger")).toBeNull();
    expect(globeStub()).not.toBeNull();
  });

  it("docks as a bottom sheet on touch-width viewports", async () => {
    setViewportWidth(375);
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    await openPicker(harness);
    expect(popoverPanel()?.classList.contains("hk-is-sheet")).toBe(true);
    expect(popoverPanel()?.querySelector(".hk-tzp-panel")?.classList.contains("is-touch")).toBe(true);
  });
});

describe("HkTimeZonePicker — clear + disabled", () => {
  it("clears from the X without opening the picker", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai" });
    const clear = harness.container.querySelector<HTMLButtonElement>(".hk-tzp-clear");
    expect(clear).not.toBeNull();
    expect(clear?.getAttribute("tabindex")).toBe("-1");
    clear!.click();
    await nextTick();
    expect(harness.emitted).toEqual([""]);
    expect(harness.changes).toEqual([""]);
    // The clear affordance must not double as "open".
    expect(popoverPanel()).toBeNull();
    expect(trigger(harness.container).getAttribute("aria-expanded")).toBe("false");
  });

  it("omits the clear X and the system row when clearable is false", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai", clearable: false });
    expect(harness.container.querySelector(".hk-tzp-clear")).toBeNull();
    await openPicker(harness);
    expect(popoverPanel()!.querySelector(".hk-tzp-system")).toBeNull();
  });

  it("blocks opening when disabled", async () => {
    const harness = mountPicker({ modelValue: "Asia/Shanghai", disabled: true });
    const el = trigger(harness.container);
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect(el.getAttribute("tabindex")).toBe("-1");
    el.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    expect(popoverPanel()).toBeNull();
    expect(harness.container.querySelector(".hk-tzp-clear")).toBeNull();
    expect(harness.emitted).toEqual([]);
  });

  it("keeps a re-pick of the current zone silent", async () => {
    const harness = mountPicker({
      modelValue: "Asia/Shanghai",
      zones: ["Asia/Shanghai", "Europe/Berlin"],
    });
    await openPicker(harness);

    popoverPanel()!.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await waitFor("the select popout", () => document.querySelector(".hk-select-option") !== null);
    // Picking the value the model already holds is not a change.
    Array.from(document.querySelectorAll<HTMLElement>(".hk-select-option"))
      .find((o) => o.textContent === "Asia/Shanghai")!
      .click();
    await nextTick();
    expect(harness.emitted).toEqual([]);
    expect(harness.changes).toEqual([]);
  });
});