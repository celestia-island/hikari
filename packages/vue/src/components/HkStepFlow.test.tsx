import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, onMounted, ref } from "vue";

import HkStepFlow, { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";
import type { StepFlowSlotProps } from "./HkStepFlow";

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

async function flushSwap(): Promise<void> {
  await nextTick();
  await nextTick();
  await nextTick();
}

/** Drive the enter phase to its RECYCLE edge (real timers): the enter
 *  edge releases the fade, then the leaving body is recycled a share
 *  later (0.9 − 0.65 of a 150ms phase ≈ 38ms). */
async function settleEnter(): Promise<void> {
  await flushSwap();
  await new Promise((resolve) => setTimeout(resolve, 45));
  await flushSwap();
}

async function outlivePhase(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 430));
}

function stubMotion(
  duration = "0.15s",
  opts: { leavingOpacity?: string } = {},
): (next: string) => void {
  const real = window.getComputedStyle.bind(window);
  let current = duration;
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
      if (el instanceof HTMLElement && el.classList.contains("hk-stepflow-body")) {
        return {
          transitionDuration: current,
          opacity: el.classList.contains("leaving")
            ? (opts.leavingOpacity ?? "1")
            : "1",
        } as CSSStyleDeclaration;
      }
      return real(el, pseudoElt ?? undefined);
    },
  );
  return (next: string) => { current = next; };
}

const realOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);

