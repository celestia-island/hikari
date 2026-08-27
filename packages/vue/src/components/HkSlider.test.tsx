import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkSlider from "./HkSlider";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Mount with a reactive render closure so controlled updates flow back. */
function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
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

/** Pin a 200px-wide, left-0 rect on the track so drag math is exact. */
function pinRect(slider: HTMLElement) {
  Object.defineProperty(slider, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, width: 200, height: 18, top: 0, right: 200, bottom: 18, x: 0, y: 0 }) as DOMRect,
  });
}

function pointer(type: string, clientX: number) {
  return new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: "touch" });
}

describe("HkSlider", () => {
  it("renders the slider role with stepped aria values", () => {
    const c = mount(() => h(HkSlider, { modelValue: 150, min: 100, max: 300, step: 25, ariaLabel: "DPI" }));
    const el = c.querySelector(".hk-slider") as HTMLElement;
    expect(el.getAttribute("role")).toBe("slider");
    expect(el.getAttribute("aria-label")).toBe("DPI");
    expect(el.getAttribute("aria-valuemin")).toBe("100");
    expect(el.getAttribute("aria-valuemax")).toBe("300");
    expect(el.getAttribute("aria-valuenow")).toBe("150");
  });

  it("snaps an off-grid value onto the step grid", () => {
    const c = mount(() => h(HkSlider, { modelValue: 137, min: 100, max: 300, step: 25 }));
    expect((c.querySelector(".hk-slider") as HTMLElement).getAttribute("aria-valuenow")).toBe("125");
  });

  it("keeps the thumb visible without hover gating and themed by --color-primary", () => {
    // Source contract (the HkMediaSlider defect this variant exists for):
    // the thumb is always visible and always follows the theme color.
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkSlider.scss"), "utf-8");
    const thumb = scss.match(/\.hk-slider-thumb\s*{[^}]*}/)?.[0] ?? "";
    expect(thumb).toContain("background: rgb(var(--color-primary))");
    expect(thumb).not.toContain("opacity");
  });

  it("sizes the fill and thumb from the snapped value percentage", () => {
    const c = mount(() => h(HkSlider, { modelValue: 200, min: 100, max: 300, step: 25 }));
    expect((c.querySelector(".hk-slider-fill") as HTMLElement).style.width).toBe("50%");
    expect((c.querySelector(".hk-slider-thumb") as HTMLElement).style.left).toBe("50%");
  });

  it("emits a snapped value when the track is pressed and dragged", () => {
    const seen: number[] = [];
    const value = ref(100);
    const c = mount(() => h(HkSlider, {
      modelValue: value.value,
      min: 100,
      max: 300,
      step: 25,
      "onUpdate:modelValue": (v: number) => { value.value = v; seen.push(v); },
    }));
    const slider = c.querySelector(".hk-slider") as HTMLElement;
    pinRect(slider);
    slider.dispatchEvent(pointer("pointerdown", 100)); // exact middle → 200
    expect(seen).toEqual([200]);
    window.dispatchEvent(pointer("pointermove", 200)); // right edge → 300
    window.dispatchEvent(pointer("pointerup", 200));
    expect(seen).toEqual([200, 300]);
    window.dispatchEvent(pointer("pointermove", 0)); // released: no further emit
    expect(seen).toEqual([200, 300]);
  });

  it("steps from the keyboard and clamps at the bounds", async () => {
    const seen: number[] = [];
    const value = ref(275);
    const c = mount(() => h(HkSlider, {
      modelValue: value.value,
      min: 100,
      max: 300,
      step: 25,
      "onUpdate:modelValue": (v: number) => { value.value = v; seen.push(v); },
    }));
    const slider = c.querySelector(".hk-slider") as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextTick(); // let the controlled parent feed the new value back
    expect(seen).toEqual([300]);
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextTick();
    // Clamped at max: ArrowRight again emits nothing.
    expect(seen).toEqual([300]);
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await nextTick();
    expect(seen).toEqual([300, 100]);
  });

  it("ignores pointers and keys while disabled", () => {
    const seen: number[] = [];
    const c = mount(() => h(HkSlider, {
      modelValue: 100,
      min: 100,
      max: 300,
      step: 25,
      disabled: true,
      "onUpdate:modelValue": (v: number) => seen.push(v),
    }));
    const slider = c.querySelector(".hk-slider") as HTMLElement;
    pinRect(slider);
    slider.dispatchEvent(pointer("pointerdown", 200));
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(seen).toEqual([]);
    expect(slider.getAttribute("aria-disabled")).toBe("true");
    expect(slider.getAttribute("tabindex")).toBe("-1");
  });

  it("renders one tick per stop when showTicks is set", () => {
    const c = mount(() => h(HkSlider, { modelValue: 200, min: 100, max: 300, step: 25, showTicks: true }));
    expect(c.querySelectorAll(".hk-slider-tick").length).toBe(9);
    // 100..200 inclusive sit at or left of the value.
    expect(c.querySelectorAll(".hk-slider-tick[data-active]").length).toBe(5);
    const bare = mount(() => h(HkSlider, { modelValue: 200, min: 100, max: 300, step: 25 }));
    expect(bare.querySelectorAll(".hk-slider-tick").length).toBe(0);
  });

  it("formats the aria value text through formatValue", () => {
    const c = mount(() => h(HkSlider, {
      modelValue: 175,
      min: 100,
      max: 300,
      step: 25,
      formatValue: (v: number) => `${v}%`,
    }));
    expect((c.querySelector(".hk-slider") as HTMLElement).getAttribute("aria-valuetext")).toBe("175%");
  });
});
