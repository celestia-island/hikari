import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref, type App } from "vue";

import HkTransitionContainer from "./HkTransitionContainer";
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
