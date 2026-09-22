import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkStepFlow, { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";
import type { StepFlowSlotProps } from "./HkStepFlow";

/**
 * HkStepFlow contract tests. House style: no @vue/test-utils dependency —
 * raw createApp mounts on shared containers torn down after each case.
 *
 * Two environment shapes are exercised:
 *
 * - DEFAULT (happy-dom, no stylesheet): the component's duration probe
 *   reads a zero transition duration, so every swap settles INSTANTLY —
 *   one body in the DOM, no timers to outlive, no transitionend to wait
 *   for. This is the deterministic shape chest's wizard tests rely on.
 * - MOTION STUBBED (`getComputedStyle` reports the PHASE duration): the
 *   two-phase choreography runs — the exit phase keeps only the old body
 *   visible (`hk-stepflow-leave-to`) while the new one is mounted but
 *   `hk-stepflow-enter-pending`, then the enter phase drops the old body
 *   and fades the new one in place. The phases advance on the acting
 *   body's own transitionend or the duration+grace watchdog.
 */

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

const STEPS = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
  { key: "c", label: "Gamma" },
  { key: "d", label: "Delta" },
];

interface StepFlowHarness {
  container: HTMLElement;
  setCurrent: (key: string) => void;
}

function mountStepFlow(options: {
  initial?: string;
  hideTimeline?: boolean;
  timelineClickable?: boolean;
  collapse?: string;
  seen?: StepFlowSlotProps[];
} = {}): StepFlowHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const current = ref(options.initial ?? "a");
  const Wrapper = defineComponent({
    setup() {
      const slotBodies: Record<string, (arg: StepFlowSlotProps) => unknown> = {};
      for (const s of STEPS) {
        slotBodies[s.key] = (arg: StepFlowSlotProps) => {
          options.seen?.push(arg);
          return h("p", { class: "step-body" }, `${s.key}-body`);
        };
      }
      return () =>
        h(HkStepFlow, {
          steps: STEPS,
          modelValue: current.value,
          hideTimeline: options.hideTimeline ?? false,
          timelineClickable: options.timelineClickable ?? false,
          collapse: (options.collapse ?? "auto") as never,
          "onUpdate:modelValue": (key: string) => { current.value = key; },
        }, slotBodies);
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, setCurrent: (key) => { current.value = key; } };
}

/** Let the swap watch's async flush (post render + internal nextTick) land. */
async function flushSwap(): Promise<void> {
  await nextTick();
  await nextTick();
  await nextTick();
}

/** Wait past the watchdog of ONE phase (duration + 350ms grace). */
async function outlivePhase(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 430));
}

/** Outlive BOTH phases' watchdogs. */
async function outliveSwap(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 900));
}

/** Force the motion path: the duration probe sees a phase-length transition. */
function stubMotion(duration = "0.15s"): void {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
      if (el instanceof HTMLElement && el.classList.contains("hk-stepflow-body")) {
        return { transitionDuration: duration } as CSSStyleDeclaration;
      }
      return real(el, pseudoElt ?? undefined);
    },
  );
}

/** happy-dom reports every box as 0px tall and never transitions, so the
 *  choreography's grow/shrink branches and its phase edges are driven here
 *  explicitly: heights by body text, edges by synthesized transitionend. */
const realOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);

function stubHeights(byText: (text: string) => number): void {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList?.contains("hk-stepflow-body")
        ? byText(this.textContent ?? "")
        : 0;
    },
  });
}

function restoreHeights(): void {
  if (realOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", realOffsetHeight);
  }
}

