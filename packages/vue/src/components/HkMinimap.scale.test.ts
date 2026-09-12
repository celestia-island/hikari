import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkMinimap from "./HkMinimap";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

/** Mount the overview map and drag it: the emitted pan says how far the scene
 *  should move for a pointer that travelled `drawn` pixels. */
function drag(drawnWidth: number): { dx: number; dy: number } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const deltas: Array<[number, number]> = [];
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkMinimap, {
          zoom: 1,
          zoomPercent: 100,
          panX: 0,
          panY: 0,
          viewportWidth: 400,
          viewportHeight: 300,
          boxes: [{ id: "a", bounds: { x: 0, y: 0, w: 100, h: 100 }, color: "red" }],
          onPanDelta: (dx: number, dy: number) => deltas.push([dx, dy]),
        });
    },
  });
  const app = createApp(Host);
  mounts.push(app);
  app.mount(container);

  const root = container.querySelector<HTMLElement>(".hk-minimap")!;
  const svg = root.querySelector<SVGSVGElement>("svg.hk-minimap-svg")!;
  // The map's viewBox is 160 units wide; the card draws it at `drawnWidth`.
  Object.defineProperty(svg, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, top: 0, right: drawnWidth, bottom: drawnWidth * (110 / 160), width: drawnWidth, height: drawnWidth * (110 / 160), x: 0, y: 0 }) as DOMRect,
  });
  Object.defineProperty(root, "setPointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(root, "releasePointerCapture", { configurable: true, value: () => {} });

  const at = (type: string, x: number, y: number) =>
    root.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "mouse", clientX: x, clientY: y }),
    );
  at("pointerdown", 100, 100);
  at("pointermove", 140, 120);
  at("pointerup", 140, 120);
  expect(deltas, "the drag emitted a pan").toHaveLength(1);
  return { dx: deltas[0][0], dy: deltas[0][1] };
}

describe("HkMinimap scaled-space pan", () => {
  it("scales the pan by the map's own drawn size", () => {
    // The map is drawn into a card that is not necessarily as wide as the
    // SVG's viewBox — and, in a scaled or zoomed root, is drawn wider still.
    // The pointer's drawn pixels have to come down through that factor, or a
    // drag moves the scene further than the pointer went (and at k = 3 the
    // scene runs away from the cursor entirely).
    const normal = drag(160); // 1 drawn px = 1 user unit
    const wide = drag(320); // 1 drawn px = half a unit
    expect(Math.abs(wide.dx), "half the travel for the same pointer").toBeCloseTo(
      Math.abs(normal.dx) / 2,
      6,
    );
    expect(Math.abs(wide.dy)).toBeCloseTo(Math.abs(normal.dy) / 2, 6);
    expect(normal.dx, "the scene follows the pointer the other way").toBeLessThan(0);
  });
});