function stubHeights(byText: (text: string) => number): void {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList?.contains("hk-stepflow-bodies")) {
        const inFlow = Array.from(this.children).find(
          (child) => !(child as HTMLElement).classList.contains("leaving"),
        ) as HTMLElement | undefined;
        return inFlow ? byText(inFlow.textContent ?? "") : 0;
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

function endTransition(el: Element | null | undefined): void {
  if (!el) throw new Error("endTransition: element missing");
  // Real engines always carry propertyName on transitionend; the phase
  // closers guard on it (a riding body's transform leg fires its own).
  const ev = new Event("transitionend", { bubbles: true });
  Object.defineProperty(ev, "propertyName", { value: "opacity" });
  el.dispatchEvent(ev);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  restoreHeights();
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkStepFlow", () => {
  it("renders the timeline header bound to modelValue plus the slotted body", () => {
    const t = mountStepFlow({ initial: "b" });
    expect(t.container.querySelector(".hk-timeline")).not.toBeNull();
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("b-body");
  });

  it("swaps the named-slot content per step key (instant path)", async () => {
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("d");
    await flushSwap();
    const bodies = t.container.querySelectorAll(".hk-stepflow-body");
    expect(bodies.length).toBe(1);
    expect(bodies[0]!.className).toBe("hk-stepflow-body active");
    expect(bodies[0]!.textContent).toBe("d-body");
  });

  it("settles deterministically to a single body where no transition runs", async () => {
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    t.setCurrent("c");
    await flushSwap();
    t.setCurrent("d");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(events.length).toBe(3);
    for (const e of events) {
      expect(typeof (e.detail as { delta: number }).delta).toBe("number");
    }
  });

  it("passes key/index/direction to scoped slots across navigation", async () => {
    const seen: StepFlowSlotProps[] = [];
    const t = mountStepFlow({ initial: "a", seen });
    t.setCurrent("c");
    await flushSwap();
    expect(seen.at(-1)).toEqual({ key: "c", index: 2, direction: "forward" });
    t.setCurrent("b");
    await flushSwap();
    expect(seen.at(-1)).toEqual({ key: "b", index: 1, direction: "back" });
  });

  it("pins the collapse option onto the header timeline", () => {
    const t = mountStepFlow({ collapse: "always" });
    expect(t.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("window");
  });
});

describe("HkStepFlow focus handoff on swap", () => {
  /** Mount with an input in `b`; `a` optionally autofocuses its own field
   *  the moment the entering body mounts. */
  function mountFocusRig(options: {
    initial: string;
    autoFocusEntry?: boolean;
    hideTimeline?: boolean;
    timelineClickable?: boolean;
  }): { container: HTMLElement; setCurrent: (key: string) => void } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const current = ref(options.initial);
    const AutoField = defineComponent({
      setup() {
        const el = ref<HTMLInputElement | null>(null);
        onMounted(() => el.value?.focus());
        return () => h("input", { ref: el, class: "auto-input" });
      },
    });
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(
            HkStepFlow,
            {
              steps: STEPS,
              modelValue: current.value,
              hideTimeline: options.hideTimeline ?? true,
              timelineClickable: options.timelineClickable ?? false,
              "onUpdate:modelValue": (key: string) => { current.value = key; },
            },
            {
              a: () =>
                options.autoFocusEntry
                  ? h(AutoField)
                  : h("p", { class: "step-body" }, "a-body"),
              b: () => h("input", { class: "step-input" }),
              c: () => h("p", { class: "step-body" }, "c-body"),
              d: () => h("p", { class: "step-body" }, "d-body"),
            },
          );
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return { container, setCurrent: (key) => { current.value = key; } };
  }

  it("drops focus out of the leaving body when an animated swap starts", async () => {
    // Round-22 chest report: the leaving body keeps its DOM node — and so
    // its focus — through the whole slide, so a focused endpoint field had
    // Android re-anchoring its autofill suggestion panel on every frame of
    // the height morph (the panel strobed for the length of the swap). The
    // motion stub matters: on the instant path the node is recycled at
    // once and the browser drops focus by itself, which would make this
    // assertion pass for the wrong reason.
    stubMotion("0.15s");
    const t = mountFocusRig({ initial: "b" });
    const input = t.container.querySelector<HTMLInputElement>(".step-input");
    expect(input).not.toBeNull();
    input!.focus();
    expect(document.activeElement).toBe(input);

    t.setCurrent("a");
    await flushSwap();

    // The slide is still in flight, so the leaving body — and its input —
    // are still mounted; that is exactly the window that used to strobe.
    expect(t.container.contains(input)).toBe(true);
    expect(document.activeElement).not.toBe(input);
  });

  it("keeps focus on the timeline step that drove the change", async () => {
    // The timeline sits inside the flow but is NOT leaving the stage: a
    // keyboard or pointer user who activated a completed step must keep
    // their focus. Blurring it drops them to <body> — the next Tab
    // restarts at the top of the document, and HkModal's Tab trap stops
    // engaging, so focus can escape the dialog.
    stubMotion("0.15s");
    const t = mountFocusRig({
      initial: "c",
      hideTimeline: false,
      timelineClickable: true,
    });
    const stepEl = t.container.querySelector<HTMLElement>(
      ".hk-timeline-step[data-clickable]",
    );
    expect(stepEl).not.toBeNull();
    stepEl!.focus();
    expect(document.activeElement).toBe(stepEl);

    t.setCurrent("a");
    await flushSwap();
    expect(document.activeElement).toBe(stepEl);
  });

  it("lets the entering step's own autofocus win over the blur", async () => {
    // The blur runs at the top of the swap watcher, before the entering
    // body mounts, so a step that focuses its own first field on entry
    // still wins. Moving the call below the mount turns this red.
    stubMotion("0.15s");
    const t = mountFocusRig({ initial: "b", autoFocusEntry: true });
    const leaving = t.container.querySelector<HTMLInputElement>(".step-input");
    expect(leaving).not.toBeNull();
    leaving!.focus();
    expect(document.activeElement).toBe(leaving);

    t.setCurrent("a");
    await flushSwap();

    const entered = t.container.querySelector<HTMLInputElement>(".auto-input");
    expect(entered).not.toBeNull();
    expect(document.activeElement).toBe(entered);
  });

  it("leaves focus outside the flow alone", async () => {
    const t = mountFocusRig({ initial: "a" });
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    containers.push(outside);

    outside.focus();
    expect(document.activeElement).toBe(outside);
    t.setCurrent("b");
    await flushSwap();
    // Containment, not a blanket blur.
    expect(document.activeElement).toBe(outside);
  });
});

