import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { useApproachEnd } from "./useApproachEnd";

/** Injectable observers: happy-dom ships neither a layout engine nor
 *  firing observers, so the composable's ResizeObserver/MutationObserver
 *  sensors are replaced with deterministic fakes whose callbacks the
 *  tests fire by hand (same pattern as useSizeMorph.test.ts). */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  disconnected = false;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  callback: () => void;
  disconnected = false;
  lastOptions: MutationObserverInit | null = null;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }
  observe(_el: Node, options?: MutationObserverInit): void {
    this.lastOptions = options ?? null;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const originalRO = globalThis.ResizeObserver;
const originalMO = globalThis.MutationObserver;

/** Two awaited frames: one for scheduleFrame's scheduling rAF, one for
 *  the onceFrame initial pass — keeps flush order deterministic. */
async function flushFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

interface Harness {
  el: HTMLElement;
  handle: ReturnType<typeof useApproachEnd>;
  fired: () => number;
  setGeometry(o: { scrollHeight: number; clientHeight: number; scrollTop: number }): void;
  scroll(): Promise<void>;
  mutate(): Promise<void>;
}

function mountHarness(options?: Parameters<typeof useApproachEnd>[2]): Harness {
  const el = document.createElement("div");
  const define = (prop: string, value: number) =>
    Object.defineProperty(el, prop, { value, configurable: true });
  define("scrollHeight", 100);
  define("clientHeight", 300);
  define("scrollTop", 0);

  let fires = 0;
  const vp = ref<HTMLElement | null>(el);
  const handle = useApproachEnd(vp, () => fires += 1, options);

  return {
    el,
    handle,
    fired: () => fires,
    setGeometry({ scrollHeight, clientHeight, scrollTop }) {
      define("scrollHeight", scrollHeight);
      define("clientHeight", clientHeight);
      define("scrollTop", scrollTop);
    },
    async scroll() {
      el.dispatchEvent(new Event("scroll"));
      await flushFrames();
    },
    async mutate() {
      FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]?.callback();
      await flushFrames();
    },
  };
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  FakeMutationObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  globalThis.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  globalThis.MutationObserver = originalMO;
});

