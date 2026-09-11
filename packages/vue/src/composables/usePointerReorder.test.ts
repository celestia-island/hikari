import { afterEach, describe, expect, it } from "vitest";
import { effectScope, type EffectScope } from "vue";

import { usePointerReorder, type PointerReorder } from "./usePointerReorder";

/** Items with PINNED rects — happy-dom ships no layout engine, so every
 *  item is placed by hand along the axis under test (size 40, the same
 *  geometry a 40px chip row or panel row would report). */
function strip(axis: "x" | "y", count = 3, size = 40) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("div");
    el.textContent = `item-${i}`;
    const start = i * size;
    const box = {
      left: axis === "x" ? start : 0,
      right: axis === "x" ? start + size : size,
      top: axis === "x" ? 0 : start,
      bottom: axis === "x" ? size : start + size,
      width: size,
      height: size,
      x: axis === "x" ? start : 0,
      y: axis === "x" ? 0 : start,
    };
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => box as DOMRect,
    });
    container.appendChild(el);
    items.push(el);
  }
  return { container, items };
}

/** Waits out `frames` animation frames — the auto-scroll loop steps once
 *  per frame (the repo's useApproachEnd pattern). */
async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/** A scrollable strip for the auto-scroll tests: the container reports a
 *  fixed box and holds real `scrollTop`/`scrollLeft` numbers, and every
 *  item is placed relative to the current scroll offset — which is exactly
 *  what a browser does to the content a scroll moves under the pointer. */
function scrollStrip(
  axis: "x" | "y",
  count: number,
  size: number,
  viewport: number,
): { container: HTMLElement; items: HTMLElement[] } {
  const container = document.createElement("div");
  const box =
    axis === "x"
      ? { left: 0, right: viewport, top: 0, bottom: size }
      : { left: 0, right: size, top: 0, bottom: viewport };
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ ...box, width: box.right - box.left, height: box.bottom - box.top, x: box.left, y: box.top }) as DOMRect,
  });
  document.body.appendChild(container);

  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("div");
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const offset = (axis === "x" ? container.scrollLeft : container.scrollTop);
        const start = i * size - offset;
        const item =
          axis === "x"
            ? { left: start, right: start + size, top: 0, bottom: size }
            : { left: 0, right: size, top: start, bottom: start + size };
        return { ...item, width: size, height: size, x: item.left, y: item.top } as DOMRect;
      },
    });
    container.appendChild(el);
    items.push(el);
  }
  return { container, items };
}

const scopes: EffectScope[] = [];

/** Mount the composable inside a real effect scope (the component case). */
function harness(
  axis: "x" | "y",
  items: HTMLElement[],
  threshold?: number,
  scrollContainer?: () => HTMLElement | null,
): { handle: PointerReorder; drops: Array<[number, number]> } {
  const drops: Array<[number, number]> = [];
  const scope = effectScope();
  scopes.push(scope);
  let handle!: PointerReorder;
  scope.run(() => {
    handle = usePointerReorder({
      items: () => items,
      axis,
      threshold,
      scrollContainer,
      onDrop: (from, to) => drops.push([from, to]),
    });
  });
  return { handle, drops };
}

/** Press item `index` and hand the event to the composable — exactly what
 *  a component's `onPointerdown` handler does. `buttons` is 1 throughout a
 *  press, as a real pointer reports it: a move with `buttons: 0` means the
 *  button went up somewhere the page never saw, and the composable treats
 *  it as the end of the gesture. */
function press(
  handle: PointerReorder,
  items: HTMLElement[],
  index: number,
  coordinate: { x?: number; y?: number },
  id = 1,
): void {
  const event = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId: id,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    clientX: coordinate.x ?? 0,
    clientY: coordinate.y ?? 0,
  });
  items[index].dispatchEvent(event);
  handle.start(event, index);
}

function move(x: number, y = 0, id = 1, buttons = 1): void {
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: id,
      pointerType: "mouse",
      buttons,
      clientX: x,
      clientY: y,
    }),
  );
}

function up(x: number, y = 0, id = 1): void {
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: id,
      pointerType: "mouse",
      buttons: 0,
      clientX: x,
      clientY: y,
    }),
  );
}

function cancel(id = 1): void {
  window.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerId: id, pointerType: "touch" }),
  );
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  document.body.innerHTML = "";
});

