import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { useSizeMorph, type SizeMorphOptions } from "./useSizeMorph";

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
  hold(): void;
  remeasure(): void;
}

function mountHarness(initialHeight: number, initialContentHeight = 0, options?: SizeMorphOptions): Harness {
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
      morph = useSizeMorph(frame, content, options);
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
    hold: () => morph!.hold(),
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

// ── Clip reveal mode (--hk-sheet-morph: clip, mobile sheets) ─────────
// Growth morphs reveal through paint-only clip-path instead of an
// animated height: the pin lands instantly and the top edge sweeps up,
// keeping the stretch look without per-frame layout on the fixed,
// backdrop-carrying sheet layer (2026-09-15 mobile flicker report).

/** happy-dom has no TransitionEvent constructor on some builds — the
 * generic Event plus an assigned propertyName reads the same to the
 * composable's listener. */
function fireTransitionEnd(el: HTMLElement, propertyName: string): void {
  // happy-dom's TransitionEvent (when present) ignores the init dict's
  // propertyName — always build the generic event and assign the field.
  const ev = new Event("transitionend");
  Object.defineProperty(ev, "propertyName", { value: propertyName });
  el.dispatchEvent(ev);
}

describe("useSizeMorph clip reveal", () => {
  it("reveals growth through clip-path with an instant pin", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    expect(h.frame.style.height).toBe("300px");

    h.setNatural(360);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    // The pin landed at the new height with no height animation staged.
    expect(h.frame.style.height).toBe("360px");
    // The sweep runs: end-state clip + layer promotion in flight.
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.willChange).toBe("clip-path");
    expect(h.frame.style.transition).toBe("");

    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("starts the sweep from the old visual edge (delta inset)", () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    // The dance overwrites the inline clip synchronously (start → flush
    // → end), so the START state is only observable at the forced-layout
    // flush: wrap the frame's offsetHeight getter to record the clip
    // each flush reads.
    const reads: string[] = [];
    const desc = Object.getOwnPropertyDescriptor(h.frame, "offsetHeight")!;
    Object.defineProperty(h.frame, "offsetHeight", {
      configurable: true,
      get: () => {
        reads.push(h.frame.style.clipPath);
        return (desc.get as () => number)();
      },
    });

    h.setNatural(420);
    h.remeasure();
    // Flush sequence: the released measure (clip ""), then the staged
    // start state — the reveal hides exactly the 120px the sheet grew
    // (420 − 300), putting the visible top edge back at the old line.
    expect(reads).toEqual([
      "",
      "inset(120px 0 0 0 round 0px 0px 0px 0px)",
    ]);
    expect(h.frame.style.height).toBe("420px");
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
  });

  it("keeps the height morph for shrink and sub-threshold growth", async () => {
    const h = mountHarness(400);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    // Shrink: no clip state, the pin flips under the height transition.
    h.setNatural(320);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("320px");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");

    // Sub-threshold growth (2px < REVEAL_MIN_PX): snaps, no reveal.
    h.setNatural(322);
    h.remeasure();
    expect(h.frame.style.height).toBe("322px");
    expect(h.frame.style.clipPath).toBe("");
  });

  it("never clips without the mode flag (desktop height morph intact)", async () => {
    const h = mountHarness(300);
    h.start();

    h.setNatural(400);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("400px");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("clears an in-flight reveal when a new dance starts", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");

    // A second growth lands before transitionend fired: the stale clip
    // must come off inside the new dance, then the new reveal stages.
    h.setNatural(450);
    h.remeasure();
    expect(h.frame.style.height).toBe("450px");
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.willChange).toBe("clip-path");
  });

  it("clears an interrupted reveal inside the next dance (no transitionend)", () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    expect(h.frame.style.clipPath).not.toBe("");

    // A SHRINK lands before the reveal's transitionend fired: unlike a
    // follow-up growth (which restages its own clip), the height-morph
    // branch writes no clip at all — the dance-start teardown is the
    // only thing that returns the frame to CSS ownership (R1 mutation
    // M1 evidence: without it the stale inset(0px) + will-change ride
    // the shrink and linger at rest).
    h.setNatural(310);
    h.remeasure();
    expect(h.frame.style.height).toBe("310px");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("releases the clip state on stop so the leave animation owns the frame", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    expect(h.frame.style.clipPath).not.toBe("");

    h.stop();
    expect(h.frame.style.height).toBe("");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("ignores transitionend events for other properties", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(360);
    h.remeasure();
    fireTransitionEnd(h.frame, "height");
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    fireTransitionEnd(h.frame, "opacity");
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.clipPath).toBe("");
  });
});

// ── Leave-window hold + enter-window defer (2026-09-16 modal report) ──
// The modal's close fold owns the frame's geometry for the whole leave:
// hold() keeps the pin (a mid-leave content change must not resize the
// folding frame) and the reopen-interrupt path animates FROM that pin.
// The enter unfold is height-relative geometry (translateY 5% + bottom
// 10% clip of the frame height), so deferRemeasure freezes resize-driven
// re-pins through the enter and the open edge flushes them.

describe("useSizeMorph hold + deferRemeasure", () => {
  it("hold keeps the pin and stops observing (leave-window stability)", () => {
    const h = mountHarness(120, 100);
    h.start();
    expect(h.frame.style.height).toBe("120px");

    h.hold();
    // The pin STAYS (unlike stop's release to auto)…
    expect(h.frame.style.height).toBe("120px");
    // …and the observer is disarmed: no content change can re-pin.
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true);
  });

  it("stop after a hold still releases (full-close bookkeeping)", () => {
    const h = mountHarness(120, 100);
    h.start();
    h.hold();
    h.stop();
    expect(h.frame.style.height).toBe("");
  });

  it("start after a hold re-arms and animates from the held pin", () => {
    const h = mountHarness(120, 100);
    h.start();
    h.hold();
    // Reopen interrupt: the natural height changed while held — the next
    // arm re-pins to it (from the held 120px, per the dance's re-pin).
    h.setNatural(200);
    h.start();
    expect(h.frame.style.height).toBe("200px");
    // A FRESH observer owns the new cycle.
    expect(FakeResizeObserver.instances.length).toBe(2);
    expect(FakeResizeObserver.instances[1]!.disconnected).toBe(false);
  });

  it("deferRemeasure freezes RO-driven re-pins; explicit remeasure flushes", async () => {
    let gated = true;
    const h = mountHarness(120, 100, { deferRemeasure: () => gated });
    h.start();
    // The initial pin is NOT gated (arming must pin immediately).
    expect(h.frame.style.height).toBe("120px");

    // Content streams in mid-enter: the RO fires but the pin must not
    // move — the unfold's height-relative geometry stays put.
    h.setNatural(160);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("120px");

    // The open edge flushes the deferred growth.
    h.remeasure();
    expect(h.frame.style.height).toBe("160px");

    // Gate off: RO-driven updates flow again.
    gated = false;
    h.setNatural(200);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("200px");
  });
});