describe("useApproachEnd", () => {
  it("fires once on bind when content is shorter than the viewport (auto-fill entry)", async () => {
    const h = mountHarness();
    await flushFrames();
    expect(h.fired()).toBe(1);
  });

  it("refires when content grows while still in the zone", async () => {
    const h = mountHarness();
    await flushFrames();
    expect(h.fired()).toBe(1);
    h.setGeometry({ scrollHeight: 400, clientHeight: 300, scrollTop: 0 });
    await h.mutate();
    expect(h.fired()).toBe(2);
  });

  it("keeps firing while under-filled even though scrollHeight clamps to clientHeight", async () => {
    // A REAL under-filled DOM reports scrollHeight == clientHeight (the
    // CSSOM clamp), so the geometry key cannot change as pages land —
    // the under-filled state must bypass the dedup entirely.
    const h = mountHarness();
    h.setGeometry({ scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
    await flushFrames();
    expect(h.fired()).toBe(1);
    h.setGeometry({ scrollHeight: 300, clientHeight: 300, scrollTop: 0 }); // "grew" but still clamped
    await h.mutate();
    expect(h.fired()).toBe(2);
    await h.mutate();
    expect(h.fired()).toBe(3);
  });

  it("observes characterData/subtree mutations on the viewport", () => {
    mountHarness();
    const mo = FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1];
    expect(mo.lastOptions).toMatchObject({ childList: true, subtree: true, characterData: true });
  });

  it("checks on viewport resize (ResizeObserver callback path)", async () => {
    const h = mountHarness({ distance: 50 });
    // Start far from the end: 900 - 0 - 300 = 600 > 50 → outside.
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    await flushFrames();
    expect(h.fired()).toBe(0);
    // The viewport box SHRINKS, pulling the end zone over the offset.
    h.setGeometry({ scrollHeight: 900, clientHeight: 850, scrollTop: 0 });
    FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1].callback();
    await flushFrames();
    expect(h.fired()).toBe(1);
  });

  it("does not refire on scroll jitter with unchanged geometry", async () => {
    const h = mountHarness();
    await flushFrames();
    expect(h.fired()).toBe(1);
    h.setGeometry({ scrollHeight: 400, clientHeight: 300, scrollTop: 0 });
    await h.mutate(); // grew but still within 160px of the end → refire
    expect(h.fired()).toBe(2);
    for (let i = 0; i < 3; i++) {
      h.setGeometry({ scrollHeight: 400, clientHeight: 300, scrollTop: 100 * (i + 1) });
      await h.scroll();
    }
    // Scrolled deeper but geometry unchanged → no further emissions.
    expect(h.fired()).toBe(2);
  });

  it("refires after leaving and re-entering the zone", async () => {
    const h = mountHarness({ distance: 50 });
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    await flushFrames();
    // 900 - 0 - 300 = 600 > 50 → outside; the initial pass must not fire.
    expect(h.fired()).toBe(0);
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 880 });
    await h.scroll(); // 900 - 880 - 300 < 0 ≤ 50 → in zone, first entry
    expect(h.fired()).toBe(1);
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 100 });
    await h.scroll(); // leave
    expect(h.fired()).toBe(1);
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 890 });
    await h.scroll(); // re-enter (same geometry key — must still fire)
    expect(h.fired()).toBe(2);
  });

  it("recheck() forces an emission with unchanged geometry", async () => {
    const h = mountHarness();
    await flushFrames();
    expect(h.fired()).toBe(1);
    h.handle.recheck();
    await flushFrames();
    expect(h.fired()).toBe(2);
  });

  it("stop() detaches every sensor", async () => {
    let handle: ReturnType<typeof useApproachEnd> | null = null;
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(el, "scrollTop", { value: 0, configurable: true });
    let fires = 0;
    const vp = ref<HTMLElement | null>(el);
    handle = useApproachEnd(vp, () => fires += 1);
    await flushFrames();
    expect(fires).toBe(1);
    handle.stop();
    expect(FakeResizeObserver.instances.every((i) => i.disconnected)).toBe(true);
    expect(FakeMutationObserver.instances.every((i) => i.disconnected)).toBe(true);
    h_replay(el);
    await flushFrames();
    expect(fires).toBe(1);
    // recheck after stop stays inert too.
    handle.recheck();
    await flushFrames();
    expect(fires).toBe(1);
  });

  /** A scroll after stop must not reach the (detached) listener. */
  function h_replay(el: HTMLElement): void {
    el.dispatchEvent(new Event("scroll"));
  }

  it("honours the distance option in getter form", async () => {
    let distance = 50;
    const h = mountHarness({ distance: () => distance });
    h.setGeometry({ scrollHeight: 900, clientHeight: 300, scrollTop: 540 });
    await flushFrames();
    // 900 - 540 - 300 = 60 > 50 → outside.
    expect(h.fired()).toBe(0);
    expect(h.handle.isNearEnd()).toBe(false);
    distance = 100; // getter is read live: the same geometry is now in zone
    expect(h.handle.isNearEnd()).toBe(true);
    await h.scroll();
    expect(h.fired()).toBe(1);
  });

  it("rebinds when the viewport ref swaps and isNearEnd never emits", async () => {
    const first = document.createElement("div");
    Object.defineProperty(first, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(first, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(first, "scrollTop", { value: 0, configurable: true });
    const second = document.createElement("div");
    Object.defineProperty(second, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(second, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(second, "scrollTop", { value: 0, configurable: true });
    let fires = 0;
    const vp = ref<HTMLElement | null>(first);
    const handle = useApproachEnd(vp, () => fires += 1);
    await nextTick();
    await flushFrames();
    expect(fires).toBe(1);
    vp.value = second;
    await nextTick();
    await flushFrames();
    // Second element is far from its end → the rebinding initial pass is inert.
    expect(handle.isNearEnd()).toBe(false);
    expect(fires).toBe(1);
    handle.stop();
  });
});
