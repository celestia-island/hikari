/**
 * Contract for the family-level height-ride container (`HkRideBox` + the
 * `useHeightRide` measurement primitive).
 *
 * Why these assertions: the motion is a LAYOUT-height animation precisely so
 * that the chrome (title bar, footer action row) keeps its natural size — the
 * 2026-11-07 user report was that a frame-level `transform: scaleY()` squashed
 * the title text and the footer buttons along with everything else. The test
 * that matters is therefore structural, not decorative:
 *
 *   1. the chrome bands are SIBLINGS of the content region, so no transform
 *      can ever reach them;
 *   2. the only scaled region is `.hk-ride-content`;
 *   3. the geometry is published as variables (chrome / content / factor) and
 *      the two state classes are what the sheet interpolates between;
 *   4. an unmeasurable box (jsdom reports 0) publishes NOTHING, so the sheet
 *      falls back to `auto` instead of collapsing the frame;
 *   5. a second ride never shrinks an already-compressed measurement.
 */
import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Component } from "vue";

import HkRideBox from "./HkRideBox";
import {
  RIDE_ATTR,
  RIDE_CLASS,
  RIDE_CONTENT_CLASS,
  RIDE_FROM_CLASS,
  RIDE_TO_CLASS,
} from "../composables/useHeightRide";

interface Harness {
  root: () => HTMLElement;
  setRiding: (next: boolean) => Promise<void>;
  unmount: () => void;
}

function mountBox(
  initial: { riding?: boolean; factor?: number } = {},
  slots?: Record<string, () => unknown>,
): Harness {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const riding = ref(Boolean(initial.riding));
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          HkRideBox as Component,
          { riding: riding.value, factor: initial.factor ?? 0.9 },
          slots ?? {
            "chrome-start": () => h("header", { class: "probe-chrome-start" }, "title"),
            default: () => h("div", { class: "probe-content" }, "body"),
            "chrome-end": () => h("footer", { class: "probe-chrome-end" }, "actions"),
          },
        );
    },
  });
  const app = createApp(Host);
  app.mount(host);
  return {
    root: () => host.firstElementChild as HTMLElement,
    setRiding: async (next: boolean) => {
      riding.value = next;
      await nextTick();
      await nextTick();
    },
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}

/** jsdom reports 0 for every layout box. The measurement deliberately never
 *  reads the FRAME's height (that is the number the ride computes), so the
 *  stub feeds it the two honest sources: the content region's natural scroll
 *  extent and the chrome bands' own offsets. */
function stubBox(root: HTMLElement, content: number, chrome: number): void {
  const contentEl = root.querySelector(`.${RIDE_CONTENT_CLASS}`) as HTMLElement;
  Object.defineProperty(contentEl, "scrollHeight", { configurable: true, value: content });
  Object.defineProperty(contentEl, "offsetHeight", { configurable: true, value: content });
  const chromeEls = Array.from(root.children).filter((el) => el !== contentEl) as HTMLElement[];
  chromeEls.forEach((el, index) => {
    Object.defineProperty(el, "offsetHeight", {
      configurable: true,
      value: index === 0 ? chrome : 0,
    });
  });
}

describe("HkRideBox (family height-ride container)", () => {
  it("renders the ride contract and keeps the chrome outside the scaled region", () => {
    const h1 = mountBox();
    const root = h1.root();
    expect(root.classList.contains(RIDE_CLASS)).toBe(true);
    const content = root.querySelector(`.${RIDE_CONTENT_CLASS}`) as HTMLElement;
    expect(content).not.toBeNull();
    // Structural guarantee: no transform on the box can ever reach the
    // chrome, because the chrome is not inside the content region.
    expect(content.querySelector(".probe-chrome-start")).toBeNull();
    expect(content.querySelector(".probe-chrome-end")).toBeNull();
    expect(content.querySelector(".probe-content")).not.toBeNull();
    expect(root.querySelector(".probe-chrome-start")).not.toBeNull();
    expect(root.querySelector(".probe-chrome-end")).not.toBeNull();
    h1.unmount();
  });

  it("stamps the compressed end plus the riding flag while riding", async () => {
    const h2 = mountBox({ riding: true });
    await nextTick();
    const root = h2.root();
    expect(root.classList.contains(RIDE_FROM_CLASS)).toBe(true);
    expect(root.classList.contains(RIDE_TO_CLASS)).toBe(false);
    expect(root.hasAttribute(RIDE_ATTR)).toBe(true);
    h2.unmount();
  });

  it("swaps to the natural end and drops the riding flag at rest", async () => {
    const h3 = mountBox({ riding: true });
    await h3.setRiding(false);
    const root = h3.root();
    expect(root.classList.contains(RIDE_FROM_CLASS)).toBe(false);
    expect(root.classList.contains(RIDE_TO_CLASS)).toBe(true);
    expect(root.hasAttribute(RIDE_ATTR)).toBe(false);
    h3.unmount();
  });

  it("publishes the measured chrome/content split and the factor", async () => {
    const h4 = mountBox({ riding: false, factor: 0.9 });
    const root = h4.root();
    stubBox(root, 300, 100);
    await h4.setRiding(true);

    expect(root.style.getPropertyValue("--hk-ride-chrome")).toBe("100px");
    expect(root.style.getPropertyValue("--hk-ride-content")).toBe("300px");
    expect(root.style.getPropertyValue("--hk-ride-factor")).toBe("0.9");
    h4.unmount();
  });

  it("publishes nothing when the box cannot be measured", async () => {
    const h5 = mountBox({ riding: true });
    await nextTick();
    const root = h5.root();
    // Not "0px": an unmeasured ride must degrade to `auto` (no ride), never
    // to a collapsed frame.
    expect(root.style.getPropertyValue("--hk-ride-chrome")).toBe("");
    expect(root.style.getPropertyValue("--hk-ride-content")).toBe("");
    h5.unmount();
  });

  it("measures the same split whether the frame is at rest or compressed", async () => {
    // The measurement must never read the frame's height (that is the value
    // the ride computes): a compressed frame would otherwise report a short
    // box and every ride would shrink again on top of the last one.
    const h6 = mountBox({ riding: false });
    const root = h6.root();
    stubBox(root, 300, 60);
    await h6.setRiding(true);
    const atRest = {
      chrome: root.style.getPropertyValue("--hk-ride-chrome"),
      content: root.style.getPropertyValue("--hk-ride-content"),
    };

    // Squeeze the frame as the ride would, and re-arm.
    Object.defineProperty(root, "offsetHeight", { configurable: true, value: 2 });
    await h6.setRiding(false);
    await h6.setRiding(true);

    expect(root.style.getPropertyValue("--hk-ride-chrome")).toBe(atRest.chrome);
    expect(root.style.getPropertyValue("--hk-ride-content")).toBe(atRest.content);
    h6.unmount();
  });
});
