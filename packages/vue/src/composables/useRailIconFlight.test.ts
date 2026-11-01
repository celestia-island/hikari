import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import {
  RAIL_FLIGHT_MS,
  RAIL_FLIGHT_SWEEP_MS,
  RAIL_FLIP_ACTIVE_ATTR,
  RAIL_FLIP_ICON_ATTR,
  RAIL_FLIP_ITEM_ATTR,
} from "./useRailIconFlight";
import { __teardownMediaQueries } from "../runtime/useMediaQuery";
import HkSidebarRailSwap from "../components/HkSidebarRailSwap";

/**
 * useRailIconFlight — the rail flip's icon continuity layer (2026-11-02).
 *
 * The tests mount the REAL HkSidebarRailSwap with keyed icon cells in the
 * slot and drive a genuine density flip. What is stubbed is only what
 * happy-dom cannot do: layout (getBoundingClientRect) and WAAPI (a
 * recording stub). Timing is fake-timer driven, and that is load-bearing
 * twice over:
 *
 * - the choreographer's arm macrotask (setTimeout 0) fires on
 *   `advanceTimersByTimeAsync(0)` — while happy-dom's rAF-driven
 *   dissolve (a ~16ms timer) has NOT run yet, so both generations are
 *   still mounted exactly as in a real browser mid-CSS-dissolve;
 * - advancing past the sweep budget exercises the cleanup path.
 *
 * The assertions pin the choreography DECISIONS:
 * 1. A flip with moving keyed icons arms the flight: `data-flipping` on
 *    the swap host, a flight layer with one clone per PAIRED key, each
 *    clone painted at the leaving rect (relative to the host) and
 *    animated by the signed delta to the entering rect.
 * 2. The guards: no movement → no flight; a missing WAAPI, reduced
 *    motion, or a dissolved-away leaving generation → no flight;
 *    unmatched keys dissolve instead of flying.
 * 3. The lifecycle: the sweep timer removes the layer and the attribute;
 *    a fresh flip replaces (never stacks) the previous flight; unmount
 *    cleans up.
 */

const mounts: App[] = [];
const containers: HTMLElement[] = [];

