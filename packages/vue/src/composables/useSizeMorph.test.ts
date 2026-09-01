import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { useSizeMorph } from "./useSizeMorph";

/** Injectable ResizeObserver: captures the callback so tests can fire
 *  content changes deterministically (happy-dom's own RO never fires —
 *  there is no layout engine). */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const originalRO = globalThis.ResizeObserver;

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface Harness {
  frame: HTMLElement;
  content: HTMLElement;
  setNatural(height: number): void;
  start(): void;
  stop(): void;
  remeasure(): void;
}

function mountHarness(initialHeight: number): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let frameEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let natural = initialHeight;
  let morph: ReturnType<typeof useSizeMorph> | null = null;
  const app = createApp({
    setup() {
      const frame = ref<HTMLElement | null>(null);
      const content = ref<HTMLElement | null>(null);
      morph = useSizeMorph(frame, content);
      return () =>
        h("div", [
          h("div", {
            ref: (el: unknown) => {
              frame.value = (el as HTMLElement | null) ?? null;
              frameEl = frame.value;
              if (frameEl) {
                Object.defineProperty(frameEl, "offsetHeight", {
                  configurable: true,
                  get: () => natural,
                });
              }
            },
            class: "frame",
          }, [
            h("div", {
              ref: (el: unknown) => {
                content.value = (el as HTMLElement | null) ?? null;
                contentEl = content.value;
              },
              class: "content",
            }, "content"),
          ]),
        ]);
    },
  });
  app.mount(container);
  mounts.push({ app, container });
  return {
    frame: frameEl!,
    content: contentEl!,
    setNatural: (h: number) => {
      natural = h;
    },
    start: () => morph!.start(),
    stop: () => morph!.stop(),
    remeasure: () => morph!.remeasure(),
  };
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  vi.useRealTimers();
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
  document.body.innerHTML = "";
});

/** Wait past the 150ms settle debounce + the rAF hop. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 220));
  await nextTick();
}

describe("useSizeMorph", () => {
  it("pins the frame to its natural height on start", () => {
    const h = mountHarness(120);
    h.start();
    expect(h.frame.style.height).toBe("120px");
  });

  it("re-pins through a content change and keeps the live transition restored", async () => {
    const h = mountHarness(120);
    h.start();
    h.setNatural(160);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("160px");
    // The dance restored whatever inline transition the CSS had (none
    // set here — the inline attribute must be gone, not "none").
    expect(h.frame.style.transition).toBe("");
    // The observer watches the content element.
    expect(FakeResizeObserver.instances[0]!.observed).toEqual([h.content]);
  });

  it("keeps the last pin when a measurement returns no layout (bail path)", () => {
    const h = mountHarness(120);
    h.start();
    h.setNatural(0);
    h.remeasure();
    expect(h.frame.style.height).toBe("120px");
    expect(h.frame.style.transition).toBe("");
  });

  it("release returns the frame to auto on stop", () => {
    const h = mountHarness(120);
    h.start();
    h.stop();
    expect(h.frame.style.height).toBe("");
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true);
  });

  it("does nothing while disarmed", () => {
    const h = mountHarness(120);
    h.remeasure();
    expect(h.frame.style.height).toBe("");
  });
});