/** Fire the transitionend a real engine would send for this element. */
function endTransition(el: Element | null | undefined): void {
  if (!el) throw new Error("endTransition: element missing");
  el.dispatchEvent(new Event("transitionend", { bubbles: true }));
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreHeights();
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkStepFlow", () => {
  it("renders the timeline header bound to modelValue plus the slotted body", () => {
    const t = mountStepFlow({ initial: "b" });
    const header = t.container.querySelector(".hk-timeline");
    expect(header).not.toBeNull();
    expect(header?.querySelector('[data-el="label"]')?.textContent).toBe("Alpha");
    expect(
      t.container.querySelector(".hk-timeline-step[aria-current='step'] [data-el='label']")
        ?.textContent,
    ).toBe("Beta");
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("b-body");
  });

  it("hides the timeline header with hideTimeline while keeping the body", () => {
    const t = mountStepFlow({ hideTimeline: true });
    expect(t.container.querySelector(".hk-timeline")).toBeNull();
    expect(t.container.querySelector(".hk-step-flow")).not.toBeNull();
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("a-body");
  });

  it("swaps the named-slot content per step key", async () => {
    const t = mountStepFlow({ initial: "a" });
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("a-body");
    t.setCurrent("d");
    await flushSwap();
    // Stylesheet-less runtime → instant settle: exactly one body, the new
    // step's, with no leaving residue and no timers to outlive.
    const bodies = t.container.querySelectorAll(".hk-stepflow-body");
    expect(bodies.length).toBe(1);
    expect(bodies[0]!.className).toBe("hk-stepflow-body active");
    expect(bodies[0]!.textContent).toBe("d-body");
  });

  it("settles deterministically to a single body where no transition runs", async () => {
    // The 2026-09-22 debt pin: chest's LoginView MFA suite broke because
    // the crossfade kept a leaving body alive for hundreds of ms in
    // transitionend-less environments. With a zero probed duration the
    // swap is atomic — the DOM NEVER carries two steps.
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("b-body");
    expect(t.container.querySelector(".hk-stepflow-body.leaving")).toBeNull();
    // Rapid successive swaps stay single-bodied the whole way through.
    t.setCurrent("c");
    await flushSwap();
    t.setCurrent("d");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("d-body");
    // The sheet passthrough fired for every swap, carrying a numeric delta.
    expect(events.length).toBe(3);
    for (const e of events) {
      expect(typeof (e.detail as { delta: number }).delta).toBe("number");
    }
  });

  it("passes key/index/direction to scoped slots across navigation", async () => {
    const seen: StepFlowSlotProps[] = [];
    const t = mountStepFlow({ initial: "a", seen });
    expect(seen.map((s) => `${s.key}:${s.index}:${s.direction}`)).toEqual(["a:0:forward"]);

    t.setCurrent("c");
    await flushSwap();
    expect(seen.at(-1)).toEqual({ key: "c", index: 2, direction: "forward" });

    t.setCurrent("b");
    await flushSwap();
    expect(seen.at(-1)).toEqual({ key: "b", index: 1, direction: "back" });

    // Returning forward again flips the direction back.
    t.setCurrent("d");
    await flushSwap();
    expect(seen.at(-1)?.direction).toBe("forward");
  });

  it("emits update:modelValue when a clickable completed step is selected", async () => {
    const selected: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const current = ref("c");
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(HkStepFlow, {
            steps: STEPS,
            modelValue: current.value,
            timelineClickable: true,
            "onUpdate:modelValue": (key: string) => { selected.push(key); current.value = key; },
          }, {
            c: () => h("p", "C-body"),
            b: () => h("p", "B-body"),
          });
      },
    }));
    mounts.push(app);
    app.mount(container);

    // Full-row mode with plenty of room: click the first completed step.
    const first = container.querySelector(".hk-timeline-step[data-clickable]") as HTMLElement;
    expect(first?.getAttribute("data-status")).toBe("completed");
    first.dispatchEvent(new MouseEvent("click"));
    await nextTick();
    await flushSwap();
    expect(selected).toEqual(["a"]);
    expect(container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("");
  });

  it("renders an empty body without warnings for an unknown key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const t = mountStepFlow({ initial: "a" });
      t.setCurrent("does-not-exist");
      await nextTick();
      await flushSwap();
      const body = t.container.querySelector(".hk-stepflow-body.active");
      expect(body).not.toBeNull();
      expect(body?.textContent).toBe("");
      expect(warnSpy.mock.calls.some((args) => String(args[0]).includes("Slot"))).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("pins the collapse option onto the header timeline", () => {
    const t = mountStepFlow({ collapse: "always" });
    // Four steps with collapse=always must render the window (compact) form.
    expect(t.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("window");
    const bare = mountStepFlow({ collapse: "never" });
    expect(bare.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("full");
  });

  it("resyncs the direction memory when the steps array is swapped in place", async () => {
    const seen: StepFlowSlotProps[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const current = ref("a");
    const steps = ref(STEPS.map((s) => ({ ...s })));
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(HkStepFlow, {
            steps: steps.value,
            modelValue: current.value,
            "onUpdate:modelValue": (key: string) => { current.value = key; },
          }, Object.fromEntries(steps.value.map((s) => [
            s.key,
            (arg: StepFlowSlotProps) => { seen.push(arg); return h("p", `${s.key}-body`); },
          ])));
      },
    }));
    mounts.push(app);
    app.mount(container);

    // Swap the array (same current key) — e.g. a locale switch rebuilding it.
    steps.value = [...steps.value].reverse().map((s) => ({ ...s }));
    await nextTick();

    // Discriminating case: WITHOUT the resync watch the remembered index
    // stays 0 ("a"'s pre-swap slot); landing on "c" (now index 1) would then
    // compare 1 < 0 and mislabel the move FORWARD. With the resync the
    // remembered index follows the array to 3, so 1 < 3 correctly reads BACK.
    current.value = "c";
    await nextTick();
    await flushSwap();
    expect(seen.at(-1)).toEqual({ key: "c", index: 1, direction: "back" });
  });
});

