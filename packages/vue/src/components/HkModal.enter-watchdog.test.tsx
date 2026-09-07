import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Freeze rAF entirely — Vue's <Transition> engine double-raf's the
 *  enter-from → enter-to class flip, so a frozen rAF reproduces the
 *  occluded-webview pathology exactly: the enter can NEVER complete on
 *  its own, the from-pair (opacity: 0 / translateY(100%)) freezes on the
 *  layer, and only the enter watchdog can repair it. Mirror of the
 *  leave-completion test's freezeRaf. */
function freezeRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0 as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

/** Mount an open modal wired to an `open` ref we can flip from the test. */
async function mountOpenModal() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(true);
  const afterLeaveEvents: number[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          modelValue: open.value,
          closable: true,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          onAfterLeave: () => { afterLeaveEvents.push(1); },
        }, { default: () => h("div", "content") });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();
  return {
    open,
    afterLeaveEvents,
    unmount: () => { app.unmount(); },
  };
}

describe("HkModal enter-class watchdog", () => {
  // Regression for the 2026-09 mobile report: a starved enter froze the
  // scrim's enter-from pair (opacity: 0) while the panel stayed open —
  // the dim curtain vanished, and the eventual close flashed it back at
  // full opacity (the "black rectangle"). The watchdog must strip the
  // stuck classes on BOTH layers within its budget while the modal stays
  // open and functional.
  it("strips frozen enter classes on overlay and content within the budget", async () => {
    vi.useFakeTimers();
    freezeRaf();
    await mountOpenModal();

    const overlay = document.querySelector<HTMLElement>(".hk-modal-overlay");
    const content = document.querySelector<HTMLElement>(".hk-modal-content");
    expect(overlay).not.toBeNull();
    expect(content).not.toBeNull();
    // The frozen enter left its from-pair on both layers.
    expect(overlay!.classList.contains("hk-modal-overlay-enter-from")).toBe(true);
    expect(content!.classList.contains("hk-modal-content-enter-from")).toBe(true);

    // Past every budget both layers rest at their open state — no
    // frozen classes survive. (Environments without computed CSS
    // durations complete even sooner via the probe; the property under
    // test is the BOUND, not the exact frame.)
    await vi.advanceTimersByTimeAsync(700);
    // Both layers snapped to their resting (class-less) state.
    expect(overlay!.className).toBe("hk-modal-overlay");
    expect(content!.className).toBe("hk-modal-content");
    // …and the surface is still open and intact.
    expect(document.querySelector(".hk-modal-content")).not.toBeNull();
  });

  it("leaves a healthy enter untouched (watchdog disarmed on completion)", async () => {
    // Real rAF: the enter completes on its own, the after-enter disarms
    // the watchdog, and no strip ever fires past the budget.
    vi.useFakeTimers();
    await mountOpenModal();
    await vi.advanceTimersByTimeAsync(700);

    const overlay = document.querySelector<HTMLElement>(".hk-modal-overlay");
    expect(overlay).not.toBeNull();
    expect(Array.from(overlay!.classList).some((c) => c.startsWith("hk-modal-overlay-"))).toBe(
      false,
    );
  });

  it("a repaired modal still closes normally afterwards", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { open } = await mountOpenModal();
    await vi.advanceTimersByTimeAsync(700);
    expect(document.querySelector(".hk-modal-content")).not.toBeNull();

    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(document.querySelector(".hk-modal-overlay")).toBeNull();
  });
});

describe("HkModal teardown during the leave window", () => {
  // The machine's UNMOUNT edge walks closing* → closed; that must be a
  // TEARDOWN, never a finalized leave — afterLeave/focus-restore belong
  // to the close lifecycle (the machine's unmount hook runs before this
  // component's onBeforeUnmount flips the `unmounted` guard).
  it("does not emit afterLeave when unmounted mid-close", async () => {
    vi.useFakeTimers();
    const rig = await mountOpenModal();
    await vi.advanceTimersByTimeAsync(700); // at open rest
    expect(rig.afterLeaveEvents).toHaveLength(0);

    rig.open.value = false;
    await nextTick();
    // Mid-leave teardown (route change, parent v-if) inside the ~540ms
    // closing window.
    rig.unmount();
    expect(rig.afterLeaveEvents).toHaveLength(0);
  });
});

describe("HkModal enter-class watchdog across an interrupted leave", () => {
  // The exact field-report sequence (2026-09-07 recording, f108-f112):
  // the modal started closing (scrim fading out), a reopen patched over
  // the still-live leave on the SAME element, and rAF starvation froze
  // the re-enter's from-pair — the scrim stayed invisible for seconds
  // and the eventual close flashed it back at full opacity. The
  // watchdog must repair both layers of the reopened surface.
  it("repairs a reopen that froze mid-re-enter on the same element", async () => {
    vi.useFakeTimers();
    // Phase 1: open with WORKING rAF so the initial enter completes.
    const { open } = await mountOpenModal();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();

    // Phase 2: starve rAF, start a close, and reopen on the microtask
    // boundary — the leave deadline cannot have fired yet, so the
    // reopen patches over the still-live leave (the recording's
    // f108-f112 churn).
    freezeRaf();
    open.value = false;
    await nextTick();
    open.value = true;
    await nextTick();

    const overlay = document.querySelector<HTMLElement>(".hk-modal-overlay")!;
    const content = document.querySelector<HTMLElement>(".hk-modal-content")!;
    expect(overlay).not.toBeNull();
    expect(content).not.toBeNull();

    // Past every budget the surface rests fully open with no frozen
    // classes — repaired, and closing afterwards runs a NORMAL leave
    // (fade from visible) instead of the full-opacity pop.
    await vi.advanceTimersByTimeAsync(700);
    expect(overlay.className).toBe("hk-modal-overlay");
    expect(content.className).toBe("hk-modal-content");
    // The surface is still open, and closing it afterwards runs a NORMAL
    // leave (fade from visible) instead of the full-opacity pop.
    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(document.querySelector(".hk-modal-overlay")).toBeNull();
  });
});
