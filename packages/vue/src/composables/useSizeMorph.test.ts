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
  heightMorph(durationMs: number): void;
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
    heightMorph: (ms: number) => morph!.heightMorph(ms),
  };
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  vi.restoreAllMocks();
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

  it("keeps the resident rider layers through a contamination-guard release", async () => {
    // Round 15 rig finding: the guard's mid-flight release() used to
    // call clearResidentWill(), tearing the chrome promotions down at
    // the swap frame on capped sheets — every later sweep of the same
    // open cycle then promoted at STAGE again (the black-block race).
    // The pin drops (measurement hygiene) but the cycle's layers stay.
    const rider = document.createElement("div");
    const h = mountHarness(600, 560, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.content.appendChild(rider);
    h.start();
    expect(rider.style.willChange).toBe("transform");

    h.setNatural(1728);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    // The pin dropped…
    expect(h.frame.style.height).toBe("");
    // …but the resident promotion survived the guard, and only the full
    // stop unwinds it.
    expect(rider.style.willChange).toBe("transform");
    expect(h.frame.style.willChange).toBe("clip-path");
    h.stop();
    expect(rider.style.willChange).toBe("");
    expect(h.frame.style.willChange).toBe("");
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

  it("keeps a deferred flush from tearing down the successor sweep", async () => {
    // The flush of a deferred measurement must stay a background measurement:
    // if it interrupts, a fold staged by an explicit announce in the frame
    // before it is torn down and replayed (real-engine race, N7).
    const settled: Array<{ sweep: number }> = [];
    const h = mountHarness(300, 300, {
      onSweepSettle: (info) => settled.push(info),
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    // A background change arrives mid-sweep and is deferred…
    h.setContentNatural(320);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    expect(settled).toEqual([]);
    // …the sweep lands, which schedules its flush…
    fireTransitionEnd(h.frame, "clip-path");
    expect(settled).toHaveLength(1);
    // …and an explicit announce stages the successor before that flush runs.
    h.setNatural(420);
    h.remeasure();
    await settle();
    // The flush left the successor alone: an interrupting flush would tear
    // it down and publish a second settle for it.
    expect(settled).toHaveLength(1);
    h.stop();
  });

  it("mints a fresh sweep identity per staged sweep", async () => {
    // The park's scoping is only meaningful if every sweep has its own id: a
    // constant would let an interrupting teardown pass as the park's landing
    // (mutation-reachable gap found by the audit).
    const staged: Array<{ sweep: number }> = [];
    const h = mountHarness(300, 300, {
      onSweepStage: (info) => staged.push({ sweep: info.sweep }),
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    fireTransitionEnd(h.frame, "clip-path");
    h.setNatural(320);
    h.remeasure();
    expect(staged.map((s) => s.sweep)).toEqual([1, 2]);
    h.stop();
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

// ── Fold riders (collectRide, 2026-09-23 round 14) ─────────────────
// The clip sweep's edge must not slice the content it passes over: the
// host's chrome and content block ride the edge in lockstep (same
// duration/easing, flipped in the same task), staged in the clip's own
// transition-disabled task so the morph's first painted frame is
// pixel-identical to the last pre-morph one.

describe("useSizeMorph fold riders", () => {
  it("stages riders with the clip and flips them with the sweep (reveal)", async () => {
    const rider = document.createElement("div");
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();

    h.setNatural(360);
    h.remeasure();
    // Staged in the clip's transition-disabled task: the block sits at
    // its pre-growth offset and the promotion is already up (the warmup
    // is the raster window). The transform leg is staged at a zero clock
    // — instant — so nothing of the ride animates before the sweep.
    expect(rider.style.transform).toBe("translateY(60px)");
    expect(rider.style.transition).toBe("transform 0s");
    expect(rider.style.willChange).toBe("transform");

    // Two warmup frames, then the sweep: riders flip to their targets
    // under a transition that mirrors the frame's own clip transition.
    await busFrames(2);
    expect(rider.style.transform).toBe("translateY(0px)");
    expect(rider.style.transition).toMatch(/^transform 150ms /);
    expect(rider.style.willChange).toBe("transform");

    // The landing clears the rides with the frame.
    fireTransitionEnd(h.frame, "clip-path");
    expect(rider.style.transform).toBe("");
    expect(rider.style.transition).toBe("");
    expect(rider.style.willChange).toBe("");
    h.stop();
  });

  it("rides a conceal downward with the block and lands atomically", async () => {
    const rider = document.createElement("div");
    const h = mountHarness(360, 360, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    expect(h.frame.style.height).toBe("360px");

    h.setNatural(300);
    h.remeasure();
    // Conceal start: the block rides from zero (it is where it was).
    expect(rider.style.transform).toBe("translateY(0px)");

    await busFrames(2);
    // The sweep folds the edge down and the block glides WITH it.
    expect(rider.style.transform).toBe("translateY(60px)");

    // Landing: the re-pin and the ride's release land in one task — the
    // layout drops delta while the delta offset disappears.
    fireTransitionEnd(h.frame, "clip-path");
    expect(rider.style.transform).toBe("");
    expect(h.frame.style.height).toBe("300px");
    h.stop();
  });

  it("clears riders when an interrupting dance re-stages mid-sweep", async () => {
    const rider = document.createElement("div");
    let collected = 0;
    const h = mountHarness(300, 300, {
      collectRide: () => {
        collected += 1;
        return [{ el: rider }];
      },
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    await busFrames(2);
    // One collection at ARM (resident promotion) + one at the stage.
    expect(collected).toBe(2);
    // A second growth mid-sweep: the old ride is cleared (atomically
    // with the interrupted sweep's landing) and re-collected for the new
    // dance's own stage.
    h.setNatural(420);
    h.remeasure();
    expect(rider.style.transform).toBe("translateY(60px)");
    expect(collected).toBe(3);
    // The successor sweep runs and lands on its own terms.
    await busFrames(2);
    expect(rider.style.transform).toBe("translateY(0px)");
    fireTransitionEnd(h.frame, "clip-path");
    expect(rider.style.transform).toBe("");
    h.stop();
  });

  it("never collects riders for non-sweep morphs", async () => {
    const rider = document.createElement("div");
    let collected = 0;
    const h = mountHarness(300, 300, {
      collectRide: () => {
        collected += 1;
        return [{ el: rider }];
      },
    });
    h.start();
    // Desktop height mode (no clip flag): a growth morphs the height,
    // never stages a sweep, never collects a ride.
    h.setNatural(360);
    h.remeasure();
    expect(collected).toBe(0);
    expect(rider.style.transform).toBe("");
    // Sub-threshold deltas on clip mode stay snaps — still no ride.
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.setNatural(362);
    h.remeasure();
    expect(collected).toBe(0);
    expect(rider.style.transform).toBe("");
    h.stop();
  });

  it("keeps a rider's own transition legs live through the ride", async () => {
    // The entering step body is MID-FADE when a shrink stages its ride;
    // an inline transition override would cancel the running opacity
    // transition and snap the body to full opacity — the very flash this
    // round removes. The ride's transform leg must be APPENDED to the
    // element's own computed transition, and the settle must hand back
    // exactly the stylesheet state.
    const rider = document.createElement("div");
    const OWN = "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1) 0s";
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
        const cs = real(el, pseudoElt ?? undefined);
        if (el === rider) {
          return Object.create(cs, {
            transition: { get: () => OWN },
            transitionProperty: { get: () => "opacity" },
            transitionDuration: { get: () => "150ms" },
            transitionTimingFunction: { get: () => "cubic-bezier(0.4, 0, 0.2, 1)" },
          }) as CSSStyleDeclaration;
        }
        return cs;
      },
    );
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    // Stage: the own legs lead, the zero-clock transform leg appends.
    expect(rider.style.transition).toBe(`${OWN}, transform 0s`);
    await busFrames(2);
    // Flip: the transform leg rides the mirrored clock, own legs intact.
    expect(rider.style.transition).toBe(
      `${OWN}, transform 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
    );
    fireTransitionEnd(h.frame, "clip-path");
    // Settle: inline fully released — the stylesheet (the own legs) owns
    // the element again.
    expect(rider.style.transition).toBe("");
    expect(rider.style.transform).toBe("");
    h.stop();
  });
});

describe("useSizeMorph fold rider settle handoff", () => {
  it("hands the rider back its own transition legs at the settle flush", async () => {
    // R2 finding 1: clearRiders' first pass must WRITE the element's own
    // computed transition (not "none") before the flush — an override
    // there cancels a mid-flight opacity transition on a real engine,
    // which is exactly the snap this round removes. happy-dom cannot run
    // transitions, so the witness is the inline value CAPTURED AT THE
    // FLUSH the settle itself performs (the frame's offsetHeight read).
    const rider = document.createElement("div");
    const OWN = "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1) 0s";
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
        const cs = real(el, pseudoElt ?? undefined);
        if (el === rider) {
          return Object.create(cs, {
            transition: { get: () => OWN },
            transitionProperty: { get: () => "opacity" },
            transitionDuration: { get: () => "150ms" },
            transitionTimingFunction: { get: () => "cubic-bezier(0.4, 0, 0.2, 1)" },
          }) as CSSStyleDeclaration;
        }
        return cs;
      },
    );
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    h.setNatural(360);
    h.remeasure();
    await busFrames(2);

    // Capture the rider's inline transition at every layout flush the
    // settle performs — the handoff must be visible there.
    const atFlush: string[] = [];
    Object.defineProperty(h.frame, "offsetHeight", {
      configurable: true,
      get() {
        atFlush.push(rider.style.transition);
        return 360;
      },
    });
    fireTransitionEnd(h.frame, "clip-path");
    expect(
      atFlush,
      "the settle's own flush must observe the rider's own legs",
    ).toContain(OWN);
    // …and the inline override is fully released afterwards.
    expect(rider.style.transition).toBe("");
    expect(rider.style.transform).toBe("");
    h.stop();
  });
});

// ── Resident rider promotion (round 15, 2026-09-23 black-block report) ──
// The riders' will-change initially landed at STAGE time: three fresh
// layer promotions inside the frame's re-raster task, with only the
// two-frame warmup to absorb them — on the phone GPU the body block
// composited as black tiles through the early sweep (the same raster
// race the frame's resident promotion had fixed). The host chrome now
// promotes ONCE at arm time and keeps its layers for the whole cycle.

describe("useSizeMorph resident rider promotion", () => {
  it("promotes in-frame riders at arm time and keeps them through settles", async () => {
    const rider = document.createElement("div");
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.content.appendChild(rider);
    // Before arming there is no promotion.
    expect(rider.style.willChange).toBe("");
    h.start();
    // Armed: the rider (inside the frame subtree) is promoted once,
    // together with the frame itself.
    expect(rider.style.willChange).toBe("transform");
    expect(h.frame.style.willChange).toBe("clip-path");

    // A full sweep: stage → flip → settle. The rider rides, and the
    // settle must NOT demote it — the landing crossing a layer boundary
    // is the raster race that read as black blocks on the phone.
    h.setNatural(360);
    h.remeasure();
    expect(rider.style.transform).toBe("translateY(60px)");
    await busFrames(2);
    expect(rider.style.transform).toBe("translateY(0px)");
    fireTransitionEnd(h.frame, "clip-path");
    expect(rider.style.transform).toBe("");
    expect(rider.style.willChange).toBe("transform");

    // The whole open cycle's layerization unwinds at stop/hold.
    h.stop();
    expect(rider.style.willChange).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("leaves detached (per-swap) riders on the stage-time promotion path", async () => {
    // A rider NOT in the frame subtree at arm time — the stepflow's
    // entering body, registered mid-swap — never becomes resident: its
    // promotion still lands at stage and still releases at the settle.
    const resident = document.createElement("div");
    let perSwap: HTMLElement | null = null;
    const h = mountHarness(300, 300, {
      collectRide: () => {
        const out: Array<{ el: HTMLElement }> = [{ el: resident }];
        if (perSwap) out.push({ el: perSwap });
        return out;
      },
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.content.appendChild(resident);
    h.start();
    expect(resident.style.willChange).toBe("transform");

    perSwap = document.createElement("div"); // registered mid-flight, detached
    h.setNatural(360);
    h.remeasure();
    expect(perSwap.style.willChange).toBe("transform");
    await busFrames(2);
    fireTransitionEnd(h.frame, "clip-path");
    expect(perSwap.style.willChange).toBe("");
    expect(resident.style.willChange).toBe("transform");
    h.stop();
  });

  it("unwinds the resident rider layers on unmount", async () => {
    // The unmount teardown owns its own clearResidentWill (it must not
    // rely on hold() — an open surface torn down mid-cycle leaves no
    // other path). Witness: the promoted layer flag outlives the app.
    const rider = document.createElement("div");
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.content.appendChild(rider);
    h.start();
    expect(rider.style.willChange).toBe("transform");
    const mount = mounts.splice(-1)[0]!;
    mount.app.unmount();
    expect(rider.style.willChange).toBe("");
    expect(h.frame.style.willChange).toBe("");
  });

  it("does not promote riders when the surface is not clip-mode", () => {
    const rider = document.createElement("div");
    const h = mountHarness(300, 300, {
      collectRide: () => [{ el: rider }],
    });
    h.content.appendChild(rider);
    h.start();
    expect(rider.style.willChange).toBe("");
    h.stop();
  });
});

describe("useSizeMorph deferRemeasure gate (freeze protocol witness)", () => {
  it("gates background measurements while deferred and releases after", async () => {
    // Round 16: HkModal's slide-window freeze is a deferRemeasure input
    // — the morph must hold the pin while gated and measure again the
    // moment the gate opens (a stale gate would starve the observer
    // forever). Witnessed here at the composable level where the bus's
    // frames run.
    let gated = true;
    const h = mountHarness(300, 300, { deferRemeasure: () => gated });
    h.start();
    expect(h.frame.style.height).toBe("300px");

    // Content grows while gated: the pin must hold.
    h.setNatural(400);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    await busFrames(3);
    expect(h.frame.style.height).toBe("300px");

    // The gate opens (the morph edge): the very next background
    // measurement goes through.
    gated = false;
    h.setNatural(420);
    FakeResizeObserver.instances[0]!.callback();
    await settle();
    await busFrames(3);
    expect(h.frame.style.height).toBe("420px");
    h.stop();
  });
});

describe("useSizeMorph heightMorph (round 18)", () => {
  it("transitions the pin with an inline height transition and cleans up", async () => {
    const h = mountHarness(300, 300);
    h.frame.style.setProperty("--hk-sheet-morph", "clip");
    h.start();
    expect(h.frame.style.height).toBe("300px");
    expect(h.frame.style.willChange).toBe("clip-path");

    h.setNatural(400);
    (h as unknown as { heightMorph: (ms: number) => void }).heightMorph(300);
    // The inline transition landed and the pin moved.
    expect(h.frame.style.height).toBe("400px");
    expect(h.frame.style.transition).toContain("height");
    expect(h.frame.style.transition).toContain("300ms");
    // No clip staging, no riders — this is a plain height animation.
    expect(h.frame.style.clipPath).toBe("");
    // The resident layer promotion is LIFTED for the animation's
    // duration (round 19: the per-frame texture re-allocation of a
    // composited layer during height animation composites as
    // transparent on phone GPUs — the background flash-through).
    expect(h.frame.style.willChange).toBe("");

    // The transitionend cleans the inline override AND restores the
    // resident promotion (the frame is at rest).
    const ev = new Event("transitionend");
    Object.defineProperty(ev, "propertyName", { value: "height" });
    h.frame.dispatchEvent(ev);
    expect(h.frame.style.transition).toBe("");
    expect(h.frame.style.willChange).toBe("clip-path");
    h.stop();
  });

  it("is a no-op for sub-threshold deltas", async () => {
    const h = mountHarness(300, 300);
    h.start();
    expect(h.frame.style.height).toBe("300px");
    h.setNatural(301);
    (h as unknown as { heightMorph: (ms: number) => void }).heightMorph(300);
    expect(h.frame.style.height).toBe("301px");
    expect(h.frame.style.transition).toBe("");
    h.stop();
  });
});
