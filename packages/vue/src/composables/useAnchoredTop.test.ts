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