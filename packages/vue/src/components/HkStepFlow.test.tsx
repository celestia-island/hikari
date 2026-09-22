import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkStepFlow, {
  SHEET_SWEEP_SETTLE_EVENT,
  SHEET_SWEEP_STAGE_EVENT,
  STEPFLOW_SWAP_EVENT,
} from "./HkStepFlow";
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
  /** Mount inside a modal body host (HkModal's scroll container), i.e. the
   *  host shape whose sheet publishes sweep spans. */
  sheetHost?: boolean;
  /** Span the simulated sheet publishes when it stages a fold. */
  sweepSpan?: { from: number; to: number } | null;
} = {}): StepFlowHarness {
  const container = document.createElement("div");
  if (options.sheetHost) {
    const body = document.createElement("div");
    body.className = "hk-modal-body";
    body.appendChild(container);
    document.body.appendChild(body);
    containers.push(body);
    // Stand in for the hosting modal: when the flow announces the enter
    // edge of a shrink, publish the fold span the sheet would publish.
    if (options.sweepSpan) {
      const span = options.sweepSpan;
      container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
        if ((e as CustomEvent).detail?.phase !== "enter") return;
        body.dispatchEvent(
          new CustomEvent(SHEET_SWEEP_STAGE_EVENT, {
            detail: { direction: "conceal", from: span.from, to: span.to },
          }),
        );
      });
    }
  } else {
    document.body.appendChild(container);
  }
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

/** Force the motion path: the duration probe sees a phase-length transition.
 *  `leavingOpacity` models how far an exit has run (the pre-emption fast
 *  path keys off a body that has already faded to nothing). */
