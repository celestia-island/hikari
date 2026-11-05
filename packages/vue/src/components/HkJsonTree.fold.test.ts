import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import {
  HkJsonTree,
  parseCssTimeMs,
  prefersNoFoldMotion,
  resolveFoldMotion,
  runFold,
  type FoldMotionDocument,
  type FoldMotionWindow,
} from "./HkJsonTree";
import { readHkRuntime } from "../runtime/registry";

/**
 * HkJsonTree fold motion — the expand/collapse choreography and its
 * animation-context wiring.
 *
 * happy-dom has no layout engine: every geometric read (scrollHeight /
 * offsetHeight) is stubbed explicitly, so an assertion on the pixel the
 * transition starts from proves the code actually measured the block instead
 * of hard-coding a height. The bus assertions read the live `animationBus`
 * registry facet, not a mock — the same way other components prove they
 * reported a transition.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountTree(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkJsonTree, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  delete document.documentElement.dataset.cssAnimations;
  vi.useRealTimers();
});

function busTransitions(): number {
  const state = readHkRuntime("animationBus") as { transitions?: number } | undefined;
  return state?.transitions ?? 0;
}

function stubLayout(el: HTMLElement, box: { height: number }) {
  Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => box.height });
}

function stubScrollHeight(proto: object, value: number) {
  const original = Object.getOwnPropertyDescriptor(proto, "scrollHeight");
  Object.defineProperty(proto, "scrollHeight", { configurable: true, get: () => value });
  return () => {
    if (original) Object.defineProperty(proto, "scrollHeight", original);
    else delete (proto as Record<string, unknown>).scrollHeight;
  };
}

/**
 * A bare element stand-in for the height choreography: records every inline
 * style write so the test can pin BOTH edges of the fold (start height and
 * target height), which the component-level tests cannot observe once the
 * transition is in flight.
 */