describe("usePointerReorder", () => {
  it("keeps an idle press idle — a move under the threshold is not a drag", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(14);
    expect(handle.dragging.value).toBe(false);
    expect(handle.dragFrom.value).toBe(-1);
    expect(handle.dragOver.value).toBe(-1);

    up(14);
    expect(drops).toEqual([]);
    expect(handle.dragging.value).toBe(false);
  });

  it("honours a custom threshold", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items, 30);

    press(handle, items, 0, { x: 10 });
    move(30);
    expect(handle.dragging.value, "20px is still under a 30px threshold").toBe(false);
    move(75);
    expect(handle.dragging.value).toBe(true);
    up(75);
    expect(drops).toEqual([[0, 1]]);
  });

  it("publishes the drag state and resolves the slot from the item midpoints", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(70);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragFrom.value).toBe(0);
    expect(handle.dragOver.value, "70 is past item 1's midpoint of 60").toBe(1);

    up(70);
    expect(drops).toEqual([[0, 1]]);
    // The gesture released every listener and reset the published state.
    expect(handle.dragging.value).toBe(false);
    expect(handle.dragFrom.value).toBe(-1);
    expect(handle.dragOver.value).toBe(-1);
  });

  it("resolves the landing slot along the declared axis only", () => {
    const { items } = strip("y");
    const { handle, drops } = harness("y", items);

    // Item 2 spans y 80-120 (midpoint 100) and is dragged from y 90.
    press(handle, items, 2, { y: 90 });
    move(500, 90);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "x travel says nothing on a y strip").toBe(2);

    move(0, 10);
    expect(handle.dragOver.value, "10 is before item 0's midpoint of 20").toBe(0);
    up(0, 10);
    expect(drops).toEqual([[2, 0]]);
  });

  it("clamps a release past the end onto the last item of the strip", () => {
    const { items } = strip("y");
    const { handle, drops } = harness("y", items);

    press(handle, items, 0, { y: 10 });
    move(0, 5000);
    expect(handle.dragOver.value).toBe(2);
    up(0, 5000);
    expect(drops).toEqual([[0, 2]]);
  });

  it("emits nothing when the drag lands back on the item it started on", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 1, { x: 50 });
    move(70);
    expect(handle.dragging.value).toBe(true);
    up(52);
    expect(drops).toEqual([]);
  });

  it("abandons the drag on pointercancel without emitting", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(70);
    cancel();
    expect(handle.dragging.value).toBe(false);
    expect(handle.dragFrom.value).toBe(-1);

    // The gesture is forgotten: a stray move/up cannot resurrect it.
    move(110);
    up(110);
    expect(drops).toEqual([]);
  });

  it("abandons the drag on Escape without emitting", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(70);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(handle.dragging.value).toBe(false);
    up(110);
    expect(drops).toEqual([]);
  });

  it("drops the trap and the listeners when the scope is torn down mid-drag", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);
    const scope = scopes[scopes.length - 1];

    press(handle, items, 0, { x: 10 });
    move(70);
    scope.stop();
    expect(handle.dragging.value).toBe(false);
    up(110);
    expect(drops).toEqual([]);
  });

  it("ignores a press that starts on an interactive control", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);
    const button = document.createElement("button");
    items[0].appendChild(button);

    const event = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 0,
    });
    button.dispatchEvent(event);
    handle.start(event, 0);

    move(110);
    expect(handle.dragging.value).toBe(false);
    up(110);
    expect(drops).toEqual([]);
  });

  it("ignores a non-primary button and a second pointer gesturing at once", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    const right = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      button: 2,
      buttons: 2,
      clientX: 10,
      clientY: 0,
    });
    items[0].dispatchEvent(right);
    handle.start(right, 0);
    move(110);
    expect(handle.dragging.value, "the right button never drags").toBe(false);

    // A live drag belongs to ONE pointer: a second finger is not a move.
    press(handle, items, 0, { x: 10 }, 1);
    move(70, 0, 1);
    expect(handle.dragOver.value).toBe(1);
    move(110, 0, 2);
    expect(handle.dragOver.value, "the second pointer is ignored").toBe(1);
    up(110, 0, 2);
    expect(drops).toEqual([]);
    up(70);
    expect(drops).toEqual([[0, 1]]);
  });

  it("resolves against the pointer's own LINE on a wrapping strip", () => {
    // Two lines of chips with different widths (a real wrap):
    //   line 1: [0] x0-100 (mid 50)   [1] x100-200 (mid 150)
    //   line 2: [2] x0-60  (mid 30)   [3] x60-120  (mid 90)
    const items: HTMLElement[] = [];
    const geometry = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 0, right: 60, top: 40, bottom: 80 },
      { left: 60, right: 120, top: 40, bottom: 80 },
    ];
    for (const box of geometry) {
      const el = document.createElement("div");
      Object.defineProperty(el, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({ ...box, width: box.right - box.left, height: box.bottom - box.top, x: box.left, y: box.top }) as DOMRect,
      });
      document.body.appendChild(el);
      items.push(el);
    }
    const { handle, drops } = harness("x", items);

    // Item 2 dragged right along ITS line lands on item 3. Measured against
    // the whole strip instead, line 1's midpoints would answer 1.
    press(handle, items, 2, { x: 5, y: 60 });
    move(100, 60);
    expect(handle.dragOver.value).toBe(3);
    up(100, 60);
    expect(drops).toEqual([[2, 3]]);

    // A pointer below every line takes the NEAREST line, not the first one.
    press(handle, items, 2, { x: 5, y: 60 });
    move(100, 400);
    expect(handle.dragOver.value).toBe(3);
    up(100, 400);
    expect(drops).toEqual([
      [2, 3],
      [2, 3],
    ]);
  });

  it("retires a stale click trap when a new press starts", () => {
    const { items } = strip("x");
    const { handle } = harness("x", items);
    const inner = document.createElement("span");
    items[0].appendChild(inner);
    const clicks: string[] = [];
    items[0].addEventListener("click", () => clicks.push("row"));

    // A drag whose trailing click never arrives leaves the trap armed…
    press(handle, items, 0, { x: 10 });
    move(70);
    up(70);
    // …and the very next press retires it, so the click of the NEW gesture
    // is a real user click and not the previous drag's ghost.
    press(handle, items, 1, { x: 50 });
    up(51);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["row"]);
  });

  it("retires a stale trap even when the next press is rejected", () => {
    const { items } = strip("x");
    const { handle } = harness("x", items);
    const button = document.createElement("button");
    items[0].appendChild(button);
    const clicks: string[] = [];
    button.addEventListener("click", () => clicks.push("button"));

    // A drag whose trailing click never arrived leaves the trap armed…
    press(handle, items, 0, { x: 10 });
    move(70);
    up(70);

    // …and a press the composable REFUSES (a control inside the strip) still
    // ends that window: the × must not look dead for the next 400ms.
    const rejected = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 0,
    });
    button.dispatchEvent(rejected);
    handle.start(rejected, 0);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["button"]);
  });

  it("abandons the drag when a move arrives with no button held", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(70);
    expect(handle.dragging.value).toBe(true);

    // The release happened where the page could not see it (the pointer
    // left the window); the next move reports no buttons and ends it.
    move(110, 0, 1, 0);
    expect(handle.dragging.value).toBe(false);
    expect(handle.dragFrom.value).toBe(-1);

    // Whatever arrives afterwards — including a stray `up` at a position
    // the user never chose — must not drop the dead drag.
    up(110);
    expect(drops).toEqual([]);

    // …and the strip is not wedged: the next press drags normally.
    press(handle, items, 0, { x: 10 });
    move(70);
    up(70);
    expect(drops).toEqual([[0, 1]]);
  });

  it("abandons the drag when the window loses focus", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10 });
    move(70);
    expect(handle.dragging.value).toBe(true);

    window.dispatchEvent(new Event("blur"));
    expect(handle.dragging.value).toBe(false);
    expect(handle.dragFrom.value, "the strip is idle, not wedged").toBe(-1);
    up(200);
    expect(drops).toEqual([]);

    press(handle, items, 0, { x: 10 });
    move(70);
    up(70);
    expect(drops).toEqual([[0, 1]]);
  });

  it("abandons the drag when the page is hidden", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    try {
      press(handle, items, 0, { x: 10 });
      move(70);
      document.dispatchEvent(new Event("visibilitychange"));
      expect(handle.dragging.value).toBe(false);
      up(200);
      expect(drops).toEqual([]);
    } finally {
      if (hidden) Object.defineProperty(Document.prototype, "hidden", hidden);
      else delete (document as unknown as Record<string, unknown>).hidden;
    }
  });

  it("pulls a long drag along its scroller near the bottom edge", async () => {
    // A 2-row band (80px) over a 5-row strip (40px rows): the last row can
    // only be reached by scrolling.
    const { container, items } = scrollStrip("y", 5, 40, 80);
    const { handle, drops } = harness("y", items, undefined, () => container);

    press(handle, items, 0, { y: 10 });
    // Hold near the bottom edge (zone 56..80, pointer at 78).
    move(0, 78);
    expect(handle.dragging.value).toBe(true);
    // …with nothing scrolled yet, the pointer can only reach the third row.
    expect(handle.dragOver.value).toBe(1);

    await frames(3);
    expect(container.scrollTop, "the strip is being pulled along").toBeGreaterThan(0);
    expect(handle.dragOver.value, "the slot follows the scrolled content").toBeGreaterThan(1);

    // Held at the edge long enough for the last row to arrive, the release
    // lands there — the whole point of the scroll.
    for (let i = 0; i < 40 && container.scrollTop < 140; i += 1) await frames(1);
    expect(container.scrollTop).toBeGreaterThanOrEqual(140);
    expect(handle.dragOver.value).toBe(4);
    up(0, 78);
    expect(drops).toEqual([[0, 4]]);
    // The drag is over: nothing keeps scrolling.
    const settled = container.scrollTop;
    await frames(3);
    expect(container.scrollTop).toBe(settled);
  });

  it("pulls the strip back near the top edge", async () => {
    const { container, items } = scrollStrip("y", 5, 40, 80);
    const { handle, drops } = harness("y", items, undefined, () => container);
    container.scrollTop = 120;

    press(handle, items, 3, { y: 70 });
    move(0, 2);
    expect(handle.dragging.value).toBe(true);
    await frames(3);
    expect(container.scrollTop, "the strip is pulled back").toBeLessThan(120);
    expect(container.scrollTop).toBeGreaterThanOrEqual(0);
    expect(handle.dragOver.value, "the slot follows the content back").toBeLessThan(3);

    // Carried all the way back, the row lands at the front.
    for (let i = 0; i < 40 && container.scrollTop > 20; i += 1) await frames(1);
    expect(handle.dragOver.value).toBe(0);
    up(0, 2);
    expect(drops).toEqual([[3, 0]]);
  });

  it("stops scrolling when the pointer leaves the edge zone", async () => {
    const { container, items } = scrollStrip("y", 5, 40, 80);
    const { handle } = harness("y", items, undefined, () => container);

    press(handle, items, 0, { y: 10 });
    move(0, 78);
    await frames(2);
    const scrolled = container.scrollTop;
    expect(scrolled).toBeGreaterThan(0);

    // Back to the middle of the band: the loop stops where it is.
    move(0, 40);
    await frames(3);
    expect(container.scrollTop).toBe(scrolled);

    // …and a move back into the zone picks the pull up again.
    move(0, 79);
    await frames(2);
    expect(container.scrollTop).toBeGreaterThan(scrolled);
    up(0, 40);
  });

  it("never scrolls without a live drag", async () => {
    const { container, items } = scrollStrip("y", 5, 40, 80);
    const { handle } = harness("y", items, undefined, () => container);

    // A pointer hovering in the zone with no press at all.
    move(0, 79);
    move(0, 2);
    await frames(3);
    expect(container.scrollTop).toBe(0);

    // A press that never became a drag (under the threshold).
    press(handle, items, 0, { y: 78 });
    move(0, 78);
    await frames(3);
    expect(container.scrollTop).toBe(0);
    up(0, 78);

    // A live drag DOES scroll…
    press(handle, items, 0, { y: 10 });
    move(0, 79);
    await frames(2);
    expect(container.scrollTop).toBeGreaterThan(0);
    // …and the loop is gone with the drop.
    up(0, 79);
    const settled = container.scrollTop;
    await frames(3);
    expect(container.scrollTop).toBe(settled);

    // A cancelled drag likewise.
    press(handle, items, 0, { y: 10 });
    move(0, 79);
    await frames(2);
    expect(container.scrollTop).toBeGreaterThan(settled);
    cancel();
    const cancelled = container.scrollTop;
    await frames(3);
    expect(container.scrollTop).toBe(cancelled);
  });

  it("swallows the click a drag would deliver, and only that one", () => {
    const { items } = strip("x");
    const { handle, drops } = harness("x", items);
    const inner = document.createElement("span");
    items[0].appendChild(inner);
    const clicks: string[] = [];
    items[0].addEventListener("click", () => clicks.push("row"));

    // A plain press/release is a click: nothing is swallowed.
    press(handle, items, 0, { x: 10 });
    up(11);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["row"]);

    // A real drag is not: the trailing click is eaten at the window
    // capture phase, so the row's own handler never sees it.
    press(handle, items, 0, { x: 10 });
    move(70);
    up(70);
    expect(drops).toEqual([[0, 1]]);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["row"]);

    // …and only that one: the next user click is delivered again.
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["row", "row"]);
  });
});
