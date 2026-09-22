import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { readHkRuntime } from "../runtime/registry";

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

/** Await exactly N animation frames. The bus's one-shot pump is itself
 *  rAF-driven and FIFO-ordered with these, so an awaited frame resolves
 *  in the same tick the pump that ran before it did. */
async function busFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
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
    // Resident promotion: clip-mode frames carry will-change from the
    // arm moment, not per sweep (2026-09-21 round-5 report: a per-sweep
    // promotion read as a one-frame see-through).
    expect(h.frame.style.willChange).toBe("clip-path");

    h.setNatural(360);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    // The pin landed at the new height with no height animation staged.
    expect(h.frame.style.height).toBe("360px");
    // The sweep runs: end-state clip (promotion stays resident).
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.willChange).toBe("clip-path");
    expect(h.frame.style.transition).toBe("");

    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.clipPath).toBe("");
    // Still resident until stop/hold.
    expect(h.frame.style.willChange).toBe("clip-path");
    h.stop();
    expect(h.frame.style.willChange).toBe("");
  });

  it("never tears a live sweep down for a background measurement", async () => {
    // A debounced observer measurement arriving mid-sweep used to call
    // stopReveal(), which republished that sweep's teardown as its LANDING —
    // a consumer parking geometry for the fold released it ~2ms in and the
    // sheet undid and replayed the fold (real-engine finding). The
    // background measurement is deferred until the sweep lands instead.
    const settled: Array<{ sweep: number }> = [];
    const h = mountHarness(300, 300, {
      onSweepSettle: (info) => settled.push(info),
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    // Staged synchronously: the sweep is in flight.
    expect(h.frame.style.clipPath).toBe("inset(60px 0 0 0 round 0px 0px 0px 0px)");

    // A content change arrives while it is still sweeping.
    h.setContentNatural(320);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    // The live sweep survived it…
    expect(settled).toEqual([]);

    // …its own landing still reports, and the deferred measurement then runs.
    fireTransitionEnd(h.frame, "clip-path");
    expect(settled).toHaveLength(1);
    expect(h.frame.style.clipPath).toBe("");
  });

  it("holds the staged clip through a two-frame warmup before the sweep starts", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(360);
    h.remeasure();
    // Staged synchronously — new pin, start inset — but NO sweep yet:
    // the reveal must let the resident layer raster the resized box
    // first (2026-09-21 chest report — a same-task sweep outran the
    // raster thread and the revealed band composited as black tiles).
    expect(h.frame.style.height).toBe("360px");
    expect(h.frame.style.clipPath).toBe("inset(60px 0 0 0 round 0px 0px 0px 0px)");

    // The hold is TWO frames, not one: after the first frame the staged
    // start inset must still be in place (a one-frame warmup would have
    // already opened the clip).
    await busFrames(1);
    expect(h.frame.style.clipPath).toBe("inset(60px 0 0 0 round 0px 0px 0px 0px)");

    await settle();
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("clip-path");
  });

  it("reports the sweep to the animation bus only once it starts", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    // Let any earlier test's report timer expire so the baseline is quiet.
    await new Promise((resolve) => setTimeout(resolve, 220));
    const transitions = (): number =>
      Number(readHkRuntime("animationBus")?.transitions ?? 0);
    const base = transitions();

    h.start();
    h.setNatural(360);
    h.remeasure();
    // Warmup pending: no CSS transition is running yet, nothing reported.
    expect(transitions()).toBe(base);

    // Two warmup frames start the sweep; its 150ms report is live now
    // (well inside the report's window — do NOT use the 220ms settle,
    // it outlives the report).
    await busFrames(3);
    expect(transitions()).toBe(base + 1);

    fireTransitionEnd(h.frame, "clip-path");
    expect(transitions()).toBe(base);
  });

  it("starts the sweep from the old visual edge (delta inset)", async () => {
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
    // The staged start inset HOLDS through the warmup — the sweep is a
    // bus one-shot now, never part of the staging task.
    expect(h.frame.style.clipPath).toBe("inset(120px 0 0 0 round 0px 0px 0px 0px)");
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
  });

  it("conceals shrink through clip-path and re-pins atomically at the end", async () => {
    const h = mountHarness(400);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    // Shrink CONCEALS (round-5 report: the snap read as "no animation"):
    // the box keeps the OLD pin while the top edge folds down through
    // the closing inset — the pin swap lands only at the sweep's end.
    h.setNatural(320);
    h.remeasure();
    // Mid-warmup: the explicit inset(0) start holds (regression
    // contract — never a cleared/none start).
    await busFrames(1);
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.height).toBe("400px");
    await settle();
    // Sweep in flight: clip folding toward inset(80px), height still
    // the old pin.
    expect(h.frame.style.clipPath).toBe("inset(80px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.height).toBe("400px");
    // The sweep ends: atomic re-pin — height jumps to the target with
    // the clip cleared in one transition-off task (visually a no-op).
    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.height).toBe("320px");
    expect(h.frame.style.clipPath).toBe("");

    // Sub-threshold growth (2px < REVEAL_MIN_PX): snaps, no reveal.
    h.setNatural(322);
    h.remeasure();
    expect(h.frame.style.height).toBe("322px");
    expect(h.frame.style.clipPath).toBe("");

    // Sub-threshold shrink (−2px): snaps too, no conceal.
    h.setNatural(320);
    h.remeasure();
    expect(h.frame.style.height).toBe("320px");
    expect(h.frame.style.clipPath).toBe("");
  });

  it("lands an interrupted conceal atomically on the next dance", async () => {
    const h = mountHarness(400);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(320);
    h.remeasure();
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(80px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.height).toBe("400px");

    // A growth lands mid-conceal: the teardown must land the target pin
    // ATOMICALLY (clearing the clip alone would pop the box back to
    // full height for a frame), then the new reveal stages from the
    // CONCEALED height (360 − 320 = 40px).
    h.setNatural(360);
    h.remeasure();
    expect(h.frame.style.height).toBe("360px");
    expect(h.frame.style.clipPath).toBe("inset(40px 0 0 0 round 0px 0px 0px 0px)");
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
  });

  it("lands the sweep via the watchdog when transitionend never fires", async () => {
    const h = mountHarness(400);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(320);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(80px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.height).toBe("400px");

    // Round-6 regression: a WebView that never delivers clip-path
    // transitionend used to freeze the frame here forever. The watchdog
    // (duration + 350ms grace; happy-dom resolves no computed duration,
    // so the 150ms fallback applies -> ~500ms) must land the same
    // atomic re-pin.
    await new Promise((resolve) => setTimeout(resolve, 620));
    expect(h.frame.style.height).toBe("320px");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("clip-path");

    // The watchdog is disarmed on the normal close: a later unrelated
    // transitionend must be a no-op (no double landing, no throw).
    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.height).toBe("320px");
  });

  it("never clips without the mode flag (desktop height morph intact)", async () => {
    const h = mountHarness(300);
    h.start();
    // No resident promotion either — the desktop surface never promotes.
    expect(h.frame.style.willChange).toBe("");

    h.setNatural(400);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("400px");
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");

    // Desktop shrink keeps the plain height morph (no conceal).
    h.setNatural(240);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(h.frame.style.height).toBe("240px");
    expect(h.frame.style.clipPath).toBe("");
  });

  it("clears an in-flight reveal when a new dance starts", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    // Staged: the sweep is still pending on the warmup.
    expect(h.frame.style.clipPath).toBe("inset(80px 0 0 0 round 0px 0px 0px 0px)");
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");

    // A second growth lands mid-sweep: the stale clip/listener/report
    // must come off inside the new dance, then the new reveal stages
    // from the NEW delta (450 − 380 = 70px).
    h.setNatural(450);
    h.remeasure();
    expect(h.frame.style.height).toBe("450px");
    expect(h.frame.style.clipPath).toBe("inset(70px 0 0 0 round 0px 0px 0px 0px)");
    expect(h.frame.style.willChange).toBe("clip-path");
  });

  it("cancels a pending warmup when a second growth re-stages mid-warmup", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    expect(h.frame.style.clipPath).toBe("inset(80px 0 0 0 round 0px 0px 0px 0px)");

    // Burn exactly one of the first warmup's two frames, then re-stage.
    // A LEAKED first warmup would run its sweep on the next frame; the
    // cancelled one (disconnect in stopReveal) never does.
    await busFrames(1);
    h.setNatural(450);
    h.remeasure();
    expect(h.frame.style.clipPath).toBe("inset(70px 0 0 0 round 0px 0px 0px 0px)");

    // One frame later the leak would have flipped the clip open; the
    // freshly staged start inset must still hold.
    await busFrames(1);
    expect(h.frame.style.clipPath).toBe("inset(70px 0 0 0 round 0px 0px 0px 0px)");

    // The NEW warmup's second frame starts its own sweep.
    await busFrames(1);
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
  });

  it("clears an interrupted reveal inside the next dance (no transitionend)", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(380);
    h.remeasure();
    expect(h.frame.style.clipPath).not.toBe("");

    // A SHRINK lands before the reveal's warmup fired: the teardown
    // drops the staged reveal (clip off — the reveal branch's teardown
    // never pops the box, it already sits at its pin) and the new dance
    // CONCEALS toward 310: the box keeps the 380 pin while the edge
    // folds, so no height change is visible until the atomic re-pin.
    // (R1 mutation M1 lineage: without the dance-start teardown a stale
    // clip rode the next morph and lingered at rest.)
    h.setNatural(310);
    h.remeasure();
    expect(h.frame.style.height).toBe("380px");
    // Explicit inset(0) start — the round-6 regression contract: a
    // cleared (none) start point made Chromium skip the clip transition
    // AND its transitionend, freezing the sheet clipped at its old pin.
    expect(h.frame.style.clipPath).toBe("inset(0px 0 0 0 round 0px 0px 0px 0px)");
    await settle();
    expect(h.frame.style.clipPath).toBe("inset(70px 0 0 0 round 0px 0px 0px 0px)");
    fireTransitionEnd(h.frame, "clip-path");
    expect(h.frame.style.height).toBe("310px");
    expect(h.frame.style.clipPath).toBe("");
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

    // A leaked warmup would fire the sweep AFTER the stop and re-add
    // the clip/promotion — disconnect() in stopReveal is the fix.
    await settle();
    expect(h.frame.style.clipPath).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("ignores transitionend events for other properties", async () => {
    const h = mountHarness(300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(360);
    h.remeasure();
    // The listener only exists once the warmup started the sweep.
    await settle();
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
