import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkMinimap, { type MinimapBox } from "./HkMinimap";

/**
 * HkMinimap zoom-bar contract tests:
 * - the percent label renders the current zoomPercent and is a button
 *   carrying aria-expanded + the zoomSlider i18n title
 * - clicking the label toggles the slider pop open/closed
 * - the embedded slider's bounds/step follow the zoom governance props
 *   and dragging it emits zoomTo snapped/clamped to that grid
 * - pointerdown inside the pop never starts a map drag (no data-dragging)
 * - the pop dismisses on outside pointerdown and Escape
 *
 * Harness: createApp + reactive render closure (same as HkSlider.test).
 * useI18n resolves from the eager-loaded en bundle — no provider needed.
 */
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

const box: MinimapBox = { id: "b1", bounds: { x: 0, y: 0, w: 100, h: 80 }, color: "#e0533d" };

function pointer(type: string, clientX = 0, clientY = 0) {
  return new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1, pointerType: "touch" });
}

/** Pin a 200px-wide, left-0 rect on the slider so drag math is exact. */
function pinRect(slider: HTMLElement) {
  Object.defineProperty(slider, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, width: 200, height: 18, top: 0, right: 200, bottom: 18, x: 0, y: 0 }) as DOMRect,
  });
}

async function openPop(c: HTMLElement) {
  (c.querySelector(".hk-mm-zoom-label") as HTMLButtonElement).click();
  await nextTick();
  return c.querySelector(".hk-mm-zoom-pop") as HTMLElement;
}

describe("HkMinimap zoom bar", () => {
  it("renders the percent label with the zoomPercent prop", () => {
    const c = mount(() => h(HkMinimap, { boxes: [box], zoomPercent: 125 }));
    const label = c.querySelector(".hk-mm-zoom-label") as HTMLButtonElement;
    expect(label.tagName).toBe("BUTTON");
    expect(label.textContent).toBe("125%");
    expect(label.getAttribute("aria-expanded")).toBe("false");
    // Title resolves through the hikari::zoomToolbar.zoomSlider i18n key.
    expect(label.getAttribute("title")).toBe("Zoom level");
  });

  it("toggles the slider pop open/closed from the label", async () => {
    const c = mount(() => h(HkMinimap, { boxes: [box], zoomPercent: 100 }));
    await openPop(c);
    expect(c.querySelector(".hk-mm-zoom-pop")).not.toBeNull();
    expect(
      (c.querySelector(".hk-mm-zoom-label") as HTMLButtonElement).getAttribute("aria-expanded"),
    ).toBe("true");
    (c.querySelector(".hk-mm-zoom-label") as HTMLButtonElement).click();
    await nextTick();
    expect(c.querySelector(".hk-mm-zoom-pop")).toBeNull();
    expect(
      (c.querySelector(".hk-mm-zoom-label") as HTMLButtonElement).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("drives zoomTo from the slider with the prop-bounded snapped grid", async () => {
    const seen: Array<[number, "slider" | "step" | undefined]> = [];
    const zoom = ref(100);
    const c = mount(() =>
      h(HkMinimap, {
        boxes: [box],
        zoomPercent: zoom.value,
        minZoomPercent: 50,
        maxZoomPercent: 150,
        zoomStepPercent: 5,
        onZoomTo: (v: number, source: "slider" | "step" | undefined) => {
          zoom.value = v;
          seen.push([v, source]);
        },
      }),
    );
    const pop = await openPop(c);
    // Bounds and step come straight from the zoom governance props.
    const slider = pop.querySelector(".hk-slider") as HTMLElement;
    expect(slider.getAttribute("aria-valuemin")).toBe("50");
    expect(slider.getAttribute("aria-valuemax")).toBe("150");
    expect(slider.getAttribute("aria-valuenow")).toBe("100");
    expect(slider.getAttribute("aria-valuetext")).toBe("100%");
    // Off-grid press: ratio 0.185 → 68.5% snaps to the 5% grid → 70.
    pinRect(slider);
    slider.dispatchEvent(pointer("pointerdown", 37));
    await nextTick();
    expect(seen).toEqual([[70, "slider"]]);
    expect(slider.getAttribute("aria-valuenow")).toBe("70");
    // Press past the right edge clamps to the max bound.
    slider.dispatchEvent(pointer("pointerdown", 250));
    window.dispatchEvent(pointer("pointerup", 250));
    await nextTick();
    expect(seen).toEqual([[70, "slider"], [150, "slider"]]);
  });

  it("emits the step source from the ± buttons", async () => {
    const seen: Array<[number, "slider" | "step" | undefined]> = [];
    const c = mount(() =>
      h(HkMinimap, {
        boxes: [box],
        zoomPercent: 100,
        minZoomPercent: 50,
        maxZoomPercent: 150,
        onZoomTo: (v: number, source: "slider" | "step" | undefined) => seen.push([v, source]),
      }),
    );
    const buttons = [...c.querySelectorAll(".hk-mm-zoom-btn")] as HTMLButtonElement[];
    (buttons[0] as HTMLButtonElement).click(); // zoom out
    await nextTick();
    expect(seen).toEqual([[95, "step"]]);
  });

  it("closes the pop when a real map drag starts", async () => {
    const c = mount(() => h(HkMinimap, { boxes: [box], zoomPercent: 100 }));
    await openPop(c);
    expect(c.querySelector(".hk-mm-zoom-pop")).not.toBeNull();
    const root = c.querySelector(".hk-minimap") as HTMLElement;
    // pointerdown on the map area (not the zoom chrome) starts a drag —
    // the slider must get out of the way.
    root.dispatchEvent(pointer("pointerdown", 80, 40));
    await nextTick();
    expect(c.querySelector(".hk-mm-zoom-pop")).toBeNull();
    // …and the map drag itself engaged.
    expect(root.hasAttribute("data-dragging")).toBe(true);
    window.dispatchEvent(pointer("pointerup", 80, 40));
  });

  it("never starts a map drag from a pointerdown inside the pop", async () => {
    const panned: Array<[number, number]> = [];
    const c = mount(() =>
      h(HkMinimap, { boxes: [box], onPanDelta: (dx: number, dy: number) => panned.push([dx, dy]) }),
    );
    await openPop(c);
    const root = c.querySelector(".hk-minimap") as HTMLElement;
    // Direct hit on the panel itself…
    (c.querySelector(".hk-mm-zoom-pop") as HTMLElement).dispatchEvent(pointer("pointerdown", 10, 10));
    // …and on the slider inside it (bubbles through the panel).
    (c.querySelector(".hk-slider") as HTMLElement).dispatchEvent(pointer("pointerdown", 100));
    expect(root.hasAttribute("data-dragging")).toBe(false);
    // The panel stays open: the gesture belonged to the slider chrome.
    expect(c.querySelector(".hk-mm-zoom-pop")).not.toBeNull();
    window.dispatchEvent(pointer("pointermove", 140, 40));
    expect(panned).toEqual([]);
  });

  it("closes the pop on a pointerdown outside the minimap", async () => {
    const c = mount(() => h(HkMinimap, { boxes: [box], zoomPercent: 100 }));
    await openPop(c);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(pointer("pointerdown"));
    await nextTick();
    expect(c.querySelector(".hk-mm-zoom-pop")).toBeNull();
    outside.remove();
  });

  it("closes the pop on Escape", async () => {
    const c = mount(() => h(HkMinimap, { boxes: [box], zoomPercent: 100 }));
    await openPop(c);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(c.querySelector(".hk-mm-zoom-pop")).toBeNull();
  });
});
