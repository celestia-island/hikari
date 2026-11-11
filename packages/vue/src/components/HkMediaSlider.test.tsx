import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkMediaSlider from "./HkMediaSlider";

/**
 * HkMediaSlider contract (the seek/volume primitive): the 2026-11-11
 * rail-inset geometry — thumb parked on 0/1 rests ON the rail, buffered and
 * fill widths anchor at the rail start (flat cap), presses map into the
 * inset rail. The nested precision editor this shares visual language with
 * is pinned in hikari's HkSlider suite.
 *
 * Repo test convention: raw createApp + document queries.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountSlider(ratio: number, buffered = 0) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const seen: Array<number> = [];
  const app = createApp({
    setup: () => () =>
      h(HkMediaSlider, {
        ratio,
        buffered,
        ariaLabel: "Seek",
        "onUpdate:ratio": (v: number) => seen.push(v),
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  const slider = container.querySelector(".hk-media-slider") as HTMLElement;
  return { slider, seen };
}

function pinRect(slider: HTMLElement) {
  Object.defineProperty(slider, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, width: 200, height: 6, top: 0, right: 200, bottom: 6, x: 0, y: 0 }) as DOMRect,
  });
}

function pointer(type: string, clientX: number) {
  return new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: "mouse" });
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkMediaSlider — the inset rail", () => {
  it("keeps endpoint thumbs ON the rail with a flat-start fill", () => {
    // Source contract: the pill cap on a thin saturated bar read as a
    // pointed nib at the rail start (2026-11-11 user report).
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkMediaSlider.scss"), "utf-8");
    const fill = scss.match(/\.hk-media-slider-fill\s*{[^}]*}/)?.[0] ?? "";
    expect(fill).toContain("border-radius: 0 var(--radius-full, 9999px)");
    expect(fill).toContain("inset: 0 auto 0 var(--hk-media-slider-rail-inset, 6px)");

    const atEnd = mountSlider(1);
    expect(
      (atEnd.slider.querySelector(".hk-media-slider-thumb") as HTMLElement).style.left,
    ).toBe("calc(100% - 6px)");
    expect(
      (atEnd.slider.querySelector(".hk-media-slider-fill") as HTMLElement).style.width,
    ).toBe("calc(100% - 12px)");
    expect(atEnd.slider.style.getPropertyValue("--hk-media-slider-rail-inset")).toBe("6px");

    const atStart = mountSlider(0);
    expect(
      (atStart.slider.querySelector(".hk-media-slider-thumb") as HTMLElement).style.left,
    ).toBe("calc(0% + 6px)");
    expect(
      (atStart.slider.querySelector(".hk-media-slider-fill") as HTMLElement).style.width,
    ).toBe("calc(0% - 0px)");
  });

  it("anchors the buffered bar at the rail start ahead of the fill", () => {
    const { slider } = mountSlider(0.25, 0.5);
    expect(
      (slider.querySelector(".hk-media-slider-buffered") as HTMLElement).style.width,
    ).toBe("calc(50% - 6px)");
    expect(
      (slider.querySelector(".hk-media-slider-fill") as HTMLElement).style.width,
    ).toBe("calc(25% - 3px)");
    expect(
      (slider.querySelector(".hk-media-slider-thumb") as HTMLElement).style.left,
    ).toBe("calc(25% + 3px)");
  });

  it("omits the buffered bar when nothing is buffered", () => {
    const { slider } = mountSlider(0.5);
    expect(slider.querySelector(".hk-media-slider-buffered")).toBeNull();
    expect(
      (slider.querySelector(".hk-media-slider-fill") as HTMLElement).style.width,
    ).toBe("calc(50% - 6px)");
  });

  it("maps presses into the inset rail and saturates outside", () => {
    const { slider, seen } = mountSlider(0);
    pinRect(slider);
    // 200px rect, 6px insets → a 188px rail: the rail start/mid/end land on
    // clientX 6/100/194; presses outside saturate.
    slider.dispatchEvent(pointer("pointerdown", 6));
    expect(seen).toEqual([0]);
    slider.dispatchEvent(pointer("pointerdown", 100));
    expect(seen).toEqual([0, 0.5]);
    slider.dispatchEvent(pointer("pointerdown", 194));
    expect(seen).toEqual([0, 0.5, 1]);
    // Presses before the rail start clamp (the old full-width mapping would
    // emit 3/200 instead of 0).
    slider.dispatchEvent(pointer("pointerdown", 3));
    expect(seen).toEqual([0, 0.5, 1, 0]);
  });

  it("degenerate rails re-assert the current value instead of dividing", () => {
    const { slider, seen } = mountSlider(0.5);
    // 10px rect is thinner than both insets (12px): the press re-emits the
    // current ratio (the Rust mirror's None → no-emit parity), never a
    // division blow-up.
    pinRect(slider);
    Object.defineProperty(slider, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({ left: 0, width: 10, height: 6, top: 0, right: 10, bottom: 6, x: 0, y: 0 }) as DOMRect,
    });
    slider.dispatchEvent(pointer("pointerdown", 5));
    expect(seen).toEqual([0.5]);
  });
});
