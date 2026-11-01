import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import {
  cssDurationMs,
  RAIL_FLIGHT_MS,
  RAIL_FLIGHT_SWEEP_MARGIN_MS,
  RAIL_FLIP_ACTIVE_ATTR,
  RAIL_FLIP_FLYING_ATTR,
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
 * happy-dom cannot do: layout (getBoundingClientRect), WAAPI (a
 * recording stub whose listeners the tests can fire) and — implicitly —
 * zoom (no ancestor zoom in happy-dom, so drawnScale is 1 and the
 * written offsets equal the measured deltas). Timing is fake-timer
 * driven, and that is load-bearing twice over:
 *
 * - the choreographer's arm macrotask (setTimeout 0) fires on
 *   `advanceTimersByTimeAsync(0)` — while happy-dom's rAF-driven
 *   dissolve (a ~16ms timer) has NOT run yet, so both generations are
 *   still mounted exactly as in a real browser mid-CSS-dissolve;
 * - advancing past the sweep budget exercises the cleanup path.
 *
 * The assertions pin the choreography DECISIONS:
 * 1. A flip with moving keyed icons arms the flight: `data-flipping` on
 *    the swap host, a flight layer ON THE HOST with one clone
 *    per PAIRED key, each clone painted at the leaving rect (logical
 *    insets relative to the stage) and animated by the signed delta.
 * 2. The pairing contract is visible: matched leaving cells carry the
 *    `data-flip-flying` mark (they are substituted), UNMATCHED opted-in
 *    cells are never marked (they dissolve — a rail fallback with no
 *    expanded counterpart must not vanish un-substituted).
 * 3. The guards: no movement → no flight; a missing WAAPI, reduced
 *    motion, or a dissolved-away leaving generation → no flight.
 * 4. The lifecycle: the WAAPI `finish` sweeps the layer; the sweep timer
 *    backstops it; a fresh flip replaces (never stacks) the previous
 *    flight; scope disposal tears a live flight down (the afterEach
 *    unmount walks the same path).
 */

const mounts: App[] = [];
const containers: HTMLElement[] = [];

interface RecordedAnimation {
  el: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  fire(type: "finish" | "cancel"): void;
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
                // The rail-only fallback cell: an opted-in row with NO
                // expanded counterpart (the icon-less leaf's rail form).
                p.rail
                  ? h(
                      "span",
                      { class: "hk-menu-item-icon", [RAIL_FLIP_ICON_ATTR]: "rail-only" },
                      "R",
                    )
                  : null,
                // …and its full-only twin: a cell that exists ONLY in the
                // expanded generation (a rich expanded row's icon).
                p.rail
                  ? null
                  : h(
                      "span",
                      { class: "hk-menu-item-icon", [RAIL_FLIP_ICON_ATTR]: "full-only" },
                      "F",
                    ),
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
function dissolvePair(
  h: Harness,
  enteringRail: boolean,
): { leaving: HTMLElement; entering: HTMLElement } {
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
  h.swap().querySelector<HTMLElement>(".hk-sidebar-rail-flight");

/** happy-dom ships no WAAPI: the prototype method is assigned by hand
 *  (spyOn requires an existing property) and restored in afterEach. The
 *  recording handle keeps its listeners fireable so the finish/cancel
 *  sweep paths are actually exercised. */
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
    const listeners = new Map<string, EventListener>();
    const handle = {
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      cancel: () => listeners.get("cancel")?.(new Event("cancel")),
      fire(type: "finish" | "cancel") {
        listeners.get(type)?.(new Event(type));
      },
    };
    animations.push({ el: this, keyframes, options: options ?? ({} as KeyframeAnimationOptions), fire: handle.fire });
    return handle as unknown as Animation;
  } as typeof animatable.animate;
});

