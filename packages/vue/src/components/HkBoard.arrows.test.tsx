import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkBoard, { type BoardEdgeInput, type BoardNodeInput } from "./HkBoard";

/**
 * HkBoard — what a diagram needs from the board beyond "it draws".
 *
 * Three contracts, each first seen on the docs site (2026-11-27):
 *
 *  1. HIDDEN JUNCTIONS ARE CONTENT. A sequence diagram's message rows sit on
 *     zero-size junction nodes; the fit used to take the bbox of the visible
 *     boxes only, framed the participant headers and left 7 of 9 messages
 *     outside the card.
 *  2. A FITTED BOARD CAN BE DRAGGABLE. With the default pan clamp, content
 *     smaller than the viewport re-centers on every frame — the reader
 *     dragged, nothing moved, and read the view as "cannot be dragged".
 *  3. ARROWS ARRIVE HEAD-ON. An `orient="auto"` arrowhead rotates to the
 *     path's end tangent; the bezier must end along the border normal.
 */

const VIEW_W = 800;
const VIEW_H = 600;

/** happy-dom lays nothing out; the box is whatever these getters say. */
const box = { w: 0, h: 0 };
let observers: Array<() => void> = [];

class FakeResizeObserver {
  constructor(private readonly cb: () => void) {}
  observe(): void {
    observers.push(this.cb);
    this.cb();
  }
  disconnect(): void {
    observers = observers.filter((cb) => cb !== this.cb);
  }
  unobserve(): void {}
}

interface Camera {
  tx: number;
  ty: number;
  k: number;
}

interface Mounted {
  container: HTMLElement;
  cam: () => Camera;
  unmount: () => void;
}

function mountBoard(props: Record<string, unknown>): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({ setup: () => () => h(HkBoard, props) }));
  app.mount(container);
  const cam = (): Camera => {
    const t = container.querySelector<HTMLElement>(".hk-board-world")!.style.transform;
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+)\)/.exec(t);
    if (!m) throw new Error(`unreadable camera transform: ${t}`);
    return { tx: Number(m[1]), ty: Number(m[2]), k: Number(m[3]) };
  };
  return { container, cam, unmount: () => app.unmount() };
}

/** The mount fit ANIMATES (~170ms): wait it out, as a browser would. */
async function settleFit(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 260));
  await nextTick();
}

function pointer(type: string, x: number, y: number): Event {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const ev = new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  (ev as { pointerId?: number }).pointerId = 1;
  return ev;
}

/** A left-button drag on the board surface (not on a node). */
function drag(container: HTMLElement, sx: number, sy: number, ex: number, ey: number): void {
  const root = container.querySelector<HTMLElement>(".hk-board")!;
  root.dispatchEvent(pointer("pointerdown", sx, sy));
  root.dispatchEvent(pointer("pointermove", (sx + ex) / 2, (sy + ey) / 2));
  root.dispatchEvent(pointer("pointermove", ex, ey));
  root.dispatchEvent(pointer("pointerup", ex, ey));
}

/** `[c2x, c2y, ex, ey]` of the LAST cubic of a path: its second control
 *  point and its end point. */
function lastCubic(path: Element): [number, number, number, number] {
  const d = path.getAttribute("d") ?? "";
  const legs = d.match(/C [^C]+/g);
  if (!legs) throw new Error(`no cubic in ${d}`);
  const nums = legs[legs.length - 1]!.slice(2).replace(/,/g, "").trim().split(/\s+/).map(Number);
  return [nums[2], nums[3], nums[4], nums[5]];
}

const loneNode: BoardNodeInput = { id: "a", x: 0, y: 0, w: 100, h: 40, label: "A" };

beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => box.w });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => box.h });
  // happy-dom has no pointer capture; the board calls it on every press.
  if (!Element.prototype.setPointerCapture) {
    Object.defineProperty(Element.prototype, "setPointerCapture", { configurable: true, value: () => {} });
  }
  observers = [];
  box.w = VIEW_W;
  box.h = VIEW_H;
});

