import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkBoard, { type BoardNodeInput } from "./HkBoard";

/** A board whose content is far smaller than the viewport: the default fit
 *  parks at the library cap; a fitCap lets the host fill the stage. */
const nodes: BoardNodeInput[] = [
  { id: "a", x: 0, y: 0, w: 120, h: 80, label: "A" },
];
const VIEW_W = 800;
const VIEW_H = 600;

function mountBoard(props: Record<string, unknown>): { world: () => string; app: ReturnType<typeof createApp> } {
  // happy-dom lays nothing out: give the board a real viewport box so the
  // fit maths are meaningful (the chest board tests use the same stub).
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => VIEW_W });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => VIEW_H });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(defineComponent({
    setup: () => () => h(HkBoard, { nodes, ...props }),
  }));
  app.mount(host);
  return {
    world: () => document.body.querySelector<HTMLElement>(".hk-board-world")!.style.transform,
    app,
  };
}

/** The world transform's scale factor, parsed out of `translate(..) scale(k)`. */
function scaleOf(transform: string): number {
  return Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 0);
}

describe("HkBoard fitCap", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("caps the default fit at the library ceiling when no fitCap is given", async () => {
    const { world, app } = mountBoard({});
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    expect(scaleOf(world())).toBeLessThanOrEqual(1.25 + 1e-6);
    app.unmount();
  });

  it("lets a host raise the fit ceiling to fill the stage", async () => {
    const { world, app } = mountBoard({ fitCap: 3 });
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    const k = scaleOf(world());
    // The fit honours the raised cap: with a 120px node in an 800px-ish
    // stage the scale would be ~5 at fill; the cap is the ceiling, so the
    // observed scale must exceed the library default and not exceed 3.
    expect(k).toBeGreaterThan(1.25);
    expect(k).toBeLessThanOrEqual(3 + 1e-6);
    app.unmount();
  });
});
