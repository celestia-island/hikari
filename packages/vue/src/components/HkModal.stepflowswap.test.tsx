import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";

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
