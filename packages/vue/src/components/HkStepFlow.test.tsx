import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, provide, ref } from "vue";

import HkStepFlow, { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";
import type { StepFlowSlotProps } from "./HkStepFlow";
import { SHEET_RIDE_KEY } from "../runtime/sheetRide";
import type { RideEntry } from "../composables/useSizeMorph";

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

describe("HkStepFlow simplified swap (motion enabled)", () => {
  it("shows only the old body through the exit phase, then fades the new one in", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();

    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(leaving?.classList.contains("hk-stepflow-leave-to")).toBe(true);
    expect(pending?.classList.contains("hk-stepflow-enter-pending")).toBe(true);

    endTransition(leaving);
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("b-body");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);

    endTransition(active);
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body")?.className).toBe(
      "hk-stepflow-body active",
    );
  });

  it("announces a GROW at the exit edge and a SHRINK at the enter edge", async () => {
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
    expect((events[0]!.detail as { phase: string }).phase).toBe("exit");
    expect((events[0]!.detail as { delta: number }).delta).toBe(120);
    // Drive the first swap to completion before starting the second.
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);

    t.setCurrent("a");
    await flushSwap();
    expect(events.length).toBe(1);
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    expect(events.length).toBe(2);
    expect((events[1]!.detail as { phase: string }).phase).toBe("enter");
    expect((events[1]!.detail as { delta: number }).delta).toBe(-120);
  });

  it("advances both phases on the watchdog when transitionend never arrives", async () => {
    stubMotion("20ms");
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(2);
    await outlivePhase();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    await outlivePhase();
    expect(t.container.querySelector(".hk-stepflow-body")?.className).toBe(
      "hk-stepflow-body active",
    );
  });

  it("keeps the visible body on stage when a re-swap pre-empts the exit phase", async () => {
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    t.setCurrent("c");
    await flushSwap();
    const leaving = t.container.querySelector<HTMLElement>(".hk-stepflow-body.leaving");
    const pending = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(leaving?.textContent).toBe("a-body");
    expect(pending?.textContent).toBe("c-body");
    endTransition(leaving);
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("c-body");
  });

  it("fades the new body in immediately when the outgoing one already faded", async () => {
    stubMotion("0.15s", { leavingOpacity: "0" });
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    t.setCurrent("c");
    await flushSwap();
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.textContent).toBe("c-body");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);
  });

  it("fires the enter edge at 80% of the exit phase, before transitionend", async () => {
    // Round 14: the strictly sequential edge (transitionend) left a
    // recycle→patch→fade pipeline gap that painted an empty body — the
    // "the new list always flickers once" report. The overlap edge must
    // advance the phase on its own timer, and the pending class must
    // already be off the entering element SYNCHRONOUSLY (imperative
    // flip), not one Vue patch later.
    vi.useFakeTimers();
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    expect(
      t.container.querySelector(".hk-stepflow-body.active")?.classList.contains("hk-stepflow-enter-pending"),
    ).toBe(true);
    // 0.8 × 150ms = 120ms — the early edge fires with no transitionend.
    vi.advanceTimersByTime(121);
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active?.classList.contains("hk-stepflow-enter-pending")).toBe(false);
    await flushSwap();
    // The old node was recycled with its ~0.1-opacity tail: one body left.
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
    // A late transitionend from the (already recycled) leaving body is a
    // guarded no-op.
    endTransition(t.container.querySelector(".hk-stepflow-body"));
    await flushSwap();
    expect(t.container.querySelectorAll(".hk-stepflow-body").length).toBe(1);
  });

  it("ignores transitionend events for non-opacity properties", async () => {
    // A riding body's transform leg (the sheet fold) fires its own
    // transitionend at the fold's landing — the swap must not settle
    // while the enter fade is still running.
    stubMotion();
    const t = mountStepFlow({ initial: "a" });
    t.setCurrent("b");
    await flushSwap();
    endTransition(t.container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    const active = t.container.querySelector<HTMLElement>(".hk-stepflow-body.active");
    expect(active).not.toBeNull();
    const stray = new Event("transitionend", { bubbles: true });
    Object.defineProperty(stray, "propertyName", { value: "transform" });
    active!.dispatchEvent(stray);
    await flushSwap();
    // The stray event did not settle the swap: the opacity edge still
    // owns the phase (the watchdog would eventually close it too).
    expect(t.container.querySelector(".hk-stepflow-body.active")).not.toBeNull();
    endTransition(active);
    await flushSwap();
    expect(t.container.querySelector(".hk-stepflow-body")?.className).toBe(
      "hk-stepflow-body active",
    );
  });

  it("registers the entering body as a counter rider with the hosting sheet", async () => {
    stubMotion();
    const registered: RideEntry[] = [];
    const unregistered: RideEntry[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const current = ref("a");
    const Wrapper = defineComponent({
      setup() {
        provide(SHEET_RIDE_KEY, {
          register: (entry: RideEntry) => {
            registered.push(entry);
            return () => unregistered.push(entry);
          },
          snapshot: () => registered,
        });
        return () =>
          h(HkStepFlow, {
            steps: STEPS,
            modelValue: current.value,
            "onUpdate:modelValue": (key: string) => { current.value = key; },
          }, {
            a: () => h("p", "a"),
            b: () => h("p", "b"),
            c: () => h("p", "c"),
            d: () => h("p", "d"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    current.value = "b";
    await flushSwap();
    // Registered before the sheet could stage any sweep, as a reveal
    // COUNTER (the entering body holds its final position while the
    // sheet's block rides the fold).
    expect(registered).toHaveLength(1);
    expect(registered[0]!.counterOnReveal).toBe(true);
    expect(registered[0]!.el.classList.contains("hk-stepflow-body")).toBe(true);
    expect(unregistered).toHaveLength(0);
    // Settle the swap: the registration is released exactly once.
    endTransition(container.querySelector(".hk-stepflow-body.leaving"));
    await flushSwap();
    endTransition(container.querySelector(".hk-stepflow-body.active"));
    await flushSwap();
    expect(unregistered).toHaveLength(1);
    expect(unregistered[0]).toBe(registered[0]);
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
