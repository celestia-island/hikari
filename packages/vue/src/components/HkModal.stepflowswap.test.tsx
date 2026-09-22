import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";
import { useSheetRide } from "../runtime/sheetRide";

const SHEET_SWEEP_STAGE_EVENT = "hk-sheet-sweep-stage";
const SHEET_SWEEP_SETTLE_EVENT = "hk-sheet-sweep-settle";

/**
 * Behavioural contract for the stepflow → sheet morph handoff
 * (2026-09-22 user directive, round 10): a HkStepFlow swap announces the
 * phase that owns the height change (`{ delta, durationMs, phase }`) and
 * the hosting modal must morph its clip over ONE phase, not the 0.3s
 * family default.
 *
 * Round-1 verification (2026-09-22) found this wiring DEAD in the real
 * consumer: the listener was attached in `onMounted` while the modal
 * renders nothing until `machine.mounted` flips, so `bodyRef.value` was
 * undefined at attach time and every mount-closed-then-open consumer
 * (chest's wizards) silently got no handoff at all — the sheet fell back
 * to the morph's 150ms settle debounce plus a 0.3s sweep. These tests
 * therefore drive the REAL pattern (mount closed, open later) and assert
 * the observable token, so the defect cannot return unnoticed.
 *
 * happy-dom has no transition engine: durations are stubbed and rAF is
 * frozen (same harness as HkModal.contenthold.test.tsx), with fake timers
 * driving the machine's phase edges.
 */
const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function freezeRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0 as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

function stubDurations(): void {
  const realGCS = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (el: Element, ...rest: unknown[]) => {
    const style = realGCS(el as Element, ...(rest as []));
    return { ...style, transitionDuration: "0.3s" } as CSSStyleDeclaration;
  });
}

interface Rig {
  open: { value: boolean };
  bodyEl: () => HTMLElement | null;
  frameEl: () => HTMLElement | null;
  /** Fire the swap passthrough the way HkStepFlow does (bubbling from a
   *  descendant of the modal body). */
  announceSwap: (detail: { delta: number; durationMs: number; phase: string }) => void;
  morphToken: () => string;
}

async function mountRig(): Promise<Rig> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(false);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          modelValue: open.value,
          closable: true,
          title: "swap-test",
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
        }, {
          default: () => h("div", { class: "swap-body" }, "step content"),
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  return {
    open,
    bodyEl: () => document.querySelector<HTMLElement>(".hk-modal-body"),
    frameEl: () => document.querySelector<HTMLElement>(".hk-modal-content"),
    announceSwap: (detail) => {
      const host = document.querySelector<HTMLElement>(".hk-modal-body .swap-body")
        ?? document.querySelector<HTMLElement>(".hk-modal-body");
      if (!host) throw new Error("announceSwap: modal body missing");
      host.dispatchEvent(
        new CustomEvent(STEPFLOW_SWAP_EVENT, { bubbles: true, detail }),
      );
    },
    morphToken: () =>
      document
        .querySelector<HTMLElement>(".hk-modal-content")
        ?.style.getPropertyValue("--hk-modal-morph-duration") ?? "",
  };
}

describe("HkModal stepflow swap handoff", () => {
  it("morphs over the announced phase for a modal mounted CLOSED (the real consumer path)", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig();

    // The premise of the round-1 defect: while closed there is no body to
    // attach to, so an onMounted-time attach could never have worked.
    expect(rig.bodyEl()).toBeNull();

    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.bodyEl()).not.toBeNull();
    expect(rig.morphToken()).toBe("");

    // A swap that owns the height in its FIRST phase.
    rig.announceSwap({ delta: 120, durationMs: 150, phase: "exit" });
    await nextTick();
    expect(rig.morphToken()).toBe("150ms");

    // …and the override is scoped to that one sweep window.
    await vi.advanceTimersByTimeAsync(500);
    expect(rig.morphToken()).toBe("");
  });

  it("leaves the stylesheet default in place for an instant settlement", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig();
    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);

    // Reduced motion / stylesheet-less runtimes announce durationMs 0:
    // there is no phase to match, so no override may be written.
    rig.announceSwap({ delta: 0, durationMs: 0, phase: "instant" });
    await nextTick();
    expect(rig.morphToken()).toBe("");
    await vi.advanceTimersByTimeAsync(500);
    expect(rig.morphToken()).toBe("");
  });

  it("ignores announcements while the surface is still unfolding", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig();
    rig.open.value = true;
    // The machine's phase is opening* here: the morph is not armed yet, so
    // an override would be stranded on the frame.
    await vi.advanceTimersByTimeAsync(10);
    if (rig.bodyEl()) {
      rig.announceSwap({ delta: 60, durationMs: 150, phase: "exit" });
      await nextTick();
    }
    expect(rig.morphToken()).toBe("");
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.morphToken()).toBe("");
  });

  it("drops the override when the modal unmounts mid-sweep", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig();
    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);

    rig.announceSwap({ delta: 80, durationMs: 150, phase: "exit" });
    await nextTick();
    const frame = rig.frameEl();
    expect(frame?.style.getPropertyValue("--hk-modal-morph-duration")).toBe("150ms");

    // Unmount with the sweep still in flight: the timer must not outlive
    // the component, and the token must not survive on the detached node.
    for (const app of mounts.splice(0)) app.unmount();
    await nextTick();
    expect(frame?.style.getPropertyValue("--hk-modal-morph-duration")).toBe("");
  });
});