afterEach(() => {
  document.body.innerHTML = "";
  observers = [];
  delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

describe("HkBoard — hidden junctions are content", () => {
  it("the fit keeps a far-away junction on screen", async () => {
    const junction: BoardNodeInput = { id: "j", x: 50, y: 500, w: 0, h: 0, hidden: true };
    const edges: BoardEdgeInput[] = [{ id: "e", from: "a", to: "j" }];
    const board = mountBoard({ nodes: [loneNode, junction], edges });
    await settleFit();
    const { k, ty } = board.cam();
    // Content = node ∪ junction plus the 20px bbox margin: 140 × 540 world.
    // Framing the visible box alone would cap at k = 1.25 and push the
    // junction to screen y ≈ 900 — 300px below the viewport.
    expect(k).toBeLessThan(1.1);
    const junctionScreenY = ty + 500 * k;
    expect(junctionScreenY).toBeLessThanOrEqual(VIEW_H);
    expect(junctionScreenY).toBeGreaterThan(VIEW_H - 80);
    board.unmount();
  });
});

describe("HkBoard — pan mode", () => {
  it("pan='float' lets a fitted board be dragged; the default re-centers it", async () => {
    const floating = mountBoard({ nodes: [loneNode], edges: [], pan: "float" });
    const pinned = mountBoard({ nodes: [loneNode], edges: [] });
    await settleFit();
    const before = floating.cam();
    const pinnedBefore = pinned.cam();
    // Both fitted the same way: a single 100×40 box centred at k = 1.25.
    expect(before.k).toBeCloseTo(1.25, 3);
    expect(pinnedBefore.k).toBeCloseTo(1.25, 3);

    drag(floating.container, 400, 300, 300, 250);
    await nextTick();
    const after = floating.cam();
    expect(after.tx).toBeCloseTo(before.tx - 100, 1);
    expect(after.ty).toBeCloseTo(before.ty - 50, 1);
    expect(after.k).toBeCloseTo(before.k, 6);

    drag(pinned.container, 400, 300, 300, 250);
    await nextTick();
    const pinnedAfter = pinned.cam();
    expect(pinnedAfter.tx).toBeCloseTo(pinnedBefore.tx, 3);
    expect(pinnedAfter.ty).toBeCloseTo(pinnedBefore.ty, 3);
    floating.unmount();
    pinned.unmount();
  });

  it("'float' still never lets the content leave the viewport entirely", async () => {
    const board = mountBoard({ nodes: [loneNode], edges: [], pan: "float" });
    await settleFit();
    const before = board.cam();
    // A drag ten viewports to the right.
    drag(board.container, 400, 300, 8400, 300);
    await nextTick();
    const after = board.cam();
    expect(after.tx).toBeGreaterThan(before.tx);
    // It follows the gesture only until HALF the node has left the screen
    // (the node is 100 wide; its left half is still on screen)…
    expect(after.tx + (100 * after.k) / 2).toBeLessThanOrEqual(VIEW_W + 0.5);
    // …and has hit that bound: the same drag again moves nothing.
    drag(board.container, 400, 300, 8400, 300);
    await nextTick();
    expect(board.cam().tx).toBeCloseTo(after.tx, 3);
    board.unmount();
  });
});

describe("HkBoard — arrows arrive head-on", () => {
  it("an arrow between stacked nodes ends along the vertical border normal", async () => {
    const nodes: BoardNodeInput[] = [
      { id: "a", x: 0, y: 0, w: 100, h: 40, label: "A" },
      { id: "b", x: 0, y: 120, w: 100, h: 40, label: "B" },
    ];
    const edges: BoardEdgeInput[] = [{ id: "e", from: "a", to: "b", style: "bezier", arrow: "solid", label: "go" }];
    const board = mountBoard({ nodes, edges });
    await nextTick();
    const path = board.container.querySelector(".hk-board-edge")!;
    const [c2x, c2y, ex, ey] = lastCubic(path);
    // The end point is the top-border midpoint of the target.
    expect([ex, ey]).toEqual([50, 120]);
    // The last control point sits straight ABOVE it: the end tangent is
    // (0, +k) — never zero, never sideways.
    expect(c2x).toBe(ex);
    expect(c2y).toBeLessThan(ey);
    expect(path.getAttribute("marker-end")).toMatch(/^url\(#hk-board-ah-/);
    // The caption rides the curve's own midpoint.
    const label = board.container.querySelector(".hk-board-edge-label")!;
    expect(label.textContent).toBe("go");
    expect([Number(label.getAttribute("x")), Number(label.getAttribute("y"))]).toEqual([50, 80]);
    board.unmount();
  });

  it("a side-docked edge (right → left) ends along the horizontal border normal", async () => {
    const nodes: BoardNodeInput[] = [
      { id: "a", x: 0, y: 0, w: 100, h: 40, label: "A" },
      { id: "b", x: 240, y: 0, w: 100, h: 40, label: "B" },
    ];
    const edges: BoardEdgeInput[] = [{ id: "e", from: "a", to: "b", anchorFrom: "right", anchorTo: "left", style: "bezier", arrow: "solid" }];
    const board = mountBoard({ nodes, edges });
    await nextTick();
    const [c2x, c2y, ex, ey] = lastCubic(board.container.querySelector(".hk-board-edge")!);
    expect([ex, ey]).toEqual([240, 20]);
    expect(c2y).toBe(ey);
    expect(c2x).toBeLessThan(ex);
    board.unmount();
  });
});