afterEach(() => {
  if (originalAnimate === undefined) delete animatable.animate;
  else animatable.animate = originalAnimate;
  for (const app of mounts.splice(0)) app.unmount();
  containers.splice(0).forEach((c) => c.remove());
  document.body.innerHTML = "";
  // Restores every vi.spyOn (getComputedStyle / matchMedia / rect
  // stubs) even when a test failed before its own inline restore —
  // the probes recorded the leak as harmless, but the class is free
  // to close.
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  __teardownMediaQueries();
});

describe("cssDurationMs", () => {
  it("parses the CSS time property shapes", () => {
    expect(cssDurationMs("")).toBe(0);
    expect(cssDurationMs("0ms")).toBe(0);
    expect(cssDurationMs("150ms")).toBe(150);
    expect(cssDurationMs("0.2s")).toBe(200);
    expect(cssDurationMs("300ms")).toBe(300);
    expect(cssDurationMs("garbage")).toBe(0);
    expect(cssDurationMs("-5ms")).toBe(0);
  });
});

describe("useRailIconFlight", () => {
  it("arms a flight on collapse: matched cells marked, layer on the swap host, clones at the leaving rects", async () => {
    const h = mountSwap();
    await h.set(true);
    // Expanded geometry: icon cells at x=32 (the leading padding column).
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, (key) => rect(32, key === "home" ? 100 : 140));
    // Rail geometry: the same cells centered in the 56px column (x=20).
    stubIcons(entering, (key) =>
      rect(20, key === "home" ? 100 : key === "inbox" ? 140 : 180),
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(h.swap().getAttribute(RAIL_FLIP_ACTIVE_ATTR), "the flight is armed").toBe("");
    const layer = flightLayer(h);
    expect(layer, "the flight layer lives on the swap host").toBeTruthy();
    expect(
      layer!.parentElement,
      "the stage is the SWAP HOST — outside both dissolving items, so the clones never inherit the enter fade",
    ).toBe(h.swap());
    // Two MATCHED keys fly; "rail-only"/"full-only" have no partner and
    // must dissolve instead of being invented a source.
    expect(layer!.querySelectorAll(".hk-sidebar-rail-flight-clone")).toHaveLength(2);
    // Each clone animates by the SIGNED delta (collapse: 12px leftward)
    // at the FALLBACK window (the test DOM resolves no custom
    // properties, so --duration-normal reads empty).
    const home = animations.find((a) => a.el.textContent === "H");
    expect(home, "the home clone animates").toBeTruthy();
    expect(home!.options.duration).toBe(RAIL_FLIGHT_MS);
    expect(home!.keyframes.at(-1)!.transform).toBe("translate(-12px, 0px)");
    const inbox = animations.find((a) => a.el.textContent === "I");
    expect(inbox!.keyframes.at(-1)!.transform).toBe("translate(-12px, 0px)");
    // SINGLE GLYPH: pure travel — no opacity keyframe anywhere, the
    // clone holds full opacity to the landing (the old end-fade is what
    // double-exposed it against the dissolving-in entering icon).
    for (const a of animations) {
      expect(a.keyframes.some((f) => "opacity" in (f as PropertyIndexedKeyframes)), "no fade in the flight").toBe(false);
    }
    expect(home!.keyframes).toHaveLength(2);
    expect(home!.options.fill, "a slipped frame parks the clone at the landing rect").toBe("forwards");
    // The clone is PAINTED at the leaving rect as a logical inset from
    // the stage's stable inline-start edge…
    const homeClone = layer!.querySelector<HTMLElement>(".hk-sidebar-rail-flight-clone")!;
    expect(homeClone.style.insetInlineStart).toBe("32px");
    expect(homeClone.style.insetBlockStart).toBe("100px");
    // …and carries no flip identity of its own.
    expect(homeClone.getAttribute(RAIL_FLIP_ICON_ATTR)).toBeNull();
    expect(homeClone.hasAttribute(RAIL_FLIP_FLYING_ATTR), "the clone never hides itself").toBe(false);
    // The pairing contract, visible: BOTH ends of a matched pair are
    // stamped for the hide rule (the clone is the one glyph from arm to
    // landing — the entering cell hides too); the partnerless cells on
    // either side ("full-only" leaving, "rail-only" entering) are NOT
    // (they must dissolve, not vanish un-substituted).
    const leavingHome = leaving.querySelector(`[${RAIL_FLIP_ICON_ATTR}="home"]`)!;
    expect(leavingHome.hasAttribute(RAIL_FLIP_FLYING_ATTR), "matched leaving cell marked").toBe(true);
    const enteringHome = entering.querySelector(`[${RAIL_FLIP_ICON_ATTR}="home"]`)!;
    expect(enteringHome.hasAttribute(RAIL_FLIP_FLYING_ATTR), "matched ENTERING cell marked too — single glyph").toBe(true);
    const solo = leaving.querySelector(`[${RAIL_FLIP_ICON_ATTR}="full-only"]`)!;
    expect(solo.hasAttribute(RAIL_FLIP_FLYING_ATTR), "unmatched leaving cell never marked").toBe(false);
    const soloIn = entering.querySelector(`[${RAIL_FLIP_ICON_ATTR}="rail-only"]`)!;
    expect(soloIn.hasAttribute(RAIL_FLIP_FLYING_ATTR), "unmatched entering cell never marked").toBe(false);
  });

  it("derives the flight window from the theme's --duration-normal (no hardcoded mirror)", async () => {
    // The window must READ the token the dissolve consumes: a theme
    // retuned to 600ms retunes the flight with it, and the sweep budget
    // stretches past the longer window (arm at 600, sweep at 900).
    const h = mountSwap();
    const realGCS = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      const declared = realGCS(el as HTMLElement);
      if (el !== h.swap()) return declared;
      return new Proxy(declared, {
        get(target, prop) {
          if (prop === "getPropertyValue") {
            return (name: string) =>
              name === "--duration-normal" ? "600ms" : (target.getPropertyValue(name) ?? "");
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as CSSStyleDeclaration;
    });
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, (key) => rect(32, key === "home" ? 100 : 140));
    stubIcons(entering, (key) => rect(20, key === "home" ? 100 : 140));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().getAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe("");
    const home = animations.find((a) => a.el.textContent === "H")!;
    expect(home.options.duration, "the flight window follows the theme token").toBe(600);
    // The sweep is the DERIVED window plus margin: at 700ms the flight
    // is still on stage; past 900ms the fallback collects it.
    await vi.advanceTimersByTimeAsync(700);
    expect(flightLayer(h), "still flying inside the token-derived window").toBeTruthy();
    await vi.advanceTimersByTimeAsync(RAIL_FLIGHT_SWEEP_MARGIN_MS + 20);
    expect(flightLayer(h), "the sweep follows the stretched window").toBeNull();
    vi.mocked(window.getComputedStyle).mockRestore();
  });

  it("divides the written geometry by the ancestor draw scale (root zoom)", async () => {
    // drawnScale = drawn rect / laid size: stubbing the stage's laid
    // size to HALF its drawn box puts the flight at scale 2 — every
    // written px (insets, size, travel) must halve, or a root-level
    // `html { zoom }` renders the flight k times too far (the deletion
    // mutation ran 91 tests green before this pin existed).
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    const host = h.swap();
    stubRect(host, rect(0, 0, 240, 400));
    // The stage reads the HOST's laid size: 240/120 = 400/200 = 2.
    Object.defineProperty(host, "offsetWidth", { configurable: true, get: () => 120 });
    Object.defineProperty(host, "offsetHeight", { configurable: true, get: () => 200 });
    stubIcons(leaving, (key) => rect(32, key === "home" ? 100 : 140));
    stubIcons(entering, (key) => rect(20, key === "home" ? 100 : 140));

    await vi.advanceTimersByTimeAsync(0);

    const homeClone = flightLayer(h)!.querySelector<HTMLElement>(".hk-sidebar-rail-flight-clone")!;
    expect(homeClone.style.insetInlineStart, "inset halves at zoom 2").toBe("16px");
    expect(homeClone.style.insetBlockStart, "block inset halves at zoom 2").toBe("50px");
    expect(homeClone.style.width).toBe("8px");
    const home = animations.find((a) => a.el.textContent === "H")!;
    expect(home.keyframes.at(-1)!.transform, "travel halves at zoom 2").toBe(
      "translate(-6px, 0px)",
    );
  });

  it("measures the RTL inline offset INWARD from the docked right edge", async () => {
    // inset-inline-start in RTL maps to `right`, and a right inset grows
    // INWARD (leftward): the value is the icon's right edge measured
    // from the host's right edge. The sign the other way round wrote a
    // NEGATIVE inset — every clone landed outside the docked edge and
    // the clip ate the whole flight (the review's S1, RTL had zero
    // coverage before this test).
    const h = mountSwap();
    const realGCS = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      const declared = realGCS(el as HTMLElement);
      if (el !== h.swap()) return declared;
      // The host reads direction: rtl; everything else passes through.
      return new Proxy(declared, {
        get(target, prop) {
          if (prop === "direction") return "rtl";
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as CSSStyleDeclaration;
    });
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, (key) => rect(32, key === "home" ? 100 : 140));
    stubIcons(entering, (key) => rect(20, key === "home" ? 100 : 140));

    await vi.advanceTimersByTimeAsync(0);

    const homeClone = flightLayer(h)!.querySelector<HTMLElement>(".hk-sidebar-rail-flight-clone")!;
    // origin.right = 240, icon right = 48 → 192px inward from the right.
    expect(homeClone.style.insetInlineStart, "RTL inset measured inward from right").toBe(
      "192px",
    );
    // The travel stays PHYSICAL: the icon moves 12px left, same as LTR.
    const home = animations.find((a) => a.el.textContent === "H")!;
    expect(home.keyframes.at(-1)!.transform).toBe("translate(-12px, 0px)");
    vi.mocked(window.getComputedStyle).mockRestore();
  });

  it("flies the opposite way on expand (the delta is signed, per key)", async () => {
    const h = mountSwap();
    await h.set(true);
    // Let the first flight arm AND settle (sweep budget), so the second
    // flip starts from a clean host.
    await vi.advanceTimersByTimeAsync(RAIL_FLIGHT_MS + RAIL_FLIGHT_SWEEP_MARGIN_MS + 50);
    expect(flightLayer(h)).toBeNull();
    animations.length = 0;

    await h.set(false);
    const { leaving, entering } = dissolvePair(h, false);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    // Distinct tracks per key so a mixed-up pairing cannot pass: home at
    // y=100, inbox at y=160 — leaving (rail) at x=20, entering (full) at
    // x=32 → +12px rightward on BOTH keys.
    stubIcons(leaving, (key) => rect(20, key === "home" ? 100 : 160));
    stubIcons(entering, (key) => rect(32, key === "home" ? 100 : 160));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().getAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe("");
    for (const a of animations) {
      expect(a.keyframes.at(-1)!.transform, `${a.el.textContent} flies right`).toBe(
        "translate(12px, 0px)",
      );
    }
    expect(animations).toHaveLength(2);
    // The expand direction hides by the same pairing rule: the rail's
    // fallback cell ("rail-only" — no expanded counterpart) stays
    // unmarked and dissolves.
    const solo = leaving.querySelector(`[${RAIL_FLIP_ICON_ATTR}="rail-only"]`)!;
    expect(solo.hasAttribute(RAIL_FLIP_FLYING_ATTR), "unmatched cell never marked").toBe(false);
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
    h.swap()
      .querySelector(`:scope > .hk-crossfade-item[${RAIL_FLIP_ITEM_ATTR}="full"]`)
      ?.remove();
    stubRect(h.swap(), rect(0, 0, 240, 400));

    await vi.advanceTimersByTimeAsync(0);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    expect(flightLayer(h)).toBeNull();
    expect(animations).toHaveLength(0);
  });

  it("the WAAPI finish sweeps the layer before the fallback budget", async () => {
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(32, 100));
    stubIcons(entering, () => rect(20, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h)).toBeTruthy();
    // The real browser's healthy path: the animation finishes at ~300ms.
    animations[0]!.fire("finish");
    expect(flightLayer(h), "the finish listener sweeps immediately").toBeNull();
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
    // The marks ride along: a swept flight unhides BOTH ends — the
    // leaving cell it substituted AND the entering cell it covered
    // (deleting the unmark loop once stayed green on this side; the pin
    // closes that hole — 2026-11-02 review S3-1).
    expect(
      leaving.querySelector(`[${RAIL_FLIP_ICON_ATTR}="home"]`)!.hasAttribute(RAIL_FLIP_FLYING_ATTR),
      "leaving mark cleared",
    ).toBe(false);
    expect(
      entering.querySelector(`[${RAIL_FLIP_ICON_ATTR}="home"]`)!.hasAttribute(RAIL_FLIP_FLYING_ATTR),
      "ENTERING mark cleared",
    ).toBe(false);
  });

  it("sweeps the layer and the attribute when the fallback budget expires", async () => {
    const h = mountSwap();
    await h.set(true);
    const { leaving, entering } = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(leaving, () => rect(32, 100));
    stubIcons(entering, () => rect(20, 100));

    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h)).toBeTruthy();
    await vi.advanceTimersByTimeAsync(RAIL_FLIGHT_MS + RAIL_FLIGHT_SWEEP_MARGIN_MS + 10);
    expect(flightLayer(h), "the sweep timer removes the layer").toBeNull();
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(false);
  });

  it("a replaced flight's late finish never sweeps its successor (stale-finish race)", async () => {
    // The 2026-11-02 review's scratch probe: flight #1's WAAPI animation
    // keeps ticking after a fresh flip swept the stage — its finish
    // listener must not act on flight #2's layer, marks or attribute.
    const h = mountSwap();
    await h.set(true);
    let pair = dissolvePair(h, true);
    stubRect(h.swap(), rect(0, 0, 240, 400));
    stubIcons(pair.leaving, () => rect(32, 100));
    stubIcons(pair.entering, () => rect(20, 100));
    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h)).toBeTruthy();
    const firstFlightCount = animations.length;

    // Flip #2 BEFORE flight #1 finishes: the replacement sweeps the stage…
    await h.set(false);
    pair = dissolvePair(h, false);
    stubIcons(pair.leaving, () => rect(20, 100));
    stubIcons(pair.entering, () => rect(32, 100));
    await vi.advanceTimersByTimeAsync(0);
    expect(flightLayer(h), "flight #2 is on stage").toBeTruthy();
    const secondFlightAnims = animations.slice(firstFlightCount);

    // …then flight #1's finish fires late: a no-op for the successor.
    animations[0]!.fire("finish");
    expect(flightLayer(h), "the successor's layer survives a stale finish").toBeTruthy();
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR), "the successor stays armed").toBe(true);
    expect(
      pair.leaving
        .querySelector(`[${RAIL_FLIP_ICON_ATTR}="home"]`)!
        .hasAttribute(RAIL_FLIP_FLYING_ATTR),
      "the successor's hide marks survive",
    ).toBe(true);
    // …and flight #2's own finish still sweeps normally.
    secondFlightAnims[0]!.fire("finish");
    expect(flightLayer(h)).toBeNull();
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
    const layers = h.swap().querySelectorAll(".hk-sidebar-rail-flight");
    expect(layers, "exactly one flight layer").toHaveLength(1);
    expect(h.swap().hasAttribute(RAIL_FLIP_ACTIVE_ATTR)).toBe(true);
  });
});