describe("HkModal publishes its own fold for the step flow", () => {
  /** Box model: the frame hugs its content up to `cap`; the content probe
   *  reports `content` plus the chrome the calibration measures. */
  let content = 0;
  let cap = Number.POSITIVE_INFINITY;
  const realOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );

  function stubBox(initialContent: number, capPx: number): void {
    content = initialContent;
    cap = capPx;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains("hk-modal-content")) {
          return Math.min(content + 96, cap);
        }
        if (this.classList.contains("hk-modal-body-inner")) return content;
        return 0;
      },
    });
  }

  function restoreBox(): void {
    if (realOffsetHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetHeight",
        realOffsetHeight,
      );
    }
  }

  function stubClip(): void {
    const real = window.getComputedStyle.bind(window);
    vi.stubGlobal("getComputedStyle", (el: Element, ...rest: unknown[]) => {
      const style = real(el as Element, ...(rest as []));
      if (!(el instanceof HTMLElement)) return style;
      if (el.classList.contains("hk-modal-content")) {
        return {
          ...style,
          transitionDuration: "0.3s",
          getPropertyValue: (name: string) =>
            name === "--hk-sheet-morph" ? "clip" : style.getPropertyValue(name),
        } as CSSStyleDeclaration;
      }
      return style;
    });
  }

  afterEach(() => {
    restoreBox();
  });

  it("republishes the morph's real fold span and its landing", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubClip();
    // Content starts at 500 (frame 596) and the sheet is uncapped, so the
    // morph can fold: shrinking the content must publish a conceal.
    stubBox(500, Number.POSITIVE_INFINITY);
    const rig = await mountRig();
    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.bodyEl()).not.toBeNull();

    const stages: unknown[] = [];
    let settled = 0;
    rig.bodyEl()!.addEventListener(SHEET_SWEEP_STAGE_EVENT, (e) => {
      stages.push((e as CustomEvent).detail);
    });
    rig.bodyEl()!.addEventListener(SHEET_SWEEP_SETTLE_EVENT, () => {
      settled += 1;
    });

    // The sweep needs real frames: pump rAF from here on (a frozen frame
    // loop would strand the morph's warmup, as its own docs warn).
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    // The flow owns the new height and announces; the modal measures,
    // stages its conceal, and publishes the span it will sweep.
    content = 300;
    rig.announceSwap({ delta: -200, durationMs: 150, phase: "enter" });
    await nextTick();
    expect(stages).toEqual([
      { direction: "conceal", from: 596, to: 396, sweep: expect.any(Number) },
    ]);

    // …and the landing is published when the sweep finishes, carrying the
    // sweep's own identity (without it a consumer cannot tell its landing
    // from another dance's teardown).
    const landed: Array<{ sweep?: number }> = [];
    rig.bodyEl()!.addEventListener(SHEET_SWEEP_SETTLE_EVENT, (e) => {
      landed.push((e as CustomEvent<{ sweep?: number }>).detail ?? {});
    });
    for (let i = 0; i < 4; i += 1) {
      for (const cb of frames.splice(0)) cb(i * 16);
      await vi.advanceTimersByTimeAsync(60);
    }
    await vi.advanceTimersByTimeAsync(1200);
    expect(settled).toBeGreaterThan(0);
    expect(landed.length).toBeGreaterThan(0);
    expect(typeof landed[0]?.sweep).toBe("number");
  });

  it("publishes NOTHING when the sheet is capped and cannot fold", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubClip();
    // Content that already overflows the cap: the natural height cannot
    // change, so the morph stages no sweep at all — the flow must park
    // nothing (its span defaults to 0).
    stubBox(900, 596);
    const rig = await mountRig();
    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);

    const stages: unknown[] = [];
    let settled = 0;
    rig.bodyEl()!.addEventListener(SHEET_SWEEP_STAGE_EVENT, (e) => {
      stages.push((e as CustomEvent).detail);
    });
    rig.bodyEl()!.addEventListener(SHEET_SWEEP_SETTLE_EVENT, () => {
      settled += 1;
    });

    content = 850;
    rig.announceSwap({ delta: -50, durationMs: 150, phase: "enter" });
    await nextTick();
    await vi.advanceTimersByTimeAsync(1200);
    expect(stages).toEqual([]);
    expect(settled).toBe(0);
  });

  it("rides its chrome and registered descendants with the staged fold", async () => {
    // Round 14: the fold's clip edge must never slice the title. When a
    // sweep stages, the modal's chrome and content probe ride the edge,
    // and a descendant that registered through the sheet-ride registry
    // (the way HkStepFlow registers its entering body) rides as a
    // reveal COUNTER — staged at the mirrored negative offset.
    vi.useFakeTimers();
    freezeRaf();
    stubClip();
    stubBox(500, Number.POSITIVE_INFINITY);

    let registered = false;
    const Rider = defineComponent({
      setup() {
        const registry = useSheetRide();
        return () =>
          h("div", {
            class: "rider-el",
            ref: (el: unknown) => {
              const node = el as HTMLElement | null;
              if (node && registry && !registered) {
                registered = true;
                registry.register({ el: node, counter: true });
              }
            },
          }, "rider");
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(false);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            title: "ride-test",
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, {
            default: () => h("div", { class: "swap-body" }, [h(Rider)]),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    open.value = true;
    await vi.advanceTimersByTimeAsync(600);

    const frame = () => document.querySelector<HTMLElement>(".hk-modal-content")!;
    const header = () => document.querySelector<HTMLElement>(".hk-modal-header")!;
    const bodyBlock = () => document.querySelector<HTMLElement>(".hk-modal-body")!;
    const riderEl = () => document.querySelector<HTMLElement>(".rider-el")!;
    expect(registered).toBe(true);

    // The sweep needs real frames from here on.
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    // A GROW announced at the flow's exit edge: content 500 -> 700, so
    // the frame folds +200. The chrome rides at the pre-growth offset,
    // the registered counter at the mirrored negative.
    content = 700;
    document
      .querySelector<HTMLElement>(".hk-modal-body .swap-body")!
      .dispatchEvent(
        new CustomEvent(STEPFLOW_SWAP_EVENT, {
          bubbles: true,
          detail: { delta: 200, durationMs: 150, phase: "exit" },
        }),
      );
    await nextTick();
    expect(header().style.transform).toBe("translateY(200px)");
    expect(bodyBlock().style.transform).toBe("translateY(200px)");
    expect(riderEl().style.transform).toBe("translateY(-200px)");
    expect(header().style.willChange).toBe("transform");

    // Two warmup frames, then the sweep: everything flips to its target
    // under the mirrored transform transition.
    for (let i = 0; i < 2; i += 1) {
      for (const cb of frames.splice(0)) cb(i * 16);
      await vi.advanceTimersByTimeAsync(16);
    }
    expect(header().style.transform).toBe("translateY(0px)");
    expect(riderEl().style.transform).toBe("translateY(0px)");
    expect(header().style.transition).toMatch(/^transform 0\.3s /);

    // The landing releases the rides with the frame.
    const ev = new Event("transitionend");
    Object.defineProperty(ev, "propertyName", { value: "clip-path" });
    frame().dispatchEvent(ev);
    expect(header().style.transform).toBe("");
    expect(bodyBlock().style.transform).toBe("");
    expect(riderEl().style.transform).toBe("");
    expect(header().style.willChange).toBe("");
  });
});
