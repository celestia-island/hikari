import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";

/**
 * Source contract for the close-fold content hold (chest field report
 * 2026-09-16): consumers routinely tear down the state that feeds the
 * window's body in the same tick as the close (TodoLogModal's
 * clear-on-close watcher emptied a 697px conversation window to a 200px
 * stub BEFORE the fold started). While the machine is in a closing phase
 * HkModal serves the last live-rendered children, so the fold always
 * plays over the content the user was looking at.
 *
 * happy-dom has no transition engine, so the machine's duration probe
 * reads a stubbed 0.3s (same harness trick as the surface-machine tests)
 * and rAF is frozen — the flip timers drive the phase edges
 * deterministically.
 */
const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
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
  setLines: (lines: string[]) => void;
  closeWithTeardown: () => void;
  bodyText: () => string;
  frameEl: () => HTMLElement | null;
}

/** Mount HkModal behind a wrapper that models the chest clear-on-close
 *  pattern: the body state clears in the SAME handler that flips the
 *  v-model false. */
async function mountRig(initialLines: string[]): Promise<Rig> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(false);
  const lines = ref<string[]>(initialLines);

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          modelValue: open.value,
          closable: true,
          title: "hold-test",
          "onUpdate:modelValue": (v: boolean) => {
            open.value = v;
            // The reported chest pattern: destroy the content with the
            // close request, before any leave animation runs.
            if (!v) lines.value = [];
          },
        }, {
          default: () => h("div", lines.value.map((l, i) => h("p", { key: i }, l))),
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  return {
    open,
    setLines: (next: string[]) => { lines.value = next; },
    /** Faithful chest pattern: the store-watcher teardown runs in the SAME
     *  tick as the v-model flip, regardless of who flipped it — clearing
     *  only inside onUpdate:modelValue would miss programmatic closes and
     *  the test would pass vacuously (R1 finding: the hold was never
     *  exercised). */
    closeWithTeardown: () => {
      open.value = false;
      lines.value = [];
    },
    bodyText: () => document.querySelector(".hk-modal-body-inner")?.textContent ?? "",
    frameEl: () => document.querySelector<HTMLElement>(".hk-modal-content"),
  };
}

describe("HkModal close-fold content hold", () => {
  it("folds over the last live content even when the consumer clears state on close", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig(["alpha", "beta"]);

    // Open the surface to rest (flip timer 120ms + duration 300 + slack).
    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.bodyText()).toBe("alphabeta");

    // Close with the SAME-TICK teardown — this is the exact moment the
    // hold must earn its keep (without it the body blanks immediately).
    rig.closeWithTeardown();
    await vi.advanceTimersByTimeAsync(150); // mid-leave (past the flip)
    expect(rig.frameEl()).not.toBeNull();
    // THE contract: the fold plays over the ORIGINAL content — the
    // same-tick teardown must not blank the window mid-fold.
    expect(rig.bodyText()).toBe("alphabeta");

    // The leave settles and the DOM goes away with it.
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.frameEl()).toBeNull();
    expect(rig.bodyText()).toBe("");
  });

  it("a reopen interrupt drops the hold and serves live content again", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    const rig = await mountRig(["alpha", "beta"]);

    rig.open.value = true;
    await vi.advanceTimersByTimeAsync(600);
    const frameBeforeClose = rig.frameEl();

    // Close with the same-tick teardown, then interrupt mid-leave.
    rig.closeWithTeardown();
    await vi.advanceTimersByTimeAsync(150);
    expect(rig.bodyText()).toBe("alphabeta");

    // Reopen with FRESH content — the hold releases with the phase.
    rig.open.value = true;
    rig.setLines(["gamma"]);
    await vi.advanceTimersByTimeAsync(30);
    expect(rig.bodyText()).toBe("gamma");

    // …and the same element survives the reversal (no remount flash).
    expect(rig.frameEl()).toBe(frameBeforeClose);
    await vi.advanceTimersByTimeAsync(800);
    expect(rig.bodyText()).toBe("gamma");
    expect(rig.frameEl()).not.toBeNull();
  });
});
