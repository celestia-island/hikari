import { afterEach, describe, expect, it } from "vitest";
import { effectScope, type EffectScope } from "vue";

import { usePointerReorder, indexAt, type PointerReorder } from "./usePointerReorder";

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

/** A hand-placed box: the geometry an element reports, on both axes. */
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Point an element at `box` — when it is built, and again mid-gesture by a
 *  test that REPLACES the geometry: a transform painted on the dragged item
 *  (the drag lift, a host's `scale()`) is exactly that, a live rect that
 *  stops being the rect the item was laid out with. */
function reshape(el: HTMLElement, box: Box): void {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => asRect(box),
  });
}

/** `box` shaped the way the browser shapes a DOMRect read off an element. */
function asRect(box: Box): DOMRect {
  return {
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
  } as DOMRect;
}

/** Items with hand-placed boxes on BOTH axes — the wrapping-strip pattern,
 *  for the geometries only a transform produces (a band widened across the
 *  strip while the item keeps its place along it). */
function boxes(geometry: Box[]): HTMLElement[] {
  return geometry.map((box) => {
    const el = document.createElement("div");
    reshape(el, box);
    document.body.appendChild(el);
    return el;
  });
}

/** A strip whose items sit inside a FRAME that an ancestor moves as a whole
 *  — the shape of a field (or a panel list) inside a page or a modal body
 *  that scrolls: no scroller is handed to the composable at all, and the
 *  items and the box they are laid out in travel together. `shift` moves
 *  both, which is all an ancestor scroll does to a strip it does not own. */
function framedStrip(geometry: Box[]): {
  frame: HTMLElement;
  items: HTMLElement[];
  shift: (dx: number, dy: number) => void;
  scale: (k: number) => void;
} {
  const frame = document.createElement("div");
  document.body.appendChild(frame);
  const live = geometry.map((box) => ({ ...box }));
  const bounds = geometry.reduce(
    (acc, box) => ({
      left: Math.min(acc.left, box.left),
      right: Math.max(acc.right, box.right),
      top: Math.min(acc.top, box.top),
      bottom: Math.max(acc.bottom, box.bottom),
    }),
    { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
  );
  Object.defineProperty(frame, "getBoundingClientRect", {
    configurable: true,
    value: () => asRect(bounds),
  });
  const items = live.map((_box, i) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => asRect(live[i]),
    });
    frame.appendChild(el);
    return el;
  });
  return {
    frame,
    items,
    shift: (dx, dy) => {
      live.forEach((box, i) => {
        live[i] = {
          left: geometry[i].left + dx,
          right: geometry[i].right + dx,
          top: geometry[i].top + dy,
          bottom: geometry[i].bottom + dy,
        };
      });
      bounds.left = Math.min(...live.map((box) => box.left));
      bounds.right = Math.max(...live.map((box) => box.right));
      bounds.top = Math.min(...live.map((box) => box.top));
      bounds.bottom = Math.max(...live.map((box) => box.bottom));
    },
    /** Paint a uniform `scale(k)` on the frame about its own top-left
     *  corner — what a browser paints on the box AND on everything laid out
     *  inside it: the corner stays put while the content travels toward it,
     *  which is exactly the movement a translation cannot describe. */
    scale: (k: number) => {
      const { left, top } = bounds;
      const grow = (box: Box): Box => ({
        left: left + (box.left - left) * k,
        right: left + (box.right - left) * k,
        top: top + (box.top - top) * k,
        bottom: top + (box.bottom - top) * k,
      });
      live.forEach((box, i) => {
        live[i] = grow(box);
      });
      const box = grow(bounds);
      bounds.left = box.left;
      bounds.right = box.right;
      bounds.top = box.top;
      bounds.bottom = box.bottom;
    },
  };
}

/** The rect an edge-anchored `transform: scale(k)` paints on a laid-out box:
 *  the box grows AWAY from the anchored corner on both axes, so anchoring
 *  the top or the bottom edge is what slides an item's cross-axis band onto
 *  (or off) a neighbouring line while its layout band stays put. */
function scaled(box: Box, k: number, anchorX: "left" | "right", anchorY: "top" | "bottom"): Box {
  const width = (box.right - box.left) * k;
  const height = (box.bottom - box.top) * k;
  const left = anchorX === "left" ? box.left : box.right - width;
  const top = anchorY === "top" ? box.top : box.bottom - height;
  return { left, right: left + width, top, bottom: top + height };
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
 *  what a browser does to the content a scroll moves under the pointer,
 *  along the strip AND across it. */
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
        const across = (axis === "x" ? container.scrollTop : container.scrollLeft);
        const start = i * size - offset;
        const item =
          axis === "x"
            ? { left: start, right: start + size, top: -across, bottom: size - across }
            : { left: -across, right: size - across, top: start, bottom: start + size };
        return { ...item, width: size, height: size, x: item.left, y: item.top } as DOMRect;
      },
    });
    container.appendChild(el);
    items.push(el);
  }
  return { container, items };
}

/** A strip whose frame IS the scroller it sits in — the frame's box, its
 *  LAID-OUT size (`offsetWidth`/`offsetHeight`, which no transform touches)
 *  and its scroll offsets all answer as a browser would, and `scene` lets a
 *  test scale and scroll the whole thing mid-gesture. */
function scrollerStrip(
  count: number,
  size: number,
  height: number,
): {
  frame: HTMLElement;
  items: HTMLElement[];
  scene: { scale: number; scroll: number; laid: number };
} {
  const frame = document.createElement("div");
  document.body.appendChild(frame);
  const scene = { scale: 1, scroll: 0, laid: count * size };
  Object.defineProperty(frame, "offsetWidth", { configurable: true, get: () => scene.laid });
  Object.defineProperty(frame, "offsetHeight", { configurable: true, get: () => height });
  Object.defineProperty(frame, "scrollLeft", { configurable: true, get: () => scene.scroll });
  Object.defineProperty(frame, "scrollTop", { configurable: true, get: () => 0 });
  Object.defineProperty(frame, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      asRect({
        left: 0,
        right: scene.laid * scene.scale,
        top: 0,
        bottom: height * scene.scale,
      }),
  });
  const items = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const start = (i * size - scene.scroll) * scene.scale;
        return asRect({
          left: start,
          right: start + size * scene.scale,
          top: 0,
          bottom: height * scene.scale,
        });
      },
    });
    frame.appendChild(el);
    return el;
  });
  return { frame, items, scene };
}

