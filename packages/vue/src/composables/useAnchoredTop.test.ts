import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import {
  needsAnchorCorrection,
  nextAnchorShift,
  useAnchoredTop,
} from "./useAnchoredTop";

/** happy-dom ships no layout engine: every rect reads zero. The hook is
 *  therefore tested through its PURE decision helpers (the arithmetic is
 *  the whole contract) plus mount/unmount safety probes. The browser-side
 *  behaviour — a centered box that grows downward instead of re-centring
 *  — is verified against a real engine in the PR's rig, not here. */
describe("nextAnchorShift", () => {
  it("cancels a centered reflow in one step", () => {
    // A card that grew by 54px in a vertically centered host moved its
    // top edge up by 27px; the correction paints it back down.
    expect(nextAnchorShift(0, 240, 267)).toBe(27);
  });

  it("is incremental, so a partial measurement still converges", () => {
    // Half the drift was corrected already: the next step adds the rest
    // instead of jumping by the full amount again.
    expect(nextAnchorShift(27, 250, 267)).toBe(44);
    // …and a correction that lands exactly leaves the shift alone.
    expect(nextAnchorShift(44, 267, 267)).toBe(44);
  });

  it("gives back exactly what a shrink needs", () => {
    // verify → back to account: the top edge crawled down, the shift
    // returns to 0 (the symmetric swap ends where it started).
    expect(nextAnchorShift(27, 294, 267)).toBe(0);
  });

  it("leaves a top-anchored layout untouched", () => {
    // No drift, no transform: the hook must be a no-op where the host
    // does not re-center (a top-aligned page, a modal body, …).
    expect(nextAnchorShift(0, 267, 267)).toBe(0);
  });
});

describe("needsAnchorCorrection", () => {
  it("ignores sub-pixel noise and 1px rounding", () => {
    expect(needsAnchorCorrection(267, 267)).toBe(false);
    expect(needsAnchorCorrection(267.4, 267)).toBe(false);
    expect(needsAnchorCorrection(266.6, 267)).toBe(false);
  });

  it("fires on a real drift", () => {
    expect(needsAnchorCorrection(266, 267)).toBe(true);
    expect(needsAnchorCorrection(240, 267)).toBe(true);
  });
});

describe("useAnchoredTop", () => {
  const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

  afterEach(() => {
    for (const { app, container } of mounts.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.restoreAllMocks();
  });

  function mountHook(enabled?: () => boolean) {
    const target = ref<HTMLElement | null>(null);
    const Host = defineComponent({
      setup() {
        useAnchoredTop(target, enabled ? { enabled } : {});
        return () => h("div", { ref: target, class: "probe" });
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    return { container, target };
  }

  it("mounts and unmounts cleanly without a layout engine", () => {
    // No ResizeObserver path, no rect: the hook must not throw, and it
    // must not write a transform on a block that never drifted (an
    // empty style keeps the element byte-identical to an unhooked one).
    const { container } = mountHook();
    const probe = container.querySelector(".probe") as HTMLElement;
    expect(probe).not.toBeNull();
    expect(probe.style.transform).toBe("");
  });

  it("writes nothing while the host reports no drift", () => {
    const { container } = mountHook();
    const probe = container.querySelector<HTMLElement>(".probe")!;
    // A zero rect is "no layout": measured top 0, anchor 0 → no drift.
    expect(probe.style.transform).toBe("");
  });

  it("survives a disabled gate and a detached target", async () => {
    const { container, target } = mountHook(() => false);
    target.value = null;
    await nextTick();
    expect(container.querySelector(".probe")).not.toBeNull();
  });
});
describe("useAnchoredTop — correction wiring (fake ResizeObserver)", () => {
  /** A controllable stand-in for the layout engine: the fake observer
   *  hands us its callback, and the target's rect is whatever we say it
   *  is. This is what makes the hook's DOM write testable without a
   *  browser (the arithmetic is covered above; THIS pins the wiring). */
  type FakeRO = {
    callback: () => void;
    targets: Element[];
    /** disconnect() calls; observe() legitimately disconnects first. */
    disconnects: number;
  };

  const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

  afterEach(() => {
    for (const { app, container } of mounts.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mountWithTop(top: { value: number }) {
    const fakes: FakeRO[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private readonly entry: FakeRO;
        constructor(callback: () => void) {
          this.entry = { callback, targets: [], disconnects: 0 };
          fakes.push(this.entry);
        }
        observe(el: Element) {
          this.entry.targets.push(el);
        }
        disconnect() {
          this.entry.disconnects += 1;
          this.entry.targets = [];
        }
        unobserve() {}
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      // A real engine reports the PAINTED box: the layout top plus the
      // element's own inline translate. Modelling that is what makes the
      // closed loop's convergence observable at all.
      const own = (this as HTMLElement).style?.transform ?? "";
      const shift = Number(/translateY\((-?[\d.]+)px\)/.exec(own)?.[1] ?? 0);
      const rendered = top.value + shift;
      return {
        top: rendered, left: 0, bottom: rendered, right: 0,
        width: 0, height: 0, x: 0, y: rendered, toJSON: () => ({}),
      } as DOMRect;
    });

    const target = ref<HTMLElement | null>(null);
    const Host = defineComponent({
      setup() {
        useAnchoredTop(target);
        return () => h("div", { ref: target, class: "probe" });
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    return {
      container,
      app,
      fake: fakes[0]!,
      probe: container.querySelector<HTMLElement>(".probe")!,
    };
  }

  it("paints the block back onto its resting top when the host re-centers it", () => {
    // The reported defect: a centered box grows and its top edge climbs.
    // Written as "the host moved the block 20px up", the hook must fold
    // exactly that into the shift.
    // MUT:anchor-wiring-noop (dropping the shift write in correct()
    // leaves the transform empty and this goes red).
    const top = { value: 100 };
    const { fake, probe } = mountWithTop(top);
    // The hook observed the element it was handed (a disconnect inside
    // observe() is the re-arm, not a teardown).
    expect(fake.targets).toContain(probe);
    expect(probe.style.transform).toBe("");

    top.value = 80; // a centered growth lifted the top by 20px
    fake.callback();
    expect(probe.style.transform).toBe("translateY(20px)");

    // Converged: the transform is part of the measured top, so the next
    // frame reads drift 0 and only re-bases (a loop that re-applied the
    // full drift would overshoot to 40px here).
    fake.callback();
    expect(probe.style.transform).toBe("translateY(20px)");

    // The symmetric leg comes back and the shift returns to zero, i.e.
    // the transform is REMOVED rather than left at a stale offset.
    top.value = 100;
    fake.callback();
    expect(probe.style.transform).toBe("");
  });

  it("is a no-op where the host does not re-center", () => {
    const top = { value: 100 };
    const { fake, probe } = mountWithTop(top);
    // A top-anchored layout: size changes, the top never moves.
    fake.callback();
    fake.callback();
    expect(probe.style.transform).toBe("");
  });

  it("stops observing after unmount", () => {
    const top = { value: 100 };
    const { app, fake, container, probe } = mountWithTop(top);
    expect(fake.targets).toContain(probe);
    app.unmount();
    container.remove();
    expect(fake.targets).toHaveLength(0);
  });
});
