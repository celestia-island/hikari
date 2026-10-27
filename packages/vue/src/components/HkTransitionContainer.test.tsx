import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkTransitionContainer, { resolveEnterDelay } from "./HkTransitionContainer";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  animationLoopArmedCount,
  onAnimationFrame,
} from "../composables/useAnimationLoop";

/** Shared-container discipline (HkCrossfade.test precedent): every
 *  case appends its own container; afterEach tears them all down. */
const containers: HTMLElement[] = [];

interface Harness {
  app: App;
  container: HTMLElement;
  key: { value: string };
  swaps: Array<{ key: string | number; previous: string | number; durationMs: number }>;
}

function mountContainer(initial = "a"): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const key = ref(initial);
  const swaps: Harness["swaps"] = [];
  const Wrapper = defineComponent({
    setup() {
      return () => (
        <HkTransitionContainer
          swapKey={key.value}
          onSwap={(e: { key: string | number; previous: string | number; durationMs: number }) => {
            swaps.push(e);
          }}
        >
          <p>{`panel-${key.value}`}</p>
        </HkTransitionContainer>
      );
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  return { app, container, key, swaps };
}

afterEach(() => {
  for (const c of containers.splice(0)) c.remove();
});

describe("HkTransitionContainer", () => {
  it("renders the slot inside the morph host", () => {
    const t = mountContainer("a");
    const host = t.container.querySelector<HTMLElement>(".hk-tc");
    const stage = t.container.querySelector<HTMLElement>(".hk-tc-stage");
    expect(host).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(t.container.textContent).toContain("panel-a");
    t.app.unmount();
  });

  it("defaults to the 300ms family duration on the host transition", () => {
    const t = mountContainer("a");
    const host = t.container.querySelector<HTMLElement>(".hk-tc");
    expect(host?.style.transitionDuration).toBe(`${DEFAULT_ANIMATION_DURATION_MS}ms`);
    expect(DEFAULT_ANIMATION_DURATION_MS).toBe(300);
    t.app.unmount();
  });

  it("axis=width transitions only the width property", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      render: () => (
        <HkTransitionContainer swapKey="a" axis="width">
          <p>x</p>
        </HkTransitionContainer>
      ),
    });
    app.mount(container);
    const host = container.querySelector<HTMLElement>(".hk-tc");
    expect(host?.style.transitionProperty).toBe("width");
    app.unmount();
  });

  it("survives a swapKey change without ResizeObserver (degraded path, no NaN)", async () => {
    const t = mountContainer("login");
    t.key.value = "org";
    await new Promise((r) => setTimeout(r, DEFAULT_ANIMATION_DURATION_MS + 120));
    // jsdom has no ResizeObserver and zero offsets: no morph, no crash,
    // and any pinned inline size is well-formed (never NaNpx).
    const host = t.container.querySelector<HTMLElement>(".hk-tc");
    expect(host?.style.width).not.toContain("NaN");
    expect(host?.style.height).not.toContain("NaN");
    t.app.unmount();
  });

  it("sets the enter-delay custom property on every swap (degraded env reads 'same box')", async () => {
    // No layout here: the incoming measurement returns null, which the
    // choreography decision treats as "same box" — the property must
    // still be SET (the wiring runs on every swap), reading 0ms so the
    // plain dissolve is preserved.
    const t = mountContainer("login");
    t.key.value = "org";
    await nextTick();
    await nextTick();
    const host = t.container.querySelector<HTMLElement>(".hk-tc");
    expect(host?.style.getPropertyValue("--hk-crossfade-enter-delay")).toBe("0ms");
    t.app.unmount();
  });

  it("survives hostile swapKeys (quotes) — dataset matching, no selector interpolation", async () => {
    // A key is an opaque identity and may contain quotes; interpolating it
    // into an attribute selector used to throw inside the post-flush
    // callback and kill the whole choreography wiring for the swap (stale
    // var, dead observer, unhandled rejection — R2 2026-10-27 S1).
    const t = mountContainer('a"b');
    t.key.value = 'c"d\\e';
    await nextTick();
    await nextTick();
    // No throw above; the property is still written (no-layout → "same
    // box" → 0ms), proving the decision wiring ran to completion.
    const host = t.container.querySelector<HTMLElement>(".hk-tc");
    expect(host?.style.getPropertyValue("--hk-crossfade-enter-delay")).toBe("0ms");
    // And the DOM settled on the hostile key, crossfade untouched.
    expect(t.container.textContent).toContain("panel-c\"d\\e");
    t.app.unmount();
  });

  it("holds the enter (nonzero delay var) when the incoming box measures larger", async () => {
    // The decision → var wiring on its NON-null path: mock real-layout
    // rects so the entering generation measures 480px tall against a
    // zero outgoing box — a size change, so the enter buys the hold.
    const t = mountContainer("a");
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 480,
        width: 320, height: 480, toJSON: () => ({}),
      } as DOMRect);
    try {
      t.key.value = "b";
      await nextTick();
      await nextTick();
      const host = t.container.querySelector<HTMLElement>(".hk-tc");
      expect(host?.style.getPropertyValue("--hk-crossfade-enter-delay")).toBe(
        `${DEFAULT_ANIMATION_DURATION_MS}ms`,
      );
    } finally {
      spy.mockRestore();
    }
    t.app.unmount();
  });

  it("resets the hold when the swap settles (source pin)", () => {
    // The settle callback must clear the hold: custom properties inherit
    // down the slot subtree, so a stale delay would make every NESTED
    // crossfade hold a full beat until the next outer swap (R2
    // 2026-10-27 S2). happy-dom cannot drive the observer-driven settle
    // path, so the reset line is pinned at source — the house pattern for
    // cascade-free contracts.
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkTransitionContainer.tsx"),
      "utf-8",
    ).replace(/\r\n?/g, "\n");
    expect(src).toContain('--hk-crossfade-enter-delay", "0ms"');
    // Inside the settle callback specifically: the reset sits between the
    // timer's arm and the emit it guards (the callback lives in the
    // observer setup, which precedes the decision watch in source order).
    const settleIdx = src.indexOf("settleTimer = setTimeout(");
    const resetIdx = src.indexOf('--hk-crossfade-enter-delay", "0ms"');
    expect(settleIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeGreaterThan(settleIdx);
    // Exactly one such literal: the per-swap decision setter writes the
    // `${delay}ms` interpolation, never this literal.
    expect(src.split('--hk-crossfade-enter-delay", "0ms"').length - 1).toBe(1);
  });
});