/** A strip a BROWSER could have laid out: every element reports both of the
 *  readings a real engine keeps apart — the box it is DRAWN in
 *  (`getBoundingClientRect`, which every transform moves) and the box it is
 *  LAID OUT in (`offsetLeft`/`offsetTop`/`offsetWidth`/`offsetHeight` along
 *  an `offsetParent` chain, which no transform touches). One model drives
 *  both, exactly as a browser would, so a test can re-lay the strip out (a
 *  reorder, an insertion, a font change) or paint a transform on it and see
 *  which reading the resolution followed. */
function laidStrip(
  layout: Box[],
  frameLayout: { left: number; top: number; w: number; h: number },
  frameDrawn: Box,
  scene: {
    scale?: number;
    scroll?: number;
    border?: { left: number; top: number };
    /** The frame is `position: static`, so it is nobody's `offsetParent`:
     *  the items' layout numbers are then measured from further up — the
     *  fact that decides whether the frame's border still has to be added. */
    staticFrame?: boolean;
  } = {},
): {
  frame: HTMLElement;
  items: HTMLElement[];
  laid: Box[];
  relayout: (next: Box[]) => void;
  setFrameDrawn: (next: Box) => void;
} {
  const frame = document.createElement("div");
  document.body.appendChild(frame);
  const live = layout.map((box) => ({ ...box }));
  const pins: Array<() => void> = [];
  const border = scene.border ?? { left: 0, top: 0 };
  const sceneOf = () => ({ scale: scene.scale ?? 1, scroll: scene.scroll ?? 0 });
  frame.style.borderLeftWidth = `${border.left}px`;
  frame.style.borderTopWidth = `${border.top}px`;

  /** The box a browser draws for a laid-out box inside this frame. */
  const drawn = (box: Box): Box => {
    const { scale, scroll } = sceneOf();
    const left = frameDrawn.left + (box.left - frameLayout.left - scroll) * scale;
    const top = frameDrawn.top + (box.top - frameLayout.top) * scale;
    return {
      left,
      right: left + (box.right - box.left) * scale,
      top,
      bottom: top + (box.bottom - box.top) * scale,
    };
  };

  let frameDrawnBox = frameDrawn;
  Object.defineProperty(frame, "getBoundingClientRect", {
    configurable: true,
    value: () => asRect(frameDrawnBox),
  });
  Object.defineProperty(frame, "offsetWidth", { configurable: true, get: () => frameLayout.w });
  Object.defineProperty(frame, "offsetHeight", { configurable: true, get: () => frameLayout.h });
  Object.defineProperty(frame, "offsetParent", { configurable: true, get: () => null });
  Object.defineProperty(frame, "offsetLeft", { configurable: true, get: () => frameLayout.left });
  Object.defineProperty(frame, "offsetTop", { configurable: true, get: () => frameLayout.top });
  Object.defineProperty(frame, "scrollLeft", { configurable: true, get: () => sceneOf().scroll });
  Object.defineProperty(frame, "scrollTop", { configurable: true, get: () => 0 });

  const items = live.map((box, i) => {
    const el = document.createElement("div");
    frame.appendChild(el);
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      get: () => (scene.staticFrame ? null : frame),
    });
    // A positioned frame is the items' offsetParent, so their offsets are
    // measured from its PADDING edge; a static one is skipped and they are
    // measured from the same place as the frame itself.
    Object.defineProperty(el, "offsetLeft", {
      configurable: true,
      get: () =>
        scene.staticFrame ? live[i].left : live[i].left - frameLayout.left - border.left,
    });
    Object.defineProperty(el, "offsetTop", {
      configurable: true,
      get: () => (scene.staticFrame ? live[i].top : live[i].top - frameLayout.top - border.top),
    });
    Object.defineProperty(el, "offsetWidth", {
      configurable: true,
      get: () => live[i].right - live[i].left,
    });
    Object.defineProperty(el, "offsetHeight", {
      configurable: true,
      get: () => live[i].bottom - live[i].top,
    });
    const pin = () =>
      Object.defineProperty(el, "getBoundingClientRect", {
        configurable: true,
        value: () => asRect(drawn(live[i])),
      });
    pin();
    pins.push(pin);
    return el;
  });

  return {
    frame,
    items,
    laid: live,
    relayout: (next: Box[]) => {
      next.forEach((box, i) => {
        live[i] = { ...box };
      });
      pins.forEach((pin) => pin());
    },
    setFrameDrawn: (next: Box) => {
      frameDrawnBox = next;
    },
  };
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

/** One whole gesture over a strip: press item `from` at `at`, optionally
 *  paint `lift` on that item — a transform lands AFTER the press, which is
 *  the whole point of the press-time snapshot — then run the pointer along
 *  `path` and release on its last point. Returns the slot published after
 *  every move, and the drop. */
