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
  setContentNatural(height: number): void;
  start(): void;
  stop(): void;
  remeasure(): void;
}

function mountHarness(initialHeight: number, initialContentHeight = 0): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let frameEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let natural = initialHeight;
  let contentNatural = initialContentHeight;
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
                if (contentEl) {
                  Object.defineProperty(contentEl, "offsetHeight", {
                    configurable: true,
                    get: () => contentNatural,
                  });
                }
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
    setContentNatural: (h: number) => {
      contentNatural = h;
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

  // ── Contamination guard (2026-09 mobile report) ─────────────────────
  // A remeasure taken under transition-class flex pollution (e.g. a
  // frozen enter's `flex: 0 0 auto` uncapping the scroll body) reads a
  // "natural" height far past the content — pinning it locked a 600px
  // form at 1728px with ~1100px of blank shell. The guard must release
  // to auto instead of pinning.

  it("releases to auto when the measurement exceeds content plus chrome", async () => {
    // Rest: 600px frame around 560px content → chrome allowance ≈128px.
    const h = mountHarness(600, 560);
    h.start();
    expect(h.frame.style.height).toBe("600px");

    // Contaminated probe: the frame "naturally" 1728px, content unmoved.
    h.setNatural(1728);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("");
    expect(h.frame.style.transition).toBe("");
  });

  it("recovers and pins again once a clean measurement returns", async () => {
    const h = mountHarness(600, 560);
    h.start();

    h.setNatural(1728);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("");

    h.setNatural(520);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("520px");
  });

  it("still pins when the content probe reads zero (no layout engine)", async () => {
    // happy-dom-style degenerate probe: the guard cannot validate
    // anything, so it must not block the pin (pre-guard behavior).
    const h = mountHarness(160, 0);
    h.start();
    expect(h.frame.style.height).toBe("160px");

    h.setNatural(300);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("300px");
  });

  it("pins legitimate overflow growth (frame capped under content height)", async () => {
    // Overflow: content taller than the (capped) frame — the delta goes
    // negative at rest, the allowance floors, and later capped pins
    // must never trip the guard.
    const h = mountHarness(700, 900);
    h.start();
    expect(h.frame.style.height).toBe("700px");

    h.setNatural(720);
    h.setContentNatural(1200);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("720px");
  });

  it("recalibrates the chrome allowance across stop/start cycles", async () => {
    const h = mountHarness(600, 560);
    h.start();
    h.stop();

    // A new open cycle with real chrome of ~200px (frame 700, content 500).
    h.setNatural(700);
    h.setContentNatural(500);
    h.start();
    expect(h.frame.style.height).toBe("700px");

    // 730px is within content+chrome (500+232) → pins.
    h.setNatural(730);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("730px");

    // 900px is past it → releases.
    h.setNatural(900);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("");
  });
});