interface RecordedAnimation {
  el: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let animations: RecordedAnimation[] = [];

function rect(x: number, y: number, width = 16, height = 16): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Stub layout for one element. */
function stubRect(el: Element, r: DOMRect): void {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue(r);
}

interface Harness {
  container: HTMLElement;
  swap(): HTMLElement;
  generations(): HTMLElement[];
  set(rail: boolean): Promise<void>;
}

function mountSwap(): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const rail = ref(false);
  const Wrapper = defineComponent({
    name: "FlightHarness",
    setup() {
      return () =>
        h(
          HkSidebarRailSwap,
          { rail: rail.value, railWidth: "56px", expandedWidth: "240px" },
          {
            default: (p: { rail: boolean }) =>
              h("div", { class: "rows" }, [
                h("span", { class: "hk-menu-item-icon", [RAIL_FLIP_ICON_ATTR]: "home" }, "H"),
                h("span", { class: "hk-menu-item-icon", [RAIL_FLIP_ICON_ATTR]: "inbox" }, "I"),
                p.rail
                  ? h(
                      "span",
                      { class: "hk-menu-item-icon", [RAIL_FLIP_ICON_ATTR]: "rail-only" },
                      "R",
                    )
                  : null,
              ]),
          },
        );
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return {
    container,
    swap: () => container.querySelector(".hk-sidebar-rail-swap") as HTMLElement,
    generations: () =>
      Array.from(container.querySelectorAll<HTMLElement>(".hk-sidebar-rail-generation")),
    set: async (v: boolean) => {
      rail.value = v;
      await nextTick();
    },
  };
}

/** Split the mid-swap items by HkCrossfade's semantic key — the same
 *  anchor the choreographer itself pairs through. */
function dissolvePair(h: Harness, enteringRail: boolean): { leaving: HTMLElement; entering: HTMLElement } {
  const enteringKey = enteringRail ? "rail" : "full";
  const items = Array.from(h.swap().querySelectorAll<HTMLElement>(":scope > .hk-crossfade-item"));
  const entering = items.find((el) => el.getAttribute(RAIL_FLIP_ITEM_ATTR) === enteringKey);
  const leaving = items.find((el) => el.getAttribute(RAIL_FLIP_ITEM_ATTR) !== enteringKey);
  expect(entering, "the entering generation is mounted").toBeTruthy();
  expect(leaving, "the leaving generation is still mounted").toBeTruthy();
  return { leaving: leaving!, entering: entering! };
}

/** Stub the geometry of every keyed icon in a generation. */
function stubIcons(root: HTMLElement, fn: (key: string) => DOMRect): void {
  for (const icon of root.querySelectorAll<HTMLElement>(`[${RAIL_FLIP_ICON_ATTR}]`)) {
    stubRect(icon, fn(icon.getAttribute(RAIL_FLIP_ICON_ATTR)!));
  }
}

const flightLayer = (h: Harness): HTMLElement | null =>
  h.swap().querySelector<HTMLElement>(":scope > .hk-sidebar-rail-flight");

/** happy-dom ships no WAAPI: the prototype method is assigned by hand
 *  (spyOn requires an existing property) and restored in afterEach. The
 *  Omit re-declares `animate` optional so the delete/restore typechecks —
 *  the DOM lib's own declaration is required. */
const animatable = HTMLElement.prototype as Omit<HTMLElement, "animate"> & {
  animate?: unknown;
};
let originalAnimate: unknown;

beforeEach(() => {
  vi.useFakeTimers();
  animations = [];
  originalAnimate = animatable.animate;
  animatable.animate = function (
    this: HTMLElement,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions,
  ) {
    animations.push({ el: this, keyframes, options: options ?? ({} as KeyframeAnimationOptions) });
    return {
      addEventListener: () => {},
      cancel: () => {},
    } as unknown as Animation;
  } as typeof animatable.animate;
});

afterEach(() => {
  if (originalAnimate === undefined) delete animatable.animate;
  else animatable.animate = originalAnimate;
  for (const app of mounts.splice(0)) app.unmount();
  containers.splice(0).forEach((c) => c.remove());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
  __teardownMediaQueries();
});

describe("useRailIconFlight", () => {
  it("arms a flight on collapse: layer + clones painted at the leaving rects, animated by the delta", async () => {
    const h = mountSwap();
    await h.set(true);
    // Expanded geometry: icon cells at x=32 (the leading padding column).
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, (key) => rect(key === "home" ? 32 : 32, key === "home" ? 100 : 140));
    // Rail geometry: the same cells centered in the 56px column (x=20).
    stubIcons(entering, (key) =>
      rect(20, key === "home" ? 100 : key === "inbox" ? 140 : 180),
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(h.swap().getAttribute(RAIL_FLIP_ACTIVE_ATTR), "the flight is armed").toBe("");
    const layer = flightLayer(h);
    expect(layer, "the flight layer lives on the swap host").toBeTruthy();
    // Two MATCHED keys fly; "rail-only" has no expanded partner and must
    // dissolve instead of being invented a source.
    expect(layer!.querySelectorAll(".hk-sidebar-rail-flight-clone")).toHaveLength(2);
    // Each clone animates by the SIGNED delta (collapse: 12px leftward).
    const home = animations.find((a) => a.el.textContent === "H");
    expect(home, "the home clone animates").toBeTruthy();
    expect(home!.options.duration).toBe(RAIL_FLIGHT_MS);
    expect(home!.keyframes.at(-1)!.transform).toBe("translate(-12px, 0px)");
    // The clone is PAINTED at the leaving rect relative to the host…
    const homeClone = layer!.querySelector<HTMLElement>(".hk-sidebar-rail-flight-clone")!;
    expect(homeClone.style.left).toBe("32px");
    expect(homeClone.style.top).toBe("100px");
    // …and carries no flip identity of its own.
    expect(homeClone.getAttribute(RAIL_FLIP_ICON_ATTR)).toBeNull();
  });

  it("flies the opposite way on expand (the delta is signed)", async () => {
    const h = mountSwap();
    await h.set(true);
    // Let the first flight arm AND settle (sweep budget), so the second
    // flip starts from a clean host.
    await vi.advanceTimersByTimeAsync(RAIL_FLIGHT_SWEEP_MS + 50);
    expect(flightLayer(h)).toBeNull();
    animations.length = 0;

    await h.set(false);
    const { leaving, entering } = dissolvePair(h, false);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    // Leaving (rail) at x=20, entering (full) at x=32 → +12px rightward.
    stubIcons(leaving, (key) => rect(20, key === "home" ? 100 : 140));
    stubIcons(entering, (key) => rect(32, key === "home" ? 100 : 140));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().getAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe("");
    expect(animations[0]!.keyframes.at(-1)!.transform).toBe("translate(12px, 0px)");
  });

  it("skips the flight when nothing moves (positions already coincide)", async () => {
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(28, 100));
    stubIcons(entering, () => rect(28, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    expect(flightLayer(h)).toBeNull();
    expect(animations).toHaveLength(0);
  });

  it("skips the flight when WAAPI is unavailable", async () => {
    delete animatable.animate;
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(32, 100));
    stubIcons(entering, () => rect(20, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    expect(flightLayer(h)).toBeNull();
  });

  it("skips the flight under reduced motion", async () => {
    // Minimal MediaQueryList fake — spread of a live list loses the
    // accessor. `matches: true` must be readable at SETUP time: the
    // composable subscribes once and reads its ref in flightCapable().
    const fakeList = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(fakeList);
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(32, 100));
    stubIcons(entering, () => rect(20, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    expect(flightLayer(h)).toBeNull();
    vi.mocked(window.matchMedia).mockRestore();
  });

  it("skips the flight when the leaving generation is gone (watchdog-degraded swap)", async () => {
    const h = mountSwap();
    await h.set(true);
    // HkCrossfade's stall sweep removes the stale item outright; the
    // choreographer must stay dormant with no dissolve to fly over.
    const leavingKey = "full";
    h.swap()
      .querySelector(`:scope > .hk-crossfade-item[${RAIL_FLIP_ITEM_ATTR}="${leavingKey}"]`)
      ?.remove();
    stubRect(h.swap(), rect(0, 0, 240, 400));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    expect(flightLayer(h)).toBeNull();
    expect(animations).toHaveLength(0);
  });

  it("sweeps the layer and the attribute when the flight window ends", async () => {
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(32, 100));
    stubIcons(entering, () => rect(20, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h)).toBeTruthy();
    await vi.advanceTimersByTimeAsync(RAIL_FLIGHT_SWEEP_MS + 10);
    expect(flightLayer(h), "the sweep timer removes the layer").toBeNull();
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
  });

  it("a fresh flip replaces the previous flight instead of stacking layers", async () => {
    const h = mountSwap();
    await h.set(true);
    let pair = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(pair.leaving, () => rect(32, 100));
    stubIcons(pair.entering, () => rect(20, 100));
    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h)).toBeTruthy();

    await h.set(false);
    pair = dissolvePair(h, false);
    stubIcons(pair.leaving, () => rect(20, 100));
    stubIcons(pair.entering, () => rect(32, 100));
    await vi.advanceTimersByTimeAsync(0);
    const layers = h.swap().querySelectorAll(":scope > .hk-sidebar-rail-flight");
    expect(layers, "exactly one flight layer").toHaveLength(1);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(true);
  });
});