// ── Motion-stubbed two-phase choreography ─────────────────────────────
// `getComputedStyle` reports the PHASE duration for step bodies, so the
// full two-phase swap runs: the exit phase keeps only the old body
// visible (sliding out) with the new one mounted but invisible, then the
// enter phase drops the old body and fades the new one in place. Phases
// advance on the acting body's transitionend or the watchdog.
describe("HkStepFlow two-phase swap (motion enabled)", () => {
  it("keeps the new body invisible through the exit phase", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();

    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(leaving?.textContent).toBe("a-body");
    expect(pending?.textContent).toBe("b-body");
    // The old body carries its end state from the swap patch itself; the
    // new one is mounted (so the flow owns the new height) but staged
    // invisible — the two can never be on screen together.
    expect(leaving?.classList.contains("hk-stepflow-leave-to")).toBe(true);
    expect(pending?.classList.contains("hk-stepflow-enter-pending")).toBe(true);
    expect(t.container.querySelector(".hk-stepflow-enter-from")).toBeNull();
    expect(
      t.container.querySelector(".hk-stepflow-bodies")?.getAttribute("data-direction"),
    ).toBe("forward");
    // happy-dom heights read 0 → the GROW edge: the sheet hears about the
    // new geometry while the old body is still leaving.
    expect(events.length).toBe(1);
    expect((events[0]!.detail as { phase: string }).phase).toBe("exit");
    expect((events[0]!.detail as { durationMs: number }).durationMs).toBe(150);

    // Enter edge: the old body goes, the new one is revealed in place.
    endTransition(leaving);
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("b-body");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);

    // The enter phase's own end settles the swap; a grow announces once.
    endTransition(active);
    await flushSwap();
    expect(events.length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body")?.className).toBe(
      "hk-stepflow-body active",
    );
  });

  it("finishes a GROW through the exit phase and never pins the flow", async () => {
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 100 : 220));
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    expect(events.length).toBe(1);
    expect((events[0]!.detail as { delta: number }).delta).toBe(120);
    expect(
      t.container.querySelector<HTMLElement>(".hk-stepflow-bodies")?.style.minHeight,
    ).toBe("");
    // A grow never parks the new body in the tail band and never pins: the
    // flow owns the new height from frame one.
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-tail"),
    ).toBe(false);
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    // No second announcement: the sheet already owns the new geometry.
    expect(events.length).toBe(1);
  });

  it("holds a SHRINK through the exit phase, then folds at the enter edge", async () => {
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    // What the hosting sheet would measure when it handles the announce:
    // the pin must be OFF at that instant (the modal reads the frame's NEW
    // natural height) and back ON immediately after.
    const pinAtAnnounce: string[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
      pinAtAnnounce.push(
        (t.container.querySelector<HTMLElement>(".hk-stepflow-bodies")?.style
          .minHeight) ?? "missing",
      );
    });
    t.setCurrent("b");
    await flushSwap();
    // Exit phase: nothing morphs yet — the old body plays at its own
    // height (the flow is pinned so the sheet cannot fold under it).
    expect(events.length).toBe(0);
    const bodies = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    expect(bodies?.style.minHeight).toBe("220px");
    // Enter edge: the sheet is told to fold now, and the flow re-pins its
    // OLD height for the fold while the new body parks in the stage's
    // bottom band — the band the descending clip edge lands on, so the new
    // content already sits at its final geometry.
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    expect(events.length).toBe(1);
    const detail = events[0]!.detail as {
      delta: number;
      durationMs: number;
      phase: string;
    };
    expect(detail.delta).toBe(-120);
    expect(detail.phase).toBe("enter");
    expect(detail.durationMs).toBe(150);
    expect(bodies?.style.minHeight).toBe("220px");
    // …and the measurement window really was open at the announce.
    expect(pinAtAnnounce).toEqual([""]);
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("b-body");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);
    expect(active?.classList.contains("hk-stepflow-enter-tail")).toBe(true);

    // The fold's own end releases both the tail parking and the pin.
    endTransition(active);
    await flushSwap();
    expect(bodies?.style.minHeight).toBe("");
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-tail"),
    ).toBe(false);
  });

  it("advances both phases on the watchdog when transitionend never arrives", async () => {
    stubMotion("20ms");
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    // Phase-1 watchdog (20ms + 350ms grace).
    await outlivePhase();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-pending"),
    ).toBe(false);
    // Phase-2 watchdog settles the swap entirely.
    await outlivePhase();
    expect(t.container.querySelector(".hk-stepflow-body")?.className).toBe(
      "hk-stepflow-body active",
    );
  });

  it("mirrors the direction attribute for back navigation", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "c" });
    t.setCurrent("a");
    await flushSwap();
    expect(
      t.container.querySelector(".hk-stepflow-bodies")?.getAttribute("data-direction"),
    ).toBe("back");
    expect(
      t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving")?.textContent,
    ).toBe("c-body");
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-pending"),
    ).toBe(true);
    await outliveSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
  });

  it("promotes a still-hidden body when a re-swap pre-empts the exit phase", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    // b is still pending (the exit phase is running); swap again.
    t.setCurrent("c");
    await flushSwap();
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    // The pre-empted target becomes the leaving body — it is never left
    // hidden, and only one body ever leaves.
    expect(leaving?.textContent).toBe("b-body");
    expect(leaving?.classList.contains("hk-stepflow-leave-to")).toBe(true);
    expect(leaving?.classList.contains("hk-stepflow-enter-pending")).toBe(false);
    expect(pending?.textContent).toBe("c-body");
    expect(pending?.classList.contains("hk-stepflow-enter-pending")).toBe(true);
    endTransition(leaving);
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("c-body");
  });

  it("pre-empts a swap during the enter phase without stranding a body", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    // Enter phase running (b is fading in place); swap to c mid-fade.
    t.setCurrent("c");
    await flushSwap();
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(leaving?.textContent).toBe("b-body");
    expect(pending?.textContent).toBe("c-body");
    expect(pending?.classList.contains("hk-stepflow-enter-pending")).toBe(true);
    await outliveSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("c-body");
  });
});