function stubMotion(
  duration = "0.15s",
  opts: { leavingOpacity?: string } = {},
): void {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
      if (el instanceof HTMLElement && el.classList.contains("hk-stepflow-body")) {
        return {
          transitionDuration: duration,
          opacity: el.classList.contains("leaving")
            ? (opts.leavingOpacity ?? "1")
            : "1",
        } as CSSStyleDeclaration;
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
      // The stage's height is its in-flow body's (the leaving one is out of
      // flow) held up by its own pin, exactly as the browser resolves it —
      // the component reads it as the swap's "old" reference.
      if (this.classList?.contains("hk-stepflow-bodies")) {
        const inFlow = Array.from(this.children).find(
          (child) => !(child as HTMLElement).classList.contains("leaving"),
        ) as HTMLElement | undefined;
        const flowH = inFlow ? byText(inFlow.textContent ?? "") : 0;
        const pinned = Number.parseFloat(this.style.minHeight) || 0;
        return Math.max(pinned, flowH);
      }
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
    const stage = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    expect(stage?.style.minHeight).toBe("");
    // An in-flow stage (a non-modal host such as chest's LoginView) keeps
    // the default TOP anchor: its top line is the fixed one, so a bottom
    // anchor would push the old body down instead of holding it.
    expect(stage?.getAttribute("data-anchor")).toBeNull();
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

  it("holds a SHRINK, then parks the new body on the line the sheet lands on", async () => {
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 100 },
    });
    const events: CustomEvent[] = [];
    // What the hosting sheet would measure when it handles the announce:
    // the pin must be OFF at that instant (the sheet reads the frame's NEW
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

    // Enter edge: the sheet is told to fold, publishes its real span, and
    // the flow parks the new body exactly on the landing line.
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
    expect(pinAtAnnounce).toEqual([""]);
    expect(bodies?.style.minHeight).toBe("220px");
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("b-body");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);
    expect(active?.classList.contains("hk-stepflow-enter-tail")).toBe(true);
    expect(active?.style.top).toBe("120px");

    // The sheet's landing releases the parking and the pin together — not
    // the body's own fade (which would leave the frame clipped).
    t.container
      .closest(".hk-modal-body")!
      .dispatchEvent(new CustomEvent(SHEET_SWEEP_SETTLE_EVENT));
    await flushSwap();
    expect(bodies?.style.minHeight).toBe("");
    const settled = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(settled?.classList.contains("hk-stepflow-enter-tail")).toBe(false);
    expect(settled?.style.top).toBe("");
  });

  it("does not park anything when the sheet reports a zero span (capped box)", async () => {
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    // A capped sheet cannot fold: it publishes from == to. Parking against
    // a guessed delta instead cut 276px off the outgoing step (R2 finding).
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 220 },
    });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    expect(events.length).toBe(1);
    const bodies = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    // Nothing is held: the stage takes the new height immediately and the
    // new body fades in in place.
    expect(bodies?.style.minHeight).toBe("");
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.classList.contains("hk-stepflow-enter-tail")).toBe(false);
    expect(active?.style.top ?? "").toBe("");
  });

  it("releases a parked fold on the watchdog when the sheet never lands", async () => {
    // The enter-phase watchdog is load-bearing: a host that never publishes
    // its landing must not strand the pin and the parked body forever
    // (removing it survived the suite before this test existed).
    stubMotion("20ms");
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 100 },
    });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    const bodies = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    expect(bodies?.style.minHeight).toBe("220px");
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-tail"),
    ).toBe(true);
    // 20ms phase + 700ms tail grace, with no settle event at all.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(bodies?.style.minHeight).toBe("");
    const settled = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(settled?.classList.contains("hk-stepflow-enter-tail")).toBe(false);
    expect(settled?.style.top).toBe("");
  });

  it("ignores a stale phase watchdog from the previous swap", async () => {
    // endSwap must disarm the outgoing phase: a stale watchdog otherwise
    // tears the NEXT swap down 184ms early and clips its content (the
    // mutation that removes disarmPhase survived the suite before this).
    stubMotion("20ms");
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);

    // Let most of the settled swap's watchdog window pass, THEN start a
    // fresh swap: its own deadline lands at ~300ms + 370ms, while the
    // first swap's (now stale) timer is due at ~370ms — so a missing
    // disarm would advance the live swap roughly 300ms early.
    await new Promise((resolve) => setTimeout(resolve, 300));
    t.setCurrent("c");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 120));
    // The stale closer must not have ended the live swap early.
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    expect(leaving?.textContent).toBe("b-body");
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    endTransition(leaving);
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("c-body");
  });

  it("keeps the outgoing body on its pre-swap screen line by measurement", async () => {
    // The host decides where a growing box's lines sit, so the shift is
    // measured: this stubs the two rect reads the component performs (the
    // body before the patch and after it) and pins the inline offset.
    stubMotion();
    const rects = { active: 500, leaving: 380 };
    const proto = HTMLElement.prototype as unknown as {
      getBoundingClientRect: () => DOMRect;
    };
    const realRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      const top = this.classList.contains("hk-stepflow-body")
        ? this.classList.contains("leaving")
          ? rects.leaving
          : rects.active
        : 0;
      return { top, left: 0, bottom: top, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    try {
      const t = mountStepFlow({ initial: "a" });
      t.setCurrent("b");
      await flushSwap();
      const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
      expect(leaving?.style.top).toBe("120px");
    } finally {
      proto.getBoundingClientRect = realRect;
    }
  });

  it("never empties the queue when a pre-emption lands inside the fast-path frame", async () => {
    // The skipExit fast path drops its outgoing body and commits the new
    // one's staged state on the next bus frame. A navigation INSIDE that
    // frame used to re-enter the exit branch, drop the only remaining body
    // and leave the queue permanently empty (R3 audit finding L1). The
    // phase now flips to "enter" immediately and preemptSwap falls back to
    // endSwap when the body it names is already gone.
    stubMotion("0.15s", { leavingOpacity: "0" });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    // b is pending; swap again: the leaving body reads as fully faded, so
    // the new swap takes the fast path and queues its staging frame.
    t.setCurrent("c");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("c-body");

    // A change INSIDE that frame must not empty the queue…
    t.setCurrent("d");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBeGreaterThan(0);
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("d-body");
    // …and the swap still settles once the queued bus frame runs.
    for (const cb of frames.splice(0)) cb(0);
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    // Still navigable afterwards (the failure mode was permanent blankness).
    t.setCurrent("a");
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("a-body");
  });

  it("compensates the shift the sheet causes when it lands the new height", async () => {
    // The stage only moves when the HOST reacts to the handoff (a
    // bottom-docked sheet pins the new height the moment it is told), so
    // the shift must be measured AFTER the announce. Measuring before it
    // left the compensation at zero on exactly that surface and the
    // outgoing body rode the sheet's instant growth out of view (real
    // browser verification finding). This stub moves the leaving body only
    // once the swap event fires, so a pre-announce measurement reads zero.
    stubMotion();
    let leaveTop = 500;
    const proto = HTMLElement.prototype as unknown as {
      getBoundingClientRect: () => DOMRect;
    };
    const realRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      const top = this.classList.contains("hk-stepflow-body")
        ? this.classList.contains("leaving")
          ? leaveTop
          : 500
        : 0;
      return { top, left: 0, bottom: top, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    try {
      const t = mountStepFlow({ initial: "a" });
      t.container.addEventListener(STEPFLOW_SWAP_EVENT, () => {
        // What the sheet's instant pin does to the content: the stage jumps
        // up by the delta.
        leaveTop = 100;
      });
      t.setCurrent("b");
      await flushSwap();
      const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
      expect(leaving?.style.top).toBe("400px");
    } finally {
      proto.getBoundingClientRect = realRect;
    }
  });

  it("parks the new body too when a shrink takes the faded fast path", async () => {
    // The fast path IS the enter edge for a faded outgoing body, so a
    // shrink must run the same measurement + parking handshake there
    // instead of morphing in the exit slot (real-browser finding P5).
    stubMotion("0.15s", { leavingOpacity: "0" });
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 100 },
    });
    t.setCurrent("b");
    await flushSwap();
    // Swap again while the exiting body reads as fully faded: the new swap
    // drops it and goes straight to its enter edge — as a shrink.
    t.setCurrent("c");
    await flushSwap();
    // The staged frame commits the fade's "from" and applies the park.
    for (const cb of frames.splice(0)) cb(0);
    await flushSwap();
    const bodies = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("c-body");
    expect(active?.classList.contains("hk-stepflow-enter-tail")).toBe(true);
    expect(active?.style.top).toBe("120px");
    expect(bodies?.style.minHeight).toBe("220px");
  });

  it("keeps the outgoing body's measured line across a pre-emption", async () => {
    // F1a: the survivor is still on stage and the sheet is still at the
    // height it grew to, so its compensating offset must survive the
    // pre-emption and only be cleared when that swap ends (clearing it
    // teleported the visible body by the whole delta in one frame).
    stubMotion();
    let leaveTop = 500;
    const proto = HTMLElement.prototype as unknown as {
      getBoundingClientRect: () => DOMRect;
    };
    const realRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      const top = this.classList.contains("hk-stepflow-body")
        ? this.classList.contains("leaving")
          ? leaveTop
          : 500
        : 0;
      return { top, left: 0, bottom: top, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    try {
      const t = mountStepFlow({ initial: "a" });
      let announces = 0;
      t.container.addEventListener(STEPFLOW_SWAP_EVENT, () => {
        // The sheet pins its new height once; after that the layout does not
        // move again, so the second swap's own measurement reads zero and
        // ONLY a preserved offset can keep the body on its line.
        announces += 1;
        if (announces === 1) leaveTop = 100;
      });
      t.setCurrent("b");
      await flushSwap();
      const first = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
      expect(first?.style.top).toBe("400px");
      // Navigate again while that body is still exiting.
      t.setCurrent("c");
      await flushSwap();
      const survivor = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
      expect(survivor?.textContent).toBe("a-body");
      expect(survivor?.style.top).toBe("400px");
      // …and it is dropped with the swap, offset and all.
      endTransition(survivor);
      await flushSwap();
      endTransition(t.container.querySelector(".hk-stepflow-body.active"));
      await flushSwap();
      expect(t.container.querySelector(".hk-stepflow-body.active")?.textContent).toBe("c-body");
      expect(
        t.container.querySelector<HTMLElement>(".hk-stepflow-body.active")?.style.top ?? "",
      ).toBe("");
    } finally {
      proto.getBoundingClientRect = realRect;
    }
  });

  it("keeps the park when another surface publishes a landing", async () => {
    // The flow listens for landings on ITS host body only, so another
    // surface's settle cannot reach the park at all. (The two guard clauses
    // inside the listener — target and swap identity — are formally
    // redundant with that scoping and with disarmPhase; they are kept as
    // belt-and-braces and are not mutation-reachable.)
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 220 : 100));
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 100 },
    });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    const bodies = t.container.querySelector<HTMLElement>(".hk-stepflow-bodies");
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-tail"),
    ).toBe(true);
    expect(bodies?.style.minHeight).toBe("220px");

    const foreign = document.createElement("div");
    foreign.className = "hk-modal-body";
    document.body.appendChild(foreign);
    containers.push(foreign);
    foreign.dispatchEvent(new CustomEvent(SHEET_SWEEP_SETTLE_EVENT));
    await flushSwap();
    expect(bodies?.style.minHeight).toBe("220px");
    expect(
      t.container
        .querySelector<HTMLElement>(".hk-stepflow-body.active")
        ?.classList.contains("hk-stepflow-enter-tail"),
    ).toBe(true);
  });

  it("measures a pre-empted swap against the stage the sheet is pinned to", async () => {
    // F1b: the stage still carries the DROPPED pending body's height (that is
    // what the sheet pinned itself to), so a body-based delta reads the
    // shorter survivor, mis-signs as a grow, and skips the park handshake —
    // leaving the new body unparked under a running fold.
    stubMotion();
    stubHeights((text) => (text === "b-body" ? 220 : 100));
    const t = mountStepFlow({
      initial: "a",
      sheetHost: true,
      sweepSpan: { from: 220, to: 100 },
    });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    // Second navigation mid-exit (the survivor is NOT faded): the ordinary
    // exit → enter path, with the stage's pin still standing.
    t.setCurrent("c");
    await flushSwap();
    // Only the first swap's grow announcement so far: a shrink announces at
    // its enter edge.
    expect(events.length).toBe(1);
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    expect(events.length).toBe(2);
    const detail = events[1]!.detail as { delta: number; phase: string };
    expect(detail.delta).toBe(-120);
    expect(detail.phase).toBe("enter");
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.classList.contains("hk-stepflow-enter-tail")).toBe(true);
    expect(active?.style.top).toBe("120px");
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

  it("keeps the visible body on stage when a re-swap pre-empts the exit phase", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    // b is still pending (invisible); swap again mid-exit.
    t.setCurrent("c");
    await flushSwap();
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    // The body the user is looking at keeps leaving; the never-painted one
    // is dropped (promoting it blanked the stage for 134ms).
    expect(leaving?.textContent).toBe("a-body");
    expect(leaving?.classList.contains("hk-stepflow-leave-to")).toBe(true);
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
