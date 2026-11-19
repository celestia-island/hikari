import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

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

  it("holds position when the pointer drifts off-lane (no reset)", () => {
    // Device feedback: an 18px corridor reset the walk on every wobble.
    // Now a drifting pointer HOLDS the knob (no fail, no spring); the walk
    // resumes when the pointer comes back, and only the release decides.
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const mid = projectOntoPath(path.points, path.totalLength / 2);
    pointer(el, "pointermove", mid.x, mid.y);
    pointer(el, "pointermove", mid.x + 30, 95); // far off-lane
    pointer(el, "pointermove", mid.x, mid.y); // back on the lane
    pointer(el, "pointerup", mid.x, mid.y);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalledWith(expect.closeTo(0.5, 1));
  });

  it("stops a running spring when the handle is re-grabbed", async () => {
    // Drag, release mid-lane (the spring starts), then put the pointer back
    // on the resting handle and grab: the spring must be disconnected
    // IMMEDIATELY — no frame handle may survive, and ticking frames must
    // not move the handle afterwards (the old spring writing progress is
    // the R2-flagged fight).
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const mid = projectOntoPath(path.points, path.totalLength / 2);
    pointer(el, "pointermove", mid.x, mid.y);
    pointer(el, "pointerup", mid.x, mid.y);
    expect(frameBus.activeCount()).toBe(1); // the spring is running

    pointer(el, "pointerdown", start.x, start.y); // re-grab at rest
    expect(frameBus.activeCount()).toBe(0); // the spring died with the grab
    await nextTick();
    frameBus.tick(16);
    frameBus.tick(16);
    await nextTick();
    // The re-grab put the pointer at the padded start (TRACK_PAD); stale
    // spring frames must not have moved the handle (the old spring is
    // dead — this is the regression pin for the re-grab fight).
    expect((el.querySelector(".hk-serpentine-handle") as HTMLElement).style.left).toBe("24px");
  });

  it("announces twenty-percent bands (40% renders as forty, not worse)", async () => {
    // Walk to ~40%: the aria-live hint must read "(40%)" — the band
    // formula is round(v*5)*20; a 2x-off formula renders hundreds.
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const forty = projectOntoPath(path.points, path.totalLength * 0.4);
    pointer(el, "pointermove", forty.x, forty.y);
    await nextTick();
    const hint = (el.querySelector(".hk-serpentine-hint") as HTMLElement).textContent ?? "";
    expect(hint).toContain("(40%)");
  });

  it("zeroing paths reset the announcer (no stale percent)", async () => {
    // Walk to ~60%, release (spring), let the spring settle to zero via
    // ticks, then re-grab and walk to ~10%: the hint must read ten-or-less,
    // not carry the old 60% band (stopSpring resets the announcer).
    const el = mountGate();
    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const sixty = projectOntoPath(path.points, path.totalLength * 0.6);
    pointer(el, "pointermove", sixty.x, sixty.y);
    pointer(el, "pointerup", sixty.x, sixty.y);
    for (let i = 0; i < 40; i++) frameBus.tick(64); // spring settles
    await nextTick();
    pointer(el, "pointerdown", start.x, start.y);
    const ten = projectOntoPath(path.points, path.totalLength * 0.1);
    pointer(el, "pointermove", ten.x, ten.y);
    await nextTick();
    const hint = (el.querySelector(".hk-serpentine-hint") as HTMLElement).textContent ?? "";
    const pct = Number(hint.match(/\((\d+)%\)/)?.[1] ?? "0");
    expect(pct).toBeLessThanOrEqual(20);
  });

  it("resetKey mid-tracking resets the announcer with the progress", async () => {
    // Own harness: the resetKey prop must be reactive to bump mid-test.
    const resetKey = ref(0);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(HkSerpentineUnlock, {
            label: "Delete workspace",
            grabHint: "grab hint",
            trackingHint: "keep going",
            seed: 42,
            resetKey: resetKey.value,
          });
      },
    }));
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    const el = container.querySelector<HTMLElement>(".hk-serpentine")!;

    const path = generateSerpentinePath(600, 96, 42);
    const start = path.points[0]!;
    pointer(el, "pointerdown", start.x, start.y);
    const sixty = projectOntoPath(path.points, path.totalLength * 0.6);
    pointer(el, "pointermove", sixty.x, sixty.y);
    await nextTick();
    // 60% tracks: announced band sits at 60.
    const tracked = (el.querySelector(".hk-serpentine-hint") as HTMLElement).textContent ?? "";
    expect(tracked).toContain("60%");
    // Bump resetKey: progress zeroes AND the announcer goes with it — the
    // next walk must announce from zero, not carry the 60% band.
    resetKey.value += 1;
    await nextTick();
    pointer(el, "pointerdown", start.x, start.y);
    const ten = projectOntoPath(path.points, path.totalLength * 0.1);
    pointer(el, "pointermove", ten.x, ten.y);
    await nextTick();
    const hint = (el.querySelector(".hk-serpentine-hint") as HTMLElement).textContent ?? "";
    const pct = Number(hint.match(/\((\d+)%\)/)?.[1] ?? "0");
    expect(pct).toBeLessThanOrEqual(20);
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
    // silently disappears (the chest palette incident class). The emitted
    // set is DERIVED from the theme channel source, so a theme-side rename
    // cannot leave this test green while the paint dies.
    const channels = readFileSync(
      resolve(__dirname, "../styles/theme/channels.scss"),
      "utf-8",
    );
    const emitted = new Set(
      [...channels.matchAll(/--color-[a-z0-9-]+\s*:/g)].map((m) => m[0].replace(/\s*:$$/, "")),
    );
    expect(emitted.size).toBeGreaterThan(0); // the derivation itself works
    for (const m of scss.matchAll(/--color-[a-z0-9-]+/g)) {
      expect(emitted, `channel ${m[0]} is not emitted by the theme`).toContain(m[0]);
    }
  });

  it("keeps no displacement animation at all (the shake retired with the off-path fail)", () => {
    expect(scss).not.toContain("@keyframes");
    expect(scss).not.toContain("animation:");
  });

  it("puts the hint in flow (no absolute hang below the box)", () => {
    // Device feedback: the absolutely-positioned hint got clipped by the
    // confirmation window. The hint is a block in flow now.
    expect(scss).toContain("display: block;");
    expect(scss).not.toContain("position: absolute;\n  inset-inline: 0;");
  });

  it("uses real motion tokens, not invented ones", () => {
    // The shake retired with the off-path fail; the remaining motion
    // surface is the confirmed knob's transition, which uses the real
    // duration/ease tokens. The invented --hk-motion-ease must not return.
    expect(scss).toContain("--ease-standard");
    expect(scss).not.toContain("--hk-motion-ease");
    expect(scss).not.toContain("@keyframes");
    expect(scss).not.toContain("HkSerpentineUnlock.scss:13");
  });
});
