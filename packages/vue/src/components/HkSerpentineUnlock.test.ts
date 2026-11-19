import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

type FrameCb = (ctx: { delta: number; elapsed: number; now: number }) => void;

const frameBus = vi.hoisted(() => {
  const cbs = new Map<string, FrameCb>();
  let seq = 0;
  return {
    onFrame: vi.fn((cb: FrameCb) => {
      const id = `f${seq++}`;
      cbs.set(id, cb);
      return { disconnect: vi.fn(() => cbs.delete(id)) };
    }),
    reportTransition: vi.fn(() => ({ disconnect: vi.fn() })),
    /** Run one scheduled frame with a fixed delta. */
    tick: (delta = 16) => {
      for (const cb of [...cbs.values()]) {
        cb({ delta, elapsed: delta, now: Date.now() });
      }
    },
    activeCount: () => cbs.size,
  };
});

vi.mock("../runtime/animationBus", () => ({
  onFrame: frameBus.onFrame,
  reportTransition: frameBus.reportTransition,
}));

import HkSerpentineUnlock from "./HkSerpentineUnlock";
import { generateSerpentinePath, projectOntoPath } from "./serpentineGeometry";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

const confirmSpy = vi.fn();
const cancelSpy = vi.fn();
const failSpy = vi.fn();

/** Mount one gate with a deterministic 600×96 lane. */
function mountGate(props: Record<string, unknown> = {}) {
  confirmSpy.mockClear();
  cancelSpy.mockClear();
  failSpy.mockClear();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Harness = defineComponent({
    setup() {
      return () =>
        h(HkSerpentineUnlock, {
          label: "Delete workspace",
          grabHint: "grab hint",
          trackingHint: "keep going",
          seed: 42,
          onConfirm: () => confirmSpy(),
          onCancel: (p: number) => cancelSpy(p),
          onFail: (r: string) => failSpy(r),
          ...props,
        });
    },
  });
  const app = createApp(Harness);
  app.mount(container);
  mounts.push({ app, container });
  return container.querySelector<HTMLElement>(".hk-serpentine")!;
}

function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
    }),
  );
}

beforeEach(() => {
  frameBus.onFrame.mockClear();
  frameBus.reportTransition.mockClear();
});

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkSerpentineUnlock (mounted)", () => {
  it("renders lane, travelled overlay, handle and grab hint", () => {
    const el = mountGate();
    expect(el.querySelector(".hk-serpentine-lane")).toBeTruthy();
    expect(el.querySelector(".hk-serpentine-travelled")).toBeTruthy();
    expect(el.querySelector(".hk-serpentine-handle")).toBeTruthy();
    expect(el.textContent).toContain("grab hint");
  });

  it("requires a full walk: releasing mid-lane cancels without confirming", () => {
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const half = projectOntoPath(path.points, path.totalLength / 2);
    pointer(el, "pointermove", half.x, half.y);
    pointer(el, "pointerup", half.x, half.y);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalledWith(expect.closeTo(0.5, 1));
  });

  it("confirms exactly once when the walk completes at the goal", () => {
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    for (let d = 6; d <= path.totalLength + 4; d += 6) {
      const at = projectOntoPath(path.points, d);
      pointer(el, "pointermove", at.x, at.y);
    }
    pointer(el, "pointerup", 600, 48);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("fails off-lane and starts the spring", () => {
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    // Grab at the start, walk onto the lane, then veer FAR off it (the
    // grab check anchors at the lane start — mid-lane grabs are refused).
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const mid = projectOntoPath(path.points, path.totalLength / 2);
    pointer(el, "pointermove", mid.x, mid.y);
    pointer(el, "pointermove", mid.x + 30, 95);
    expect(failSpy).toHaveBeenCalledWith("off-path");
    // The snap-back spring runs on the shared frame bus.
    expect(frameBus.onFrame).toHaveBeenCalled();
    expect(frameBus.reportTransition).toHaveBeenCalled();
    frameBus.tick(16);
    frameBus.tick(16);
  });

  it("does not grab when disabled", () => {
    const el = mountGate({ disabled: true });
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    pointer(el, "pointermove", start.x + 40, start.y);
    pointer(el, "pointerup", start.x + 40, start.y);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("cleans up its frame handle on unmount", async () => {
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    pointer(el, "pointermove", start.x + 60, start.y);
    pointer(el, "pointerup", start.x + 60, start.y);
    expect(frameBus.activeCount()).toBeGreaterThan(0);
    const { app, container } = mounts[mounts.length - 1]!;
    app.unmount();
    container.remove();
    mounts.length = 0;
    expect(frameBus.activeCount()).toBe(0);
  });
});

describe("HkSerpentineUnlock styles contract", () => {
  const scss = readFileSync(resolve(__dirname, "./HkSerpentineUnlock.scss"), "utf-8");

  it("paints only channels the theme emits (no phantom tokens)", () => {
    // A var() whose name no theme emits computes to nothing and the paint
    // silently disappears (the chest palette incident class).
    for (const m of scss.matchAll(/--color-[a-z0-9-]+/g)) {
      expect(["--color-surface", "--color-info", "--color-error", "--color-success", "--color-muted"]).toContain(m[0]);
    }
  });

  it("honours reduced motion: no shake, static outline instead", () => {
    expect(scss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(scss).toContain("animation: none;");
    expect(scss).toContain("outline: 2px solid");
  });

  it("uses real motion tokens, not invented ones", () => {
    expect(scss).toContain("--ease-standard");
    expect(scss).not.toContain("--hk-motion-ease");
  });
});
