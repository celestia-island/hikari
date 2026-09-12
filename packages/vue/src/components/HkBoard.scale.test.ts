import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkBoard from "./HkBoard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
const restores: Array<() => void> = [];

afterEach(() => {
  for (const restore of restores.splice(0)) restore();
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

/** The board's camera lives in the board's OWN pixels: the world transform is
 *  written in them. */
function worldTransform(container: HTMLElement): { x: number; y: number; k: number } {
  const world = container.querySelector<HTMLElement>(".hk-board-world")!;
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(
    world.style.transform,
  );
  if (!m) throw new Error(`unexpected world transform: ${world.style.transform}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), k: parseFloat(m[3]) };
}

function pointer(type: string, id: number, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: "touch", clientX: x, clientY: y });
}

async function mountBoard() {
  // The board reads its viewport size at mount (clientWidth/Height, i.e. the
  // layout box): pin it on the prototype for the duration so the camera's
  // clamp has a real viewport to work with, the way a laid-out page would.
  const proto = HTMLElement.prototype as unknown as {
    clientWidth: number;
    clientHeight: number;
  };
  const beforeW = Object.getOwnPropertyDescriptor(proto, "clientWidth");
  const beforeH = Object.getOwnPropertyDescriptor(proto, "clientHeight");
  Object.defineProperty(proto, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList?.contains("hk-board") ? 800 : 0;
    },
  });
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList?.contains("hk-board") ? 600 : 0;
    },
  });
  restores.push(() => {
    if (beforeW) Object.defineProperty(proto, "clientWidth", beforeW);
    else delete (proto as { clientWidth?: number }).clientWidth;
    if (beforeH) Object.defineProperty(proto, "clientHeight", beforeH);
    else delete (proto as { clientHeight?: number }).clientHeight;
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(HkBoard, {
          // Content far larger than the viewport, so the camera's clamp lets
          // it pan instead of re-centring a board that already fits.
          nodes: [
            { id: "a", x: 0, y: 0, w: 200, h: 120, label: "A" },
            { id: "b", x: 3000, y: 3000, w: 200, h: 120, label: "B" },
          ],
          fitOnMount: false,
          // No tween: the assertions read the camera right after the event.
          animated: false,
          grid: false,
          minimap: false,
        }),
    }),
  );
  app.mount(container);
  mounts.push({ app, container });
  await nextTick();
  const viewport = container.querySelector<HTMLElement>(".hk-board")!;
  // The board is drawn twice the size it is laid out at, and its own box
  // reports the layout size — the shape a scaled or zoomed root produces.
  Object.defineProperty(viewport, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, right: 1600, bottom: 1200, width: 1600, height: 1200, x: 0, y: 0 }) as DOMRect,
  });
  Object.defineProperty(viewport, "offsetWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(viewport, "offsetHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(viewport, "clientWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, get: () => 600 });
  // happy-dom has no pointer capture: the board captures every finger, and a
  // throw there would end the gesture before it starts.
  Object.defineProperty(viewport, "setPointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(viewport, "releasePointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(viewport, "hasPointerCapture", { configurable: true, value: () => true });
  return { container, viewport };
}

describe("HkBoard scaled-space gestures", () => {
  it("pans by the finger's own distance inside a scaled root", async () => {
    const { container, viewport } = await mountBoard();
    const before = worldTransform(container);

    viewport.dispatchEvent(pointer("pointerdown", 1, 1600, 1600));
    viewport.dispatchEvent(pointer("pointermove", 1, 1520, 1540));
    await nextTick();

    const after = worldTransform(container);
    expect(after.x, "-80 drawn px are -40 of the board's own").toBeCloseTo(before.x - 40, 4);
    expect(after.y, "-60 drawn px are -30 of the board's own").toBeCloseTo(before.y - 30, 4);
    viewport.dispatchEvent(pointer("pointerup", 1, 1520, 1540));
  });

  it("keeps a zoom anchored under the pointer inside a scaled root", async () => {
    const { container, viewport } = await mountBoard();
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -1 });
    Object.defineProperty(wheel, "clientX", { value: 800 });
    Object.defineProperty(wheel, "clientY", { value: 600 });
    // The pointer sits at the board's own (400, 300) — half the layout box.
    const anchor = { x: 400, y: 300 };
    const before = worldTransform(container);
    const world = {
      x: (anchor.x - before.x) / before.k,
      y: (anchor.y - before.y) / before.k,
    };
    viewport.dispatchEvent(wheel);
    await nextTick();
    const after = worldTransform(container);
    expect(after.k).toBeGreaterThan(before.k);
    expect(after.x + world.x * after.k, "the world point stays under the pointer").toBeCloseTo(anchor.x, 3);
    expect(after.y + world.y * after.k).toBeCloseTo(anchor.y, 3);
  });
});
