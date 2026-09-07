import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const here = join(dirname(fileURLToPath(import.meta.url)));

/** Freeze rAF entirely: Vue's <Transition> engine double-raf's the
 *  leave-from → leave-to class flip before it even arms its
 *  transitionend wait, so a frozen rAF reproduces the occluded-webview
 *  pathology exactly — the leave can NEVER complete on its own and only
 *  the component's watchdog can finalize it. */
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
  return { open, afterLeaveEvents };
}

describe("HkModal leave-completion watchdog", () => {
  // Regression for the field-reported frozen modal (2026-09): with rAF
  // starved, the Transition leave can never complete on its own and the
  // panel used to stay over the page forever — undismissable, only a
  // full reload escaped it. The watchdog must finalize within its
  // budget, unmount both surface layers, and emit afterLeave exactly
  // the way a real transition would.
  it("force-finalizes a stalled leave within the deadline budget", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { open, afterLeaveEvents } = await mountOpenModal();
    expect(document.querySelector(".hk-modal-content")).not.toBeNull();

    open.value = false;
    await nextTick();
    // Past the machine's deadline budget the surface must be gone even
    // though not a single frame or transitionend ever arrived — the
    // timer column alone finalizes the leave (environments with live
    // CSS durations exercise the full window; without them the probe
    // completes even sooner — the property is the BOUND).
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(document.querySelector(".hk-modal-overlay")).toBeNull();
    expect(afterLeaveEvents).toHaveLength(1);
  });

  // The finalize flag must reset on reopen: without the reset a second
  // close after a forced first finalize would be a no-op and the modal
  // would freeze open forever instead.
  // Vue resolves an OPEN-INTERRUPTED leave without a cancelled flag: a
  // reopen patching over a still-live leave fires the old leave's
  // onAfterLeave. The finalize must bail out while the surface is open
  // again, or the stale completion kills the freshly reopened modal
  // (unregisters its handle, unmounts the panel, emits a spurious
  // afterLeave).
  it("ignores a stale leave completion firing during reopen", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { open, afterLeaveEvents } = await mountOpenModal();

    open.value = false;
    await nextTick();
    // Reopen while the leave is still live (before any deadline timer
    // fires) — the reopen patches over the in-flight close.
    open.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700); // past every budget
    await nextTick();
    // The reopened modal must survive both the stale onAfterLeave and
    // the (disarmed) watchdog from the aborted close.
    expect(document.querySelector(".hk-modal-content")).not.toBeNull();
    expect(afterLeaveEvents).toHaveLength(0);

    // And the surface still closes normally afterwards.
    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(afterLeaveEvents).toHaveLength(1);
  });

  it("re-arms across open/close cycles after a forced finalize", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { open, afterLeaveEvents } = await mountOpenModal();

    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(afterLeaveEvents).toHaveLength(1);

    open.value = true;
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).not.toBeNull();

    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(afterLeaveEvents).toHaveLength(2);
  });

  // On a healthy surface (real rAF, no transitionend needed — happy-dom
  // reports no CSS transitions so Vue completes instantly) the real
  // path owns finalization and the watchdog is a silent no-op: exactly
  // one afterLeave per close, no duplicates from the pending timer.
  it("leaves normal completion to the Transition engine without double-emitting", async () => {
    vi.useFakeTimers();
    const { open, afterLeaveEvents } = await mountOpenModal();

    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(document.querySelector(".hk-modal-content")).toBeNull();
    expect(afterLeaveEvents).toHaveLength(1);

    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    await nextTick();
    expect(afterLeaveEvents).toHaveLength(2);
  });

  // Contract pin: the lifecycle machine owns finalization now. Its
  // layer budgets must stay ≥ the themed CSS durations
  // (--hk-modal-duration defaults to 0.3s; a theme may raise it) — a
  // refactor that shrinks a budget under the CSS timing would cut the
  // leave short, and one that drops the machine wiring re-opens the
  // frozen-modal failure mode.
  it("pins the machine wiring and deadline budgets in the source", () => {
    const src = readFileSync(join(here, "HkModal.tsx"), "utf-8");
    expect(src).toContain("useSurfaceMachine({");
    expect(src).toContain('{ prefix: "hk-modal-overlay", el: () => overlayEl.value, enterMs: () => 320, leaveMs: () => 340 }');
    expect(src).toContain('{ prefix: "hk-modal-content", el: () => contentRef.value, enterMs: () => 320, leaveMs: () => 300 }');
    expect(src).toContain("onAfterLeaveFinalize();");
  });
});