// ── Sticky-header pin strategy resolution (2026-09-14 scroll-pin wave) ──
// The timeline root rides HkScrollPin's contract; the strategy must flip
// to "offset" when the nearest host paints its gutters (data-pad-cover,
// HkModal) and stay "bleed" under a plain host. Behavioral, not
// tautological: happy-dom resolves the attribute scan fine (no custom
// properties involved).
describe("HkStepFlow sticky-header pin strategy", () => {
  async function mountWithHost(hostAttrs: Record<string, string> | null) {
    const container = document.createElement("div");
    const host = document.createElement("div");
    host.className = "hk-scroll-pin-host";
    for (const [k, v] of Object.entries(hostAttrs ?? {})) host.setAttribute(k, v);
    host.appendChild(container);
    document.body.appendChild(host);
    containers.push(host);
    const current = ref("a");
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkStepFlow, {
            steps: STEPS,
            modelValue: current.value,
            stickyHeader: true,
            "onUpdate:modelValue": (key: string) => { current.value = key; },
          }, { a: () => h("p", "a"), b: () => h("p", "b"), c: () => h("p", "c"), d: () => h("p", "d") });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    mounts.push(app);
    // Resolution runs onMounted; the flip lands one flush later.
    await nextTick();
    await nextTick();
    return container.querySelector<HTMLElement>(".hk-timeline");
  }

  it("resolves offset under a cover host (HkModal-style)", async () => {
    const tl = await mountWithHost({ "data-pad-cover": "", "data-scroll-axis": "vertical" });
    expect(tl!.dataset.strategy).toBe("offset");
    expect(tl!.dataset.side).toBe("top");
    expect(tl!.classList.contains("hk-scroll-pin")).toBe(true);
  });

  it("keeps bleed under a plain host", async () => {
    const tl = await mountWithHost({ "data-scroll-axis": "vertical" });
    expect(tl!.dataset.strategy).toBe("bleed");
  });
});
