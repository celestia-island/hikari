import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkColorPicker from "./HkColorPicker";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

/**
 * Drag a slider the way a phone does it: pointerdown ON the slider
 * element, then pointermove events that reach the component only through
 * the WINDOW (the fix routes mobile drags through window-level
 * listeners — element-level capture alone was the bug).
 */
function dragSlider(slider: HTMLElement, fromX: number, toX: number) {
  slider.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, clientX: fromX, pointerId: 1, pointerType: "touch",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, clientX: toX, pointerId: 1, pointerType: "touch",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, clientX: toX, pointerId: 1, pointerType: "touch",
  }));
}

function mountPicker() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const rgb = ref({ r: 128, g: 128, b: 128 });
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkColorPicker, {
          r: rgb.value.r,
          g: rgb.value.g,
          b: rgb.value.b,
          onChange: (next: { r: number; g: number; b: number }) => { rgb.value = next; },
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { rgb, container };
}

function openPanel(container: HTMLElement) {
  container.querySelector<HTMLButtonElement>(".hk-color-picker-swatch-btn")!.click();
}

describe("HkColorPicker slider touch drag", () => {
  it("tracks a window-routed touch drag and updates the channel", async () => {
    const { rgb, container } = mountPicker();
    await nextTick();
    openPanel(container);
    await nextTick();

    const sliders = document.body.querySelectorAll<HTMLElement>(".hk-color-picker-channel-slider");
    expect(sliders.length).toBe(3);
    const rSlider = sliders[0];

    // Pin the track geometry (happy-dom lays elements out at 0×0 unless
    // sized explicitly; the drag math reads the TRACK element's rect).
    const track = rSlider.querySelector<HTMLElement>(".hk-color-picker-slider-track")!;
    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 0, right: 300, bottom: 20, width: 200, height: 20, x: 100, y: 0, toJSON: () => ({}) }),
    });

    // Press at 25% → value ~64; drag to 75% → value ~191.
    dragSlider(rSlider, 150, 250);
    await nextTick();
    expect(rgb.value.r).toBeGreaterThanOrEqual(188);
    expect(rgb.value.r).toBeLessThanOrEqual(194);

    // The thumb's inline left% must track the channel value: the CSS
    // (position:absolute) turns this binding into the thumb's on-track
    // position. Losing either half parks the thumb at the row's edge.
    const thumb = rSlider.querySelector<HTMLElement>(".hk-color-picker-slider-thumb")!;
    const pct = parseFloat(thumb.style.left);
    expect(Number.isFinite(pct)).toBe(true);
    expect(pct).toBeGreaterThan(73);
    expect(pct).toBeLessThan(79);
  });

  it("stops tracking after pointercancel reclaims the gesture", async () => {
    const { rgb, container } = mountPicker();
    await nextTick();
    openPanel(container);
    await nextTick();

    const rSlider = document.body.querySelectorAll<HTMLElement>(".hk-color-picker-channel-slider")[0];
    const track = rSlider.querySelector<HTMLElement>(".hk-color-picker-slider-track")!;
    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 0, right: 300, bottom: 20, width: 200, height: 20, x: 100, y: 0, toJSON: () => ({}) }),
    });

    rSlider.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, clientX: 150, pointerId: 1, pointerType: "touch",
    }));
    // The browser reclaims the gesture (scroll/edge-swipe)…
    window.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, pointerId: 1, pointerType: "touch",
    }));
    // …so a later stray move must NOT move the thumb.
    const before = rgb.value.r;
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, clientX: 290, pointerId: 1, pointerType: "touch",
    }));
    await nextTick();
    expect(rgb.value.r).toBe(before);
  });

  it("cleans window listeners up on unmount (no post-unmount moves)", async () => {
    const { rgb, container } = mountPicker();
    await nextTick();
    openPanel(container);
    await nextTick();

    const rSlider = document.body.querySelectorAll<HTMLElement>(".hk-color-picker-channel-slider")[0];
    const track = rSlider.querySelector<HTMLElement>(".hk-color-picker-slider-track")!;
    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 0, right: 300, bottom: 20, width: 200, height: 20, x: 100, y: 0, toJSON: () => ({}) }),
    });

    rSlider.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, clientX: 150, pointerId: 1, pointerType: "touch",
    }));
    // Unmount mid-drag (e.g. the sheet closes): listeners must go away.
    mounts.splice(0).forEach((app) => app.unmount());
    const before = rgb.value.r;
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, clientX: 290, pointerId: 1, pointerType: "touch",
    }));
    await nextTick();
    expect(rgb.value.r).toBe(before);
  });
});