function gesture(
  axis: "x" | "y",
  items: HTMLElement[],
  from: number,
  at: { x: number; y: number },
  path: Array<{ x: number; y: number }>,
  lift?: { index: number; box: Box },
): { over: number[]; drops: Array<[number, number]> } {
  const { handle, drops } = harness(axis, items);
  press(handle, items, from, at);
  if (lift) reshape(items[lift.index], lift.box);
  const over: number[] = [];
  for (const point of path) {
    move(point.x, point.y);
    over.push(handle.dragOver.value);
  }
  const last = path[path.length - 1];
  up(last.x, last.y);
  return { over, drops };
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

  it("resolves past a dragged chip whose own band is widened across the strip", () => {
    // One line of three chips, the DRAGGED one (index 1) carrying a band
    // widened ACROSS the strip — which is what a transform on it does: a
    // host's `scale()` on a wrapper, a zoomed container, a theme animating a
    // chip. The pointer sits 3px outside the SIBLINGS' band (43 against
    // 0-40) and inside the widened one, so the widened band is the unique
    // zero-gap match: were it the geometry that defines the line, it would
    // filter every sibling out and collapse the slot onto the chip's own
    // index — a silent no-op, no reorder and no drop ring. The press read the
    // chip's LAYOUT band, before the lift was painted, and that is the band
    // the line is read on.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const items = boxes(laid);
    const { handle, drops } = harness("x", items);

    press(handle, items, 1, { x: 150, y: 20 });
    // The lift lands now — after the press was read.
    reshape(items[1], { left: 100, right: 200, top: -8, bottom: 48 });
    move(260, 43);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "260 is past item 2's midpoint of 250").toBe(2);
    up(260, 43);
    expect(drops).toEqual([[1, 2]]);
  });

  it("resolves the panel rows the same way when the dragged row's band is widened", () => {
    // The same defect on the vertical strip, whose cross axis is x: the
    // dragged row (index 1) is lifted with its band widened from 0-40 to
    // -8-48, so the pointer at x 44 is 4px outside the siblings' band and
    // inside the lifted one. Both ends of the strip answer — the leading
    // edge, then the last row.
    const laid: Box[] = [
      { left: 0, right: 40, top: 0, bottom: 40 },
      { left: 0, right: 40, top: 40, bottom: 80 },
      { left: 0, right: 40, top: 80, bottom: 120 },
    ];
    const widened: Box = { left: -8, right: 48, top: 40, bottom: 80 };
    const items = boxes(laid);
    const { handle, drops } = harness("y", items);

    press(handle, items, 1, { x: 20, y: 60 });
    reshape(items[1], widened);
    move(44, 5);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "5 is before every row's midpoint").toBe(0);
    up(44, 5);
    expect(drops).toEqual([[1, 0]]);

    // …and 140 is past the last row's midpoint of 100. The release dropped
    // the lift, so the next press reads the row's layout box again.
    reshape(items[1], laid[1]);
    press(handle, items, 1, { x: 20, y: 60 });
    reshape(items[1], widened);
    move(44, 140);
    expect(handle.dragOver.value).toBe(2);
    up(44, 140);
    expect(drops).toEqual([
      [1, 0],
      [1, 2],
    ]);
  });

  it("resolves the no-drag path (from = -1) exactly as it always did", () => {
    // `from = -1` is the call with no drag in flight: nothing is the item
    // being dragged, so no origin geometry is in play and every item is
    // measured by its own live rect — the widened band therefore still owns
    // the line on its own, which is the value the strip resolved before the
    // dragged item was ever read any other way (the same gesture with
    // `from = 1` answers 0 instead — see the panel-rows test, whose press
    // happens before its row is widened).
    const items = boxes([
      { left: 0, right: 40, top: 0, bottom: 40 },
      { left: -8, right: 48, top: 40, bottom: 80 },
      { left: 0, right: 40, top: 80, bottom: 120 },
    ]);
    const rects = items.map((item) => item.getBoundingClientRect());

    expect(indexAt(rects, "y", 5, 44, -1), "the widened row still owns the line").toBe(1);
    // …and the geometry the fix never touched: the ends, and an empty strip.
    expect(indexAt(rects, "y", 5000, 20, -1), "past every midpoint").toBe(3);
    expect(indexAt(rects, "y", -5, 20, -1), "before every midpoint").toBe(0);
    expect(indexAt([], "x", 0, 0, -1), "an empty strip has no slot").toBe(-1);

    // The user-visible half of the same invariant: with no gesture at all, a
    // pointer move resolves nothing and publishes nothing.
    const { handle, drops } = harness("y", items);
    move(44, 5);
    expect(handle.dragOver.value).toBe(-1);
    expect(handle.dragFrom.value).toBe(-1);
    expect(drops).toEqual([]);
  });

  it("keeps the classic answer when the lines' bands overlap and nothing is transformed", () => {
    // Chips of different heights on one wrapping row (align-items:
    // flex-start) give the lines bands that OVERLAP rather than nest. The
    // dragged chip (index 0) is the tallest, so a pointer pulled below the
    // strip is nearest ITS band and the classic answer is its own slot —
    // while the removed wave-5 heuristic, scoring the line off the siblings
    // alone, raised the nearest gap to the shorter chips', pulled them into
    // the walk and answered slot 1: a reorder out of a drag that resolves to
    // its own slot, with nothing transformed anywhere.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 60 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ]);
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10, y: 20 });
    move(200, 80);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "no sibling's line is as near the pointer as its own").toBe(0);
    up(200, 80);
    expect(drops, "a drag resolving to its own slot emits nothing").toEqual([]);
  });

  it("lets the dragged item speak for a line no sibling shares", () => {
    // A chip wrapped onto a line of its own (index 2) while it is dragged:
    // no sibling is on that line, so the band the chip was LAID OUT on IS
    // the line the pointer is on — which is why the resolution needs no
    // special case for the dragged item at all — and a drag within it stays
    // the no-op it always was. Reading the line off the siblings only would
    // let the nearest OTHER line — a full row above — answer, and a 90px
    // drag along its own line would jump the chip up into it.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 0, right: 60, top: 40, bottom: 80 },
    ]);
    const { handle, drops } = harness("x", items);

    press(handle, items, 2, { x: 5, y: 60 });
    move(100, 60);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "the pointer is still on the chip's own line").toBe(2);
    up(100, 60);
    expect(drops).toEqual([]);
  });

  it("answers an edge-anchored cross-axis scale on a lone item as if it were not there", () => {
    // The corner wave 5 recorded as unfixable-by-heuristic: a chip wrapped
    // onto a line of its own, lifted 2.4x about its BOTTOM edge. The band
    // grows 96px UP over the whole row above, so the band's CENTRE (32)
    // lands inside that row's band (0-40) — the wave-5 centre test read the
    // chip as sharing a line, left its exclusion inert, and the pointer on
    // the chip's own line was answered from the row above (0 or 1 where the
    // chip's own line answers 2). The band the press read is the chip's own
    // line, whatever the lift does to the band afterwards.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 0, right: 60, top: 40, bottom: 80 },
    ];
    // 2.4x about the bottom-left corner: {0, 144, -16, 80}.
    const lift = scaled(laid[2], 2.4, "left", "bottom");
    expect(lift, "the lift covers the row above and the chip's own line").toEqual({
      left: 0,
      right: 144,
      top: -16,
      bottom: 80,
    });
    const cases = [
      { point: { x: 30, y: 60 }, slot: 2 },
      { point: { x: 100, y: 60 }, slot: 2 },
      { point: { x: 30, y: 20 }, slot: 0 },
      { point: { x: 100, y: 20 }, slot: 1 },
    ];
    for (const { point, slot } of cases) {
      const oracle = gesture("x", boxes(laid), 2, { x: 5, y: 60 }, [point]);
      const lifted = gesture("x", boxes(laid), 2, { x: 5, y: 60 }, [point], { index: 2, box: lift });
      expect(oracle.over, `the unlifted chip answers ${slot} at ${JSON.stringify(point)}`).toEqual([slot]);
      expect(
        lifted.over,
        `lifted, ${JSON.stringify(point)} answers exactly as if it were not transformed`,
      ).toEqual(oracle.over);
      expect(lifted.drops).toEqual(oracle.drops);
    }
  });

  it("answers an edge-anchored scale onto a neighbour's line as if it were not there", () => {
    // The other recorded corner: the dragged chip (index 1) shares the first
    // line, and a 2.03x scale about its TOP edge grows its band over the
    // whole second line — 2.03 is where that band is deep enough for its
    // centre (40.6) to reach into the second line's band (40-80), the
    // "shared" reading that left the chip's own live geometry deciding. A
    // pointer on the second line has to land on the row under it.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
      { left: 0, right: 100, top: 40, bottom: 80 },
      { left: 100, right: 200, top: 40, bottom: 80 },
    ];
    // 2.03x about the top-left corner: {100, 303, 0, 81.2}.
    const lift = scaled(laid[1], 2.03, "left", "top");
    expect(lift.bottom, "the band reaches into the second line").toBeGreaterThan(80);
    const cases = [
      { point: { x: 160, y: 60 }, slot: 4 },
      { point: { x: 100, y: 60 }, slot: 3 },
      { point: { x: 150, y: 20 }, slot: 1 },
      { point: { x: 260, y: 20 }, slot: 2 },
    ];
    for (const { point, slot } of cases) {
      const oracle = gesture("x", boxes(laid), 1, { x: 110, y: 20 }, [point]);
      const lifted = gesture("x", boxes(laid), 1, { x: 110, y: 20 }, [point], { index: 1, box: lift });
      expect(oracle.over, `the unlifted chip answers ${slot} at ${JSON.stringify(point)}`).toEqual([slot]);
      expect(
        lifted.over,
        `lifted, ${JSON.stringify(point)} answers exactly as if it were not transformed`,
      ).toEqual(oracle.over);
      expect(lifted.drops).toEqual(oracle.drops);
    }
  });

  it("measures the dragged item's laid-out midpoint, not the one its lift moved", () => {
    // A lift anchored on the chip's LEADING edge — `transform-origin: left`
    // on a scale along the drag axis, the growth reading as the chip still
    // held where it was picked up — carries the chip's live midpoint 110px
    // right of the one it was laid out with (150 -> 260). The walk measures
    // the laid-out midpoint: a pointer 5px past item 2's midpoint lands on
    // item 2, however far the lift stretched item 1 past it.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    // scaleX(3.2) about the leading edge: 100 -> 420, midpoint 260.
    const lift: Box = { left: 100, right: 420, top: 0, bottom: 40 };
    const cases = [
      { point: { x: 255, y: 20 }, slot: 2 },
      { point: { x: 280, y: 20 }, slot: 2 },
      { point: { x: 210, y: 20 }, slot: 1 },
    ];
    for (const { point, slot } of cases) {
      const oracle = gesture("x", boxes(laid), 1, { x: 150, y: 20 }, [point]);
      const lifted = gesture("x", boxes(laid), 1, { x: 150, y: 20 }, [point], { index: 1, box: lift });
      expect(oracle.over, `the unstretched chip answers ${slot} at ${JSON.stringify(point)}`).toEqual([slot]);
      expect(
        lifted.over,
        `stretched, ${JSON.stringify(point)} answers exactly as if it were not`,
      ).toEqual(oracle.over);
      expect(lifted.drops).toEqual(oracle.drops);
    }
  });

  it("keeps the pressed item's geometry on the content when the surface scrolls", () => {
    // A host scrolling its own surface under a live drag — this composable's
    // auto-scroll is not the only thing that moves the strip. The geometry
    // the press read travels with the content along the strip, so the slot
    // follows it: the same gesture aimed at the same CONTENT point without
    // the scroll is the answer to match, and both are pinned below.
    const { container, items } = scrollStrip("y", 6, 40, 200);
    const { handle, drops } = harness("y", items, undefined, () => container);

    press(handle, items, 2, { x: 20, y: 90 });
    container.scrollTop = 80; // the host scrolls the surface
    move(20, 60); // …with the pointer held where it is
    expect(handle.dragOver.value, "the slot follows the content the scroll moved").toBe(3);
    up(20, 60);
    expect(drops).toEqual([[2, 3]]);

    // The oracle: one strip, no scroll, the pointer on the same content
    // point (80px further down the strip — what the scroll moved).
    const plain = gesture("y", scrollStrip("y", 6, 40, 200).items, 2, { x: 20, y: 90 }, [
      { x: 20, y: 140 },
    ]);
    expect(plain.over).toEqual([3]);
    expect(plain.drops).toEqual(drops);
  });

  it("keeps the pressed item's band on the content when the surface scrolls across it", () => {
    // The band is the cross-axis half of the same geometry, so a surface
    // that scrolls ACROSS the strip (a wide wrapper around a column of rows)
    // carries it too. With the content 30px to the left the pointer sits past
    // the whole strip, so every band is equally far from it and the rows
    // resolve the slot by their midpoints; a snapshot left at the
    // press-time coordinates would be the band NEAREST the pointer instead,
    // the pressed row would own the line on its own, and the drag would
    // answer its own index.
    const { container, items } = scrollStrip("y", 3, 40, 200);
    const { handle, drops } = harness("y", items, undefined, () => container);

    press(handle, items, 1, { x: 20, y: 60 });
    container.scrollLeft = 30;
    move(44, 100);
    expect(handle.dragOver.value, "the band moved with the content, so the rows decide").toBe(2);
    up(44, 100);
    expect(drops).toEqual([[1, 2]]);

    // The oracle: the same content point (30px further right — what the
    // scroll moved) on a strip that never scrolled.
    const plain = gesture("y", scrollStrip("y", 3, 40, 200).items, 1, { x: 20, y: 60 }, [
      { x: 74, y: 100 },
    ]);
    expect(plain.over).toEqual([2]);
    expect(plain.drops).toEqual(drops);
  });

  it("swallows the click of a drag it had to abandon", () => {
    // An abandoned drag was still a drag: the pointer travelled past the
    // threshold, so the click the browser delivers at wherever it came to
    // rest is one the user never made. Left unswallowed it reaches the row
    // under the pointer and toggles a tag the user did not press.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ]);
    const { handle, drops } = harness("x", items);
    const inner = document.createElement("span");
    items[0].appendChild(inner);
    const clicks: string[] = [];
    inner.addEventListener("click", () => clicks.push("row"));

    press(handle, items, 0, { x: 10, y: 20 });
    move(150, 20);
    items.shift(); // the strip drops the very chip the pointer is holding
    move(260, 20);
    up(260, 20);
    expect(drops).toEqual([]);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks, "the abandoned drag swallowed its trailing click").toEqual([]);

    // …and only that one: the next real click is delivered again.
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toEqual(["row"]);
  });

  it("follows the element it grabbed when the strip reorders under it", () => {
    // The caller hands its items over in DISPLAY order, and the index a drag
    // landed at is only the way the resolution names the element. A strip
    // that reorders mid-gesture — a host edit from outside, a row toggled by
    // a second pointer, a chip's ×, an Enter, a query that filters rows out —
    // moves the elements under those indices, and the drag has to follow the
    // ELEMENT: resolving the press-time index would move whichever item slid
    // into it, and giving way would throw away a gesture the user is still
    // holding.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ]);
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10, y: 20 });
    move(150, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "150 is past the first chip's midpoint").toBe(1);

    // The host moves the LAST chip to the front: the strip is now
    // [C, A, B], so the chip the pointer grabbed sits at index 1.
    const [grabbed, middle, last] = items;
    const moved = [last, grabbed, middle];
    moved.forEach((el, i) => reshape(el, { left: i * 100, right: i * 100 + 100, top: 0, bottom: 40 }));
    items.splice(0, items.length, ...moved);
    move(260, 20);
    expect(handle.dragging.value, "the drag is still the one the pointer started").toBe(true);
    expect(handle.dragFrom.value, "the lift follows the chip it grabbed").toBe(1);
    expect(handle.dragOver.value, "260 is past the second chip's midpoint of 250").toBe(2);
    up(260, 20);
    expect(drops, "the drop is reported in the indices the strip has now").toEqual([[1, 2]]);
  });

  it("resolves against where the strip has RE-LAID the held item out", () => {
    // A font, a zoom or an insertion around the strip re-lays it out under a
    // live drag, so the item the pointer is holding is no longer where the
    // press found it. The snapshot describes the old place; the layout
    // numbers describe the new one, and the resolution has to follow the
    // strip the user is looking at. The chips here shrink mid-drag, which
    // brings the held chip's midpoint back behind the pointer: the walk that
    // the press-time midpoint stopped short of now runs past the strip.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const strip = laidStrip(laid, { left: 0, top: 0, w: 300, h: 40 }, { left: 0, right: 300, top: 0, bottom: 40 });
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 1, { x: 150, y: 20 });
    move(140, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "the press-time midpoint is still ahead of the pointer").toBe(1);

    // The strip is re-laid out under the drag: every chip, the held one
    // included, is drawn at its new place.
    strip.relayout([
      { left: 0, right: 50, top: 0, bottom: 40 },
      { left: 50, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 150, top: 0, bottom: 40 },
    ]);
    move(140, 20);
    expect(handle.dragOver.value, "the pointer is past every chip of the new strip").toBe(2);
    up(140, 20);
    expect(drops).toEqual([[1, 2]]);
  });

  it("ignores a transform painted on the held item while it follows the layout", () => {
    // The whole reason the snapshot exists: a transform on the item — the
    // drag's own lift, a host animation, a zoomed wrapper — is painted, not
    // laid out, and must not move the line or the midpoint the resolution
    // reads. The layout numbers are blind to it, so following the layout
    // costs nothing here: the same gesture resolves the same way with the
    // held chip drawn twice as large and shifted.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const strip = laidStrip(laid, { left: 0, top: 0, w: 300, h: 40 }, { left: 0, right: 300, top: 0, bottom: 40 });
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 0, { x: 10, y: 20 });
    move(150, 20);
    expect(handle.dragOver.value).toBe(1);

    // A host transform lands on the held chip: an edge-anchored cross-axis
    // scale, plus a hard translation that carries its drawn box onto the line
    // below and its drawn midpoint far past where it is laid out — the class
    // of transform an earlier wave recorded as unfixable while the drawn box
    // was what got measured. The pointer sits inside the moved band (where
    // measuring the drawn box makes the held chip the only candidate line, so
    // the walk stops on its own translated midpoint) and past the second
    // chip's midpoint, which is where the layout answers "land after the
    // second chip".
    reshape(strip.items[0], { left: 100, right: 300, top: 40, bottom: 96 });
    move(180, 45);
    expect(handle.dragOver.value, "180 is past the second chip's midpoint of 150").toBe(1);
    up(180, 45);
    expect(drops).toEqual([[0, 1]]);
  });

  it("carries the derived geometry through a frame that scrolls", () => {
    // The derivation reads a LAYOUT position and maps it through the box the
    // frame is drawn in, so the frame's own scroll (which slides the content
    // inside that box) has to be taken off in the same units. The strip is
    // scrolled mid-drag; the pointer stays where it is, over a different
    // chip of the content.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
      { left: 300, right: 400, top: 0, bottom: 40 },
    ];
    const scene = { scale: 1, scroll: 0 };
    const strip = laidStrip(
      laid,
      { left: 0, top: 0, w: 400, h: 40 },
      { left: 0, right: 400, top: 0, bottom: 40 },
      scene,
    );
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 0, { x: 10, y: 20 });
    move(40, 20);
    expect(handle.dragOver.value, "40 is still short of the first chip's midpoint of 50").toBe(0);

    scene.scroll = 120; // the frame scrolls the strip under the drag
    strip.relayout(laid); // re-pin the drawn boxes at the new scroll
    move(40, 20);
    expect(handle.dragOver.value, "the chips moved back under the pointer with the content").toBe(1);
    up(40, 20);
    expect(drops).toEqual([[0, 1]]);
  });

  it("reads the frame's border the way the frame hands its layout numbers over", () => {
    // The items' layout numbers are measured from their offsetParent's
    // PADDING edge — so when the frame is that offsetParent its border has to
    // be added back, and when the frame is `position: static` (nobody's
    // offsetParent) the same numbers are already measured from its BORDER
    // edge and adding it again would count it twice. Both shapes here are
    // laid out identically and drawn identically: the resolution has to
    // answer the same for both, and it has to keep the border's own scale.
    const layout: Box[] = [
      { left: 20, right: 60, top: 20, bottom: 60 },
      { left: 80, right: 120, top: 20, bottom: 60 },
      { left: 140, right: 180, top: 20, bottom: 60 },
      { left: 200, right: 240, top: 20, bottom: 60 },
    ];
    const frameLayout = { left: 0, top: 0, w: 260, h: 80 };
    const frameDrawn: Box = { left: 0, right: 260, top: 0, bottom: 80 };
    const border = { left: 20, top: 20 };
    for (const staticFrame of [false, true]) {
      const strip = laidStrip(layout, frameLayout, frameDrawn, { border, staticFrame });
      const { handle, drops } = harness("x", strip.items);
      press(handle, strip.items, 0, { x: 30, y: 35 });
      move(102, 62);
      expect(handle.dragging.value, `staticFrame=${staticFrame}`).toBe(true);
      expect(handle.dragOver.value, `staticFrame=${staticFrame} lands after the first chip`).toBe(1);
      up(102, 62);
      expect(drops, `staticFrame=${staticFrame}`).toEqual([[0, 1]]);
    }
  });

  it("resolves exactly as the held item's own drawn box says, across frame shapes", () => {
    // The differential form of the test above: for every shape a frame can
    // have — positioned or static, with or without a border, drawn at its own
    // size or scaled, scrolled or not, one line or two — the resolution has
    // to answer what the held item's TRUE layout box answers. The sweep walks
    // the pointer over each strip and compares against `indexAt` handed that
    // true box, so any place the derived geometry drifts shows up wherever
    // the drift can be observed, without hand-picking pointers.
    const single: Box[] = [
      { left: 12, right: 52, top: 12, bottom: 52 },
      { left: 72, right: 112, top: 12, bottom: 52 },
      { left: 132, right: 172, top: 12, bottom: 52 },
    ];
    const wrapped: Box[] = [
      { left: 12, right: 52, top: 12, bottom: 52 },
      { left: 72, right: 112, top: 12, bottom: 52 },
      { left: 12, right: 52, top: 72, bottom: 112 },
    ];
    const scenes = [
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 0, right: 200, top: 0, bottom: 70 }, scene: {} },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 5, right: 235, top: 7, bottom: 112 }, scene: { scale: 1.5 } },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 5, right: 235, top: 7, bottom: 112 }, scene: { scale: 1.5, border: { left: 12, top: 12 } } },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 5, right: 235, top: 7, bottom: 112 }, scene: { scale: 1.5, border: { left: 12, top: 12 }, staticFrame: true } },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 0, right: 200, top: 0, bottom: 70 }, scene: { border: { left: 12, top: 12 } } },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 0, right: 200, top: 0, bottom: 70 }, scene: { border: { left: 12, top: 12 }, staticFrame: true } },
      { layout: single, frame: { left: 0, top: 0, w: 200, h: 70 }, drawn: { left: 0, right: 200, top: 0, bottom: 70 }, scene: { scroll: 25 } },
      { layout: wrapped, frame: { left: 0, top: 0, w: 200, h: 130 }, drawn: { left: 0, right: 200, top: 0, bottom: 130 }, scene: {} },
      { layout: wrapped, frame: { left: 0, top: 0, w: 200, h: 130 }, drawn: { left: 0, right: 300, top: 0, bottom: 195 }, scene: { scale: 1.5, border: { left: 8, top: 8 } } },
    ];
    let compared = 0;
    for (const [index, entry] of scenes.entries()) {
      const strip = laidStrip(entry.layout, entry.frame, entry.drawn, entry.scene);
      const rects = strip.items.map((el) => el.getBoundingClientRect());
      // The line filter's tolerance is half a pixel wide, so the sweep has to
      // land ON the band edges, not only near them.
      const crosses = new Set<number>();
      for (let cross = -10; cross <= 140; cross += 5) crosses.add(cross);
      for (const rect of rects) {
        for (const edge of [rect.top, rect.bottom]) {
          for (const delta of [-2, -1, -0.5, 0, 0.5, 1, 2]) crosses.add(Number((edge + delta).toFixed(2)));
        }
      }
      for (let from = 0; from < strip.items.length; from += 1) {
        // The held item's own layout box, drawn — the geometry the resolution
        // is supposed to be reading.
        const truth = strip.items[from].getBoundingClientRect();
        const trueOrigin = {
          band: { lo: truth.top, hi: truth.bottom },
          mid: truth.left + truth.width / 2,
        };
        for (let main = -20; main <= 240; main += 20) {
          for (const cross of crosses) {
            const { handle } = harness("x", strip.items);
            press(handle, strip.items, from, { x: main - 40, y: cross });
            move(main, cross);
            const got = handle.dragOver.value;
            const want = indexAt(rects, "x", main, cross, from, trueOrigin);
            expect(got, `scene ${index} from ${from} at (${main}, ${cross})`).toBe(want);
            up(main, cross);
            compared += 1;
          }
        }
      }
    }
    expect(compared, "the sweep really ran").toBeGreaterThan(1000);
  }, 20_000);

  it("keeps the carried snapshot when only half of the box can be read", () => {
    // A box that reports one side and not the other cannot place anything: a
    // zero width would put the midpoint on the item's own edge. The gesture
    // here is one the derivation WOULD answer differently — the strip is
    // re-laid out under the drag — so the assertion is the carried
    // snapshot's answer, which is what a strip with no layout numbers at all
    // gets.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const strip = laidStrip(laid, { left: 0, top: 0, w: 300, h: 40 }, {
      left: 0,
      right: 300,
      top: 0,
      bottom: 40,
    });
    Object.defineProperty(strip.items[1], "offsetWidth", { configurable: true, get: () => 0 });
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 1, { x: 150, y: 20 });
    move(140, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "the press-time midpoint still stops the walk").toBe(1);

    strip.relayout([
      { left: 0, right: 50, top: 0, bottom: 40 },
      { left: 50, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 150, top: 0, bottom: 40 },
    ]);
    move(140, 20);
    expect(handle.dragOver.value, "half a box is no box: the snapshot still resolves").toBe(1);
    up(140, 20);
    expect(drops).toEqual([]);
  });

  it("keeps the carried snapshot when the layout chain cannot be added up", () => {
    // A chain that runs through something with no offsets of its own — an
    // element inside `<svg>` reports no `offsetLeft` at all — sums to NaN,
    // and a NaN origin answers every comparison the same way: it would place
    // the item at the end of the strip. The chain is checked, and the gesture
    // falls back to the snapshot.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const strip = laidStrip(laid, { left: 0, top: 0, w: 300, h: 40 }, {
      left: 0,
      right: 300,
      top: 0,
      bottom: 40,
    });
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 1, { x: 150, y: 20 });
    move(140, 20);
    expect(handle.dragOver.value).toBe(1);

    // The held chip's chain now passes through an element with no offsets.
    const svgish = document.createElement("div");
    Object.defineProperty(svgish, "offsetLeft", { configurable: true, get: () => undefined });
    Object.defineProperty(svgish, "offsetTop", { configurable: true, get: () => undefined });
    Object.defineProperty(svgish, "offsetParent", {
      configurable: true,
      get: () => strip.frame,
    });
    Object.defineProperty(strip.items[1], "offsetParent", {
      configurable: true,
      get: () => svgish,
    });
    strip.relayout([
      { left: 0, right: 50, top: 0, bottom: 40 },
      { left: 50, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 150, top: 0, bottom: 40 },
    ]);
    move(140, 20);
    expect(handle.dragOver.value, "an unaddable chain keeps the snapshot's answer").toBe(1);
    up(140, 20);
    expect(drops).toEqual([]);
  });

  it("keeps the carried snapshot when the held item collapses", () => {
    // A held chip re-laid out to no height has no line to be on: its derived
    // band would be a point and the line filter would drop it, which is a
    // resolution the layout cannot justify. The fallback answers instead.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const strip = laidStrip(laid, { left: 0, top: 0, w: 300, h: 40 }, {
      left: 0,
      right: 300,
      top: 0,
      bottom: 40,
    });
    const { handle, drops } = harness("x", strip.items);

    press(handle, strip.items, 1, { x: 150, y: 20 });
    move(140, 20);
    expect(handle.dragOver.value).toBe(1);

    strip.relayout([
      { left: 0, right: 50, top: 0, bottom: 40 },
      { left: 50, right: 100, top: 20, bottom: 20 },
      { left: 100, right: 150, top: 0, bottom: 40 },
    ]);
    move(140, 20);
    // Each half comes from the freshest source that can place it: a chip
    // collapsed to no height has no line to read, so the line stays the one
    // the press found, while its position along the strip is read live.
    expect(handle.dragOver.value, "the position follows the layout").toBe(2);
    up(140, 20);
    expect(drops).toEqual([[1, 2]]);
  });

  it("ends the gesture the moment the strip empties", () => {
    // Nothing left to resolve against is the same answer as the element being
    // gone: the gesture is over then, not at the release — a drag left
    // "running" against an empty strip would keep publishing a slot it can no
    // longer read, and would not swallow the click it owes.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ]);
    const { handle, drops } = harness("x", items);
    const inner = document.createElement("span");
    items[0].appendChild(inner);
    const clicks: string[] = [];
    inner.addEventListener("click", () => clicks.push("row"));

    press(handle, items, 0, { x: 10, y: 20 });
    move(150, 20);
    expect(handle.dragging.value).toBe(true);

    items.splice(0, items.length); // every item goes at once
    move(260, 20);
    expect(handle.dragging.value, "the gesture ended with the strip").toBe(false);
    expect(handle.dragFrom.value).toBe(-1);
    expect(handle.dragOver.value).toBe(-1);
    up(260, 20);
    expect(drops).toEqual([]);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks, "…and its trailing click was swallowed").toEqual([]);
  });

  it("abandons a drag whose pressed item leaves the strip", () => {
    // The other side of the same rule: a strip that no longer carries the
    // element at all — it was removed, or a drag of it can no longer land
    // anywhere — has nothing for the gesture to move, so it ends without a
    // reorder.
    const items = boxes([
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ]);
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10, y: 20 });
    move(150, 20);
    expect(handle.dragOver.value).toBe(1);

    items.shift(); // the chip the pointer is holding is gone
    move(260, 20);
    expect(handle.dragging.value, "the drag ended with the strip").toBe(false);
    expect(handle.dragFrom.value).toBe(-1);
    expect(handle.dragOver.value).toBe(-1);
    up(260, 20);
    expect(drops, "nothing was dropped").toEqual([]);
  });

  it("carries the snapshot exactly through a frame that scrolls AND is scaled", () => {
    // The frame here is the scroller the strip SITS IN — the shape this
    // composable documents — and the host zooms it mid-drag while it is
    // scrolled. The frame's own scroll slides the content inside a box that
    // does not move, and it does so in the frame's LAYOUT units: taken off
    // the drawn box as a raw offset it is measured at the wrong magnitude
    // the moment the frame is scaled (by `(scale - 1) x scroll`, here 300px
    // on a 2x zoom), and the snapshot drifts off the item it belongs to. The
    // pointer here is past the third chip and before the fourth, so the
    // drifted snapshot answers "stay where you are" where the strip answers
    // "land after the fourth".
    const { items, scene } = scrollerStrip(5, 100, 40);
    const { handle, drops } = harness("x", items);

    press(handle, items, 2, { x: 250, y: 20 });
    scene.scale = 2; // the host zooms the strip…
    scene.scroll = 300; // …while it is scrolled under the live drag
    move(100, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "past the third chip, before the fourth").toBe(3);
    up(100, 20);
    expect(drops).toEqual([[2, 3]]);
  });

  it("reads a LAYOUT change as a layout change, not as a scale", () => {
    // The frame's own box growing is not the frame being drawn bigger: the
    // chips keep their place and their size, and the frame merely got wider
    // around them. A carrier that reads the drawn box alone cannot tell the
    // two apart, and would stretch the snapshot by the ratio of the two
    // sizes — here it would answer "stay where you are" for a pointer the
    // strip answers "land after the third chip".
    const { items, scene } = scrollerStrip(5, 100, 40);
    const { handle, drops } = harness("x", items);

    press(handle, items, 1, { x: 150, y: 20 });
    scene.laid = 1000; // the frame is re-laid out around the same chips
    move(260, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "260 is past the third chip's midpoint of 250").toBe(2);
    up(260, 20);
    expect(drops).toEqual([[1, 2]]);
  });

  it("carries the snapshot in the nearest frame that has a box", () => {
    // A strip wrapped in an element that generates no box of its own
    // (`display: contents`) is laid out by the next box up, and that is the
    // box its content moves with: reading the boxless wrapper leaves the
    // snapshot behind the moment the page scrolls the real frame.
    const frame = document.createElement("div");
    const wrapper = document.createElement("div");
    frame.appendChild(wrapper);
    document.body.appendChild(frame);
    const scene = { shift: 0 };
    reshape(frame, { left: 0, right: 300, top: 0, bottom: 40 });
    Object.defineProperty(frame, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const box = { left: 0, right: 300, top: scene.shift, bottom: scene.shift + 40 };
        return asRect(box);
      },
    });
    // The wrapper itself: no box at all, exactly as `display: contents` reports.
    reshape(wrapper, { left: 0, right: 0, top: 0, bottom: 0 });
    const items = [0, 100, 200].map((start) => {
      const el = document.createElement("div");
      Object.defineProperty(el, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          asRect({ left: start, right: start + 100, top: scene.shift, bottom: scene.shift + 40 }),
      });
      wrapper.appendChild(el);
      return el;
    });
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10, y: 20 });
    scene.shift = 40; // the page scrolls the strip a line up under the drag
    move(150, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "the chips kept their places inside the frame").toBe(1);
    up(150, 20);
    expect(drops).toEqual([[0, 1]]);
  });

  it("keeps the pressed item's geometry on the content when the frame is SCALED under it", () => {
    // A `scale()` or a zoom painted on the frame — or on an ancestor — during
    // a live drag is not a movement the frame's DISPLACEMENT can describe:
    // the frame's origin corner stays put while the content inside travels
    // toward it, so a snapshot shifted by the corner's movement alone stays
    // where the press left it while every sibling moves, and the closer the
    // pressed chip sat to that corner the smaller the error looks. The
    // snapshot travels with the frame's BOX instead — the same place inside
    // it — so the drag resolves exactly as it would have against a strip
    // laid out that way from the start: the pointer is past the whole
    // (shrunken) strip, and the chip lands last.
    const laid: Box[] = [
      { left: 0, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 200, top: 0, bottom: 40 },
      { left: 200, right: 300, top: 0, bottom: 40 },
    ];
    const { items, scale } = framedStrip(laid);
    const { handle, drops } = harness("x", items);

    press(handle, items, 1, { x: 150, y: 20 });
    move(150, 20);
    expect(handle.dragging.value, "a press that has not moved is not a drag").toBe(false);

    scale(0.5); // the host zooms the strip under the live drag
    move(130, 20);
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "130 is past the third chip's scaled midpoint of 125").toBe(2);
    up(130, 20);
    expect(drops).toEqual([[1, 2]]);

    // The oracle: the same gesture against a strip that was laid out that
    // way all along (a 50px chip row, the pointer past its end).
    const plain = gesture("x", boxes([
      { left: 0, right: 50, top: 0, bottom: 40 },
      { left: 50, right: 100, top: 0, bottom: 40 },
      { left: 100, right: 150, top: 0, bottom: 40 },
    ]), 1, { x: 75, y: 20 }, [{ x: 130, y: 20 }]);
    expect(plain.over).toEqual([2]);
    expect(plain.drops).toEqual(drops);
  });

  it("carries the pressed item's geometry with a frame an ancestor scrolls under it", () => {
    // The chip field owns no scroller of its own, so nothing about this
    // gesture is declared to the composable — while the page (or a modal
    // body) the field sits in scrolls a line under the live drag, moving the
    // chips and the frame they are laid out in together. A snapshot left in
    // the press-time viewport coordinates stops sharing a line with every
    // sibling, and because it is the ONE band that still holds the pointer,
    // the pressed chip owns the line on its own: every sibling drops out of
    // the filter and the drag collapses onto its own index — the silent
    // no-op this resolution exists to prevent. The frame it was read in is
    // what has to travel with it.
    const laid: Box[] = [
      { left: 0, right: 40, top: 0, bottom: 40 },
      { left: 40, right: 80, top: 0, bottom: 40 },
      { left: 80, right: 120, top: 0, bottom: 40 },
    ];
    const { items, shift } = framedStrip(laid);
    const { handle, drops } = harness("x", items);

    press(handle, items, 0, { x: 10, y: 20 });
    shift(0, 40); // the ancestor scrolls the whole strip a line down
    move(90, 20); // …with the pointer held where it was
    expect(handle.dragging.value).toBe(true);
    expect(handle.dragOver.value, "90 is past item 1's midpoint and before item 2's").toBe(1);
    up(90, 20);
    expect(drops).toEqual([[0, 1]]);

    // The oracle: the same gesture on a strip nothing moved under.
    const plain = gesture("x", framedStrip(laid).items, 0, { x: 10, y: 20 }, [{ x: 90, y: 20 }]);
    expect(plain.over).toEqual([1]);
    expect(plain.drops).toEqual(drops);
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
