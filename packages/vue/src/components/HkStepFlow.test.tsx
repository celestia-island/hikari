import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkStepFlow from "./HkStepFlow";
import type { StepFlowSlotProps } from "./HkStepFlow";

/**
 * HkStepFlow contract tests. House style: no @vue/test-utils dependency —
 * raw createApp mounts on shared containers torn down after each case.
 *
 * Note on transition-class assertions: happy-dom does not run stylesheet
 * transitions, so Vue's `out-in` leave phase leaves the leave-from/leave-
 * active classes in place until its rAF/settling timers fire — checking
 * class names right after `nextTick` is deterministic here.
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

/** Let Vue finish the out-in cycle's settling timers before teardown. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 80));
}

afterEach(() => {
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
    await nextTick();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(t.container.querySelector(".hk-stepflow-body")?.textContent).toBe("d-body");
    await settle();
  });

  it("slides forward when moving to a later step and back when returning", async () => {
    const t = mountStepFlow({ initial: "b" });
    const bodyClass = (): string =>
      t.container.querySelector(".hk-stepflow-body")?.className ?? "";

    t.setCurrent("c");
    await nextTick();
    // out-in: the old body is mid-leave on this tick.
    expect(bodyClass()).toContain("hk-stepflow-fwd-leave-active");

    await settle();
    t.setCurrent("b");
    await nextTick();
    expect(bodyClass()).toContain("hk-stepflow-back-leave-active");
    await settle();
  });

  it("passes key/index/direction to scoped slots across navigation", async () => {
    const seen: StepFlowSlotProps[] = [];
    const t = mountStepFlow({ initial: "a", seen });
    expect(seen.map((s) => `${s.key}:${s.index}:${s.direction}`)).toEqual(["a:0:forward"]);

    t.setCurrent("c");
    await settle();
    expect(seen.at(-1)).toEqual({ key: "c", index: 2, direction: "forward" });

    t.setCurrent("b");
    await settle();
    expect(seen.at(-1)).toEqual({ key: "b", index: 1, direction: "back" });

    // Returning forward again flips the direction back.
    t.setCurrent("d");
    await settle();
    expect(seen.at(-1)?.direction).toBe("forward");
    await settle();
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
    await settle();
    expect(selected).toEqual(["a"]);
    expect(container.querySelector(".hk-stepflow-body")?.textContent).toBe("");
    await settle();
  });

  it("renders an empty body without warnings for an unknown key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const t = mountStepFlow({ initial: "a" });
      t.setCurrent("does-not-exist");
      await nextTick();
      await settle();
      const body = t.container.querySelector(".hk-stepflow-body");
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
    await settle();
    expect(seen.at(-1)).toEqual({ key: "c", index: 1, direction: "back" });
    await settle();
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