describe("swap choreography decision (resolveEnterDelay, 2026-10-27)", () => {
  const D = DEFAULT_ANIMATION_DURATION_MS;
  const box = (w: number, h: number) => ({ w, h });

  it("holds the enter one beat when the box GROWS (grow ∥ exit, then enter)", () => {
    expect(resolveEnterDelay(box(320, 200), box(320, 480), D)).toBe(D);
  });

  it("holds the enter one beat when the box SHRINKS (exit, then shrink ∥ enter)", () => {
    expect(resolveEnterDelay(box(320, 480), box(320, 200), D)).toBe(D);
  });

  it("keeps the simultaneous dissolve when the box is unchanged", () => {
    expect(resolveEnterDelay(box(320, 200), box(320, 200), D)).toBe(0);
    // Sub-pixel noise is not a size change.
    expect(resolveEnterDelay(box(320, 200), box(320, 200.6), D)).toBe(0);
  });

  it("reads a null measurement (no layout) as 'same box'", () => {
    expect(resolveEnterDelay(box(320, 200), null, D)).toBe(0);
  });

  it("collapses to no hold when motion is off (0ms duration)", () => {
    expect(resolveEnterDelay(box(320, 200), box(320, 480), 0)).toBe(0);
  });

  it("a width-only change also buys the hold (the morph axis is not always height)", () => {
    expect(resolveEnterDelay(box(320, 200), box(480, 200), D)).toBe(D);
  });
});

describe("useAnimationLoop (shared rAF context)", () => {
  it("registers and unregisters; the loop idles at zero", () => {
    const cb = vi.fn();
    const off = onAnimationFrame(cb);
    expect(animationLoopArmedCount()).toBe(1);
    off();
    expect(animationLoopArmedCount()).toBe(0);
  });

  it("dedupes the same callback registration", () => {
    const cb = vi.fn();
    const off1 = onAnimationFrame(cb);
    const off2 = onAnimationFrame(cb);
    expect(animationLoopArmedCount()).toBe(1);
    off1();
    expect(animationLoopArmedCount()).toBe(0);
    off2();
    expect(animationLoopArmedCount()).toBe(0);
  });

  it("unregister is idempotent", () => {
    const cb = vi.fn();
    const off = onAnimationFrame(cb);
    off();
    off();
    expect(animationLoopArmedCount()).toBe(0);
  });
});