describe("HkStepFlow split-window swap (motion enabled)", () => {
  it("slides both bodies across one window, then morphs the sheet after", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();

    // Slide window: both bodies on stage — the leaving one exiting, the
    // entering one released from its staged offset (imperatively, same
    // frame as the patch). The FIRST event froze the sheet.
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const entering = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(leaving?.classList.contains("hk-stepflow-leave-to")).toBe(true);
    expect(entering?.classList.contains("hk-stepflow-enter-from")).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail).toMatchObject({ phase: "swap", durationMs: 150 });
    expect(events[0]!.detail.delta).toBe(0);

    // The slide settles: the old node is recycled and the sheet gets its
    // new height — the morph window's event, alone.
    endTransition(entering);
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("b-body");
    expect(events).toHaveLength(2);
    expect(events[1]!.detail).toMatchObject({ phase: "morph", durationMs: 300 });
    expect(typeof events[1]!.detail.delta).toBe("number");
  });

  it("holds the frozen sheet through rapid re-navigation (preempt keeps the visible body)", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    t.setCurrent("c");
    await flushSwap();
    // The mock reports opacity 1 for every body, so the ENTERING one
    // (b, visibly fading in) is the survivor — it becomes the new
    // swap's leaving body and finishes its slide naturally.
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    expect(leaving?.textContent).toBe("b-body");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(pending?.textContent).toBe("c-body");
    expect(pending?.classList.contains("hk-stepflow-enter-from")).toBe(false);
    endTransition(pending);
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("c-body");
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
  });

  it("advances on the watchdog when transitionend never arrives", async () => {
    stubMotion("20ms");
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    await outlivePhase();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(events).toHaveLength(2);
    expect(events[1]!.detail.phase).toBe("morph");
  });

  it("settles instantly with a single morph-less poke where no transition runs", async () => {
    stubMotion("0s");
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("b-body");
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.phase).toBe("instant");
  });

  it("ignores transitionend events for non-opacity properties", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    const entering = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    // A stray transform end (the slide's other leg) must not settle the
    // swap early — the morph window would hand the sheet a stale height.
    const stray = new Event("transitionend", { bubbles: true });
    Object.defineProperty(stray, "propertyName", { value: "transform" });
    entering!.dispatchEvent(stray);
    await flushSwap();
    expect(events).toHaveLength(1);
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    endTransition(entering);
    await flushSwap();
    expect(events).toHaveLength(2);
  });

  it("keeps the staged classes through unrelated re-renders mid-slide", async () => {
    // The imperative enter-from release survives re-renders ONLY while
    // the vnode class strings stay equal between renders (Vue's
    // patchProps short-circuits on equality; a changed string rewrites
    // el.className wholesale and the staged state would resurrect —
    // the adversarial round proved the premise holds, this pins it).
    stubMotion();
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const current = ref("a");
    const tick = ref(0);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkStepFlow, {
            steps: STEPS,
            modelValue: current.value,
            "onUpdate:modelValue": (key: string) => { current.value = key; },
          }, {
            a: () => h("p", { "data-tick": tick.value }, "a"),
            b: () => h("p", { "data-tick": tick.value }, "b"),
            c: () => h("p", { "data-tick": tick.value }, "c"),
            d: () => h("p", { "data-tick": tick.value }, "d"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    current.value = "b";
    await flushSwap();
    const entering = container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(entering?.classList.contains("hk-stepflow-enter-from")).toBe(false);
    // Three unrelated re-renders (fresh slot closures each time — the
    // worst case for the class-string equality).
    for (let i = 0; i < 3; i += 1) {
      tick.value += 1;
      await flushSwap();
      expect(
        container.querySelector<HTMLElement>(".hk-stepflow-body.active")
          ?.classList.contains("hk-stepflow-enter-from"),
      ).toBe(false);
      expect(
        container.querySelector<HTMLElement>(".hk-stepflow-body.leaving")
          ?.classList.contains("hk-stepflow-leave-to"),
      ).toBe(true);
    }
    endTransition(container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    expect(container.querySelector(".hk-stepflow-body")?.textContent).toBe("b");
  });

  it("announces the measured height delta at the morph edge", async () => {
    stubMotion();
    stubHeights((text) => (text === "a-body" ? 100 : 220));
    const t = mountStepFlow({ initial: "a" });
    const events: CustomEvent[] = [];
    t.container.addEventListener(STEPFLOW_SWAP_EVENT, (e) => {
      events.push(e as CustomEvent);
    });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(events).toHaveLength(2);
    expect((events[1]!.detail as { delta: number }).delta).toBe(120);
    // And the reverse direction hands back the negative delta.
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    t.setCurrent("a");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(events).toHaveLength(4);
    expect((events[3]!.detail as { delta: number }).delta).toBe(-120);
  });
});

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
    await nextTick();
    await nextTick();
    return container.querySelector<HTMLElement>(".hk-timeline");
  }

  it("resolves offset under a cover host (HkModal-style)", async () => {
    const tl = await mountWithHost({ "data-pad-cover": "", "data-scroll-axis": "vertical" });
    expect(tl!.dataset.strategy).toBe("offset");
  });

  it("keeps bleed under a plain host", async () => {
    const tl = await mountWithHost({ "data-scroll-axis": "vertical" });
    expect(tl!.dataset.strategy).toBe("bleed");
  });
});
