import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkBoard, { type BoardNodeInput } from "./HkBoard";

const nodes: BoardNodeInput[] = [{ id: "long", x: 0, y: 0, w: 100, h: 600 }];
const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const mounted: Array<{ app: ReturnType<typeof createApp>; host: HTMLElement }> = [];

function mountBoard(
  props: Record<string, unknown>,
  viewport = { w: 800, h: 600 },
  writingDirection: "ltr" | "rtl" = "ltr",
): HTMLElement {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => viewport.w });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => viewport.h });
  const host = document.createElement("div");
  host.dir = writingDirection;
  host.style.direction = writingDirection;
  document.body.appendChild(host);
  const app = createApp(defineComponent({
    setup: () => () => h(HkBoard, { nodes, ...props }),
  }));
  app.mount(host);
  mounted.push({ app, host });
  return host;
}

async function click(button: Element): Promise<void> {
  (button as HTMLButtonElement).click();
  await nextTick();
}

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
  if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", widthDescriptor);
  if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", heightDescriptor);
});

describe("HkBoard percent governance", () => {
  it("fits and steps on exact linear rungs down to the readable floor", async () => {
    // MUT:percent-board-controls — routing minimap steps through the geometric
    // boardStepRung never passes this sequence: fit is 80%, then 85%, and seven
    // downward presses stop at exactly 50% with only the minus button disabled.
    const host = mountBoard({
      zoomLadder: "percent",
      zoomStepPercent: 5,
      minK: 0.5,
      maxK: 2,
      fitCap: 1,
      animated: false,
    });
    await nextTick();
    const label = host.querySelector(".hk-mm-zoom-label")!;
    const buttons = host.querySelectorAll<HTMLButtonElement>(".hk-mm-zoom-btn");
    const minus = buttons[0]!;
    const plus = buttons[1]!;
    expect(label.textContent).toBe("80%");
    await click(plus);
    expect(label.textContent).toBe("85%");
    for (let i = 0; i < 7; i += 1) await click(minus);
    expect(label.textContent).toBe("50%");
    expect(minus.disabled).toBe(true);
    expect(plus.disabled).toBe(false);
    await click(plus);
    expect(label.textContent).toBe("55%");
    expect(minus.disabled).toBe(false);
  });

  it("does not replace the hidden-viewport zero sentinel with the 50% floor", async () => {
    // MUT:percent-hidden-sentinel — assigning kFloor=minK for a zero fit never
    // passes: clampCam raises the hidden board to 50% instead of waiting for a
    // real viewport, and the world transform exposes the incorrect scale.
    const host = mountBoard({
      zoomLadder: "percent",
      minK: 0.5,
      maxK: 2,
      animated: false,
    }, { w: 0, h: 0 });
    await nextTick();
    const transform = host.querySelector<HTMLElement>(".hk-board-world")!.style.transform;
    expect(transform).toContain("scale(0)");
  });

  it("reads the host's live RTL direction when placing the fit reserve", async () => {
    // MUT:board-live-rtl-reserve — using a hard-coded physical right edge never
    // passes: this host's fit must translate to x=450 (the LTR value is 270).
    const host = mountBoard({
      zoomLadder: "percent",
      minK: 0.5,
      maxK: 2,
      fitCap: 1,
      fitEndReserve: 180,
      pan: "float",
      animated: false,
    }, { w: 800, h: 600 }, "rtl");
    await nextTick();
    const transform = host.querySelector<HTMLElement>(".hk-board-world")!.style.transform;
    expect(transform).toContain("translate(450px");
  });

  it("keeps the default board on its existing geometric ladder", async () => {
    // MUT:default-geometric-ladder — changing HkBoard's default zoomLadder to
    // percent catches here: three wheel-in gestures must be 1.05³ and read
    // 116%, not the linear 115%.
    const host = mountBoard({ fitOnMount: false, animated: false });
    await nextTick();
    const board = host.querySelector<HTMLElement>(".hk-board")!;
    for (let i = 0; i < 3; i += 1) {
      board.dispatchEvent(new WheelEvent("wheel", { cancelable: true, deltaY: -1 }));
      await nextTick();
    }
    expect(host.querySelector(".hk-mm-zoom-label")!.textContent).toBe("116%");
    const transform = host.querySelector<HTMLElement>(".hk-board-world")!.style.transform;
    const k = Number(/scale\(([\d.]+)\)/.exec(transform)?.[1]);
    expect(k).toBeCloseTo(1.05 ** 3, 6);
  });
});