function fakeFoldElement(scrollHeight: number, offsetHeight: number) {
  const heights: string[] = [];
  const transitions: string[] = [];
  // A REAL element (not a cast) with the two layout metrics stubbed: the
  // style writes are recorded by proxying the live CSSStyleDeclaration, so
  // the fold choreography runs unmodified and the recording needs no
  // escape hatches.
  const target = document.createElement("div");
  Object.defineProperty(target, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(target, "offsetHeight", { configurable: true, get: () => offsetHeight });
  const style = new Proxy(target.style, {
    set(targetStyle, property, value) {
      if (property === "height") heights.push(String(value));
      if (property === "transition") transitions.push(String(value));
      return Reflect.set(targetStyle, property, value);
    },
    get(targetStyle, property) {
      const value = Reflect.get(targetStyle, property, targetStyle);
      return typeof value === "function" ? value.bind(targetStyle) : value;
    },
  });
  const el = new Proxy(target, {
    get(node, property) {
      if (property === "style") return style;
      const value = Reflect.get(node, property, node);
      return typeof value === "function" ? value.bind(node) : value;
    },
  });
  return { el, heights, transitions };
}

const DEFAULT_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

describe("runFold choreography", () => {
  afterEach(() => {
    delete document.documentElement.dataset.cssAnimations;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens from 0 to the measured scrollHeight and clears its styles", () => {
    vi.useFakeTimers();
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    const { el, heights, transitions } = fakeFoldElement(42, 0);
    let done = 0;
    runFold(el, true, () => { done += 1; });
    expect(heights).toEqual(["0px", "42px"]);
    expect(transitions.at(-1)).toBe(`height 150ms ${DEFAULT_EASE}`);
    expect(done).toBe(0);

    vi.advanceTimersByTime(400);
    expect(done).toBe(1);
    expect(heights.at(-1)).toBe("");
    expect(transitions.at(-1)).toBe("");
  });

  it("closes from the measured offsetHeight down to 0", () => {
    vi.useFakeTimers();
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    const { el, heights } = fakeFoldElement(0, 42);
    let done = 0;
    runFold(el, false, () => { done += 1; });
    // The START edge is the measured offsetHeight: pinning it makes a
    // hard-coded natural height (or the removal of the measurement) red.
    expect(heights).toEqual(["42px", "0px"]);
    vi.advanceTimersByTime(400);
    expect(done).toBe(1);
    expect(heights.at(-1)).toBe("");
  });

  it("honours the host fold tokens for duration and easing", () => {
    vi.useFakeTimers();
    vi.stubGlobal("getComputedStyle", () => ({
      getPropertyValue: (name: string) => {
        if (name === "--jt-fold-duration") return " 0.4s ";
        if (name === "--jt-fold-ease") return " ease-in ";
        return "";
      },
    }));
    const { el, transitions } = fakeFoldElement(10, 0);
    let done = 0;
    let reportedDuration = 0;
    runFold(el, true, () => { done += 1; }, { onStart: (ms) => { reportedDuration = ms; } });
    expect(transitions.at(-1)).toBe("height 400ms ease-in");
    // The same resolved duration feeds the bus report window (the component
    // hands it to useReportedTransition), so a retimed fold stays reported
    // for its whole length instead of a hard-coded 320ms.
    expect(reportedDuration).toBe(400);
    vi.advanceTimersByTime(300);
    expect(done).toBe(0);
    vi.advanceTimersByTime(200);
    expect(done).toBe(1);
  });

  it("skips the measurement and finishes immediately when motion is parked", () => {
    document.documentElement.dataset.cssAnimations = "0";
    const { el, heights, transitions } = fakeFoldElement(42, 42);
    let done = 0;
    runFold(el, true, () => { done += 1; });
    expect(done).toBe(1);
    expect(heights).toEqual([""]);
    expect(transitions).toEqual([""]);
  });

  it("resolves motion from the host tokens and the stop switches", () => {
    vi.stubGlobal("getComputedStyle", () => ({
      getPropertyValue: (name: string) => {
        if (name === "--jt-fold-duration") return "0.25s";
        if (name === "--jt-fold-ease") return "linear";
        return "";
      },
    }));
    expect(resolveFoldMotion(null)).toEqual({ durationMs: 150, easing: DEFAULT_EASE });
    const { el } = fakeFoldElement(0, 0);
    expect(resolveFoldMotion(el)).toEqual({ durationMs: 250, easing: "linear" });
    document.documentElement.dataset.cssAnimations = "0";
    expect(resolveFoldMotion(el)).toEqual({ durationMs: 0, easing: DEFAULT_EASE });
  });
});

describe("fold motion helpers", () => {
  it("parses CSS time tokens into milliseconds", () => {
    expect(parseCssTimeMs("150ms")).toBe(150);
    expect(parseCssTimeMs("0.15s")).toBe(150);
    expect(parseCssTimeMs(" 1.5s ")).toBe(1500);
    expect(parseCssTimeMs("0s")).toBe(0);
    expect(parseCssTimeMs("")).toBeNull();
    expect(parseCssTimeMs("var(--x)")).toBeNull();
    expect(parseCssTimeMs("slow")).toBeNull();
  });

  it("treats reduced motion and the global animation switch as no-motion", () => {
    const win: FoldMotionWindow = { matchMedia: () => ({ matches: true }) };
    const doc: FoldMotionDocument = { documentElement: { dataset: {} } };
    expect(prefersNoFoldMotion(win, doc)).toBe(true);
    const motionWin: FoldMotionWindow = { matchMedia: () => ({ matches: false }) };
    expect(prefersNoFoldMotion(motionWin, doc)).toBe(false);
    const parkedDoc: FoldMotionDocument = {
      documentElement: { dataset: { cssAnimations: "0" } },
    };
    expect(prefersNoFoldMotion(motionWin, parkedDoc)).toBe(true);
  });
});

describe("HkJsonTree fold animation", () => {
  it("closes from the measured height, reports the transition, then collapses", async () => {
    vi.useFakeTimers();
    const el = mountTree({ text: '{"cfg":{"retries":2}}' });
    const children = el.querySelector(".s-jt-children") as HTMLElement;
    expect(children).not.toBeNull();
    stubLayout(children, { height: 42 });
    expect(busTransitions()).toBe(0);

    const rootRow = el.querySelector(".s-jt-row[data-parent]") as HTMLElement;
    rootRow.click();
    await nextTick();

    // Still mounted, mid-leave, starting from the measured 42px.
    expect(el.querySelector(".s-jt-children")).not.toBeNull();
    expect(children.style.height).toBe("0px");
    expect(children.style.transition).toContain("height 150ms");
    expect(busTransitions()).toBe(1);

    await vi.advanceTimersByTimeAsync(400);
    await nextTick();
    expect(el.querySelector(".s-jt-children")).toBeNull();
    expect(busTransitions()).toBe(0);
  });

  it("opens from 0 to the measured natural height and clears the inline height", async () => {
    vi.useFakeTimers();
    const restore = stubScrollHeight(HTMLElement.prototype, 42);
    try {
      const el = mountTree({ text: '{"cfg":{"retries":2}}' });
      const rootRow = el.querySelector(".s-jt-row[data-parent]") as HTMLElement;
      // Fold the root away first, then reopen it to exercise the enter side.
      rootRow.click();
      await nextTick();
      await vi.advanceTimersByTimeAsync(400);
      await nextTick();
      expect(el.querySelector(".s-jt-children")).toBeNull();

      rootRow.click();
      await nextTick();
      const children = el.querySelector(".s-jt-children") as HTMLElement;
      expect(children).not.toBeNull();
      expect(children.style.height).toBe("42px");
      expect(children.style.transition).toContain("height 150ms");
      expect(busTransitions()).toBe(1);

      await vi.advanceTimersByTimeAsync(400);
      await nextTick();
      // The block stays; only the animation scaffolding is cleared so the
      // next fold measures the natural height again.
      expect(el.querySelector(".s-jt-children")).not.toBeNull();
      expect(children.style.height).toBe("");
      expect(children.style.transition).toBe("");
      expect(busTransitions()).toBe(0);
    } finally {
      restore();
    }
  });

  it("keeps the animation-bus report alive for a host-retimed fold", async () => {
    vi.useFakeTimers();
    const realGet = globalThis.getComputedStyle;
    vi.stubGlobal("getComputedStyle", (el: Element) => {
      const real = realGet(el);
      return {
        getPropertyValue: (name: string) =>
          name === "--jt-fold-duration" ? "2s" : real.getPropertyValue(name),
      };
    });
    const el = mountTree({ text: '{"cfg":{"retries":2}}' });
    const children = el.querySelector(".s-jt-children") as HTMLElement;
    stubLayout(children, { height: 42 });
    const rootRow = el.querySelector(".s-jt-row[data-parent]") as HTMLElement;
    rootRow.click();
    await nextTick();
    expect(busTransitions()).toBe(1);
    // Far past the old fixed 320ms window, the 2s fold is still in flight:
    // the report must still be armed.
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.querySelector(".s-jt-children")).not.toBeNull();
    expect(busTransitions()).toBe(1);
    await vi.advanceTimersByTimeAsync(1200);
    await nextTick();
    expect(el.querySelector(".s-jt-children")).toBeNull();
    expect(busTransitions()).toBe(0);
  });

  it("snaps the fold under the global animation switch and reports nothing", async () => {
    vi.useFakeTimers();
    document.documentElement.dataset.cssAnimations = "0";
    const el = mountTree({ text: '{"cfg":{"retries":2}}' });

    const rootRow = el.querySelector(".s-jt-row[data-parent]") as HTMLElement;
    rootRow.click();
    await nextTick();
    await nextTick();

    expect(el.querySelector(".s-jt-children")).toBeNull();
    expect(busTransitions()).toBe(0);
  });
});

describe("HkJsonTree selection opt-in", () => {
  it("keeps the selectable class off unless the host asks for it", () => {
    const plain = mountTree({ text: '{"a":1}' });
    expect(plain.firstElementChild!.classList.contains("s-jt-selectable")).toBe(false);
    const selectable = mountTree({ text: '{"a":1}', selectable: true });
    expect(selectable.firstElementChild!.classList.contains("s-jt-selectable")).toBe(true);
  });
});
