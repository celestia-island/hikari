// Ride-placement contract for HkScrollContainer's bottom dock
// (`dockMode="ride"`, 2026-11-10 user ruling).
//
// The ruling: the air between a cruise canvas's last card and its dock
// must be EXACTLY one dock height, with the dock following the content
// (short content: the dock trails the content end and the leftover window
// height falls below it; long content: the dock stays on the visible
// bottom edge and never scrolls away). The two older placements cannot
// express that — the dock slots (`dockMode="pin"`) shrink the viewport
// permanently, and `dockTailClearance` only spends a shell-published
// occupancy on content whose dock floats over the scroll area from
// OUTSIDE the flow.
//
// So ride mounts, INSIDE the viewport and after the slot content:
//   1. `.hk-scroll-dock-ride-spacer` — a block spacer exactly the
//      measured dock height (`--hk-scroll-dock-bottom`, the same var pin
//      mode publishes for consumer padding): the one-dock-height air;
//   2. `.hk-scroll-dock.hk-scroll-dock-ride[data-side="bottom"]` —
//      `position: sticky; bottom: 0`, which is what makes the dock follow
//      the content instead of the window.
//
// The `.hk-scroll-dock` class on that wrapper is LOAD-BEARING: consumers
// detect a container-owned dock by `closest(".hk-scroll-dock")` (chest's
// DockBar stops publishing shell-level clearance that way), so renaming
// it would double-clear the same dock.
//
// This is NOT the retired frame-level reservation: that one reserved
// room for a dock painted elsewhere (a shell-fixed plane), so the band
// showed as dead air before the scroll end. Here the dock's own body is
// the in-flow child; the band IS its measured box. The "spacer spends
// exactly the measured height, never height + breathing room" style
// assertion below is the mutation guard for that (a `+ 16px` / fixed-px
// recipe must go red).
//
// Pointer contract (2026-11-10 review S1): while pinned, the ride wrapper
// covers a band of content (full width × dock height in a column-flex
// viewport), so the wrapper and the spacer are `pointer-events: none` and
// the dock SURFACE opts back in itself (HkDockBar / chest DockBar: wrapper
// transparent, surface catches). The pin wrapper must stay hit-testable —
// its own assertions below guard that.
//
// Host requirements (2026-11-10 review S0): ride only follows the content
// when the content box may end above the viewport bottom. In a column-flex
// strip viewport a `min-height: 100%` lanes box is as tall as the viewport,
// so the in-flow spacer + dock sit below the fold and the air reverts to the
// window's leftover. HkKanban therefore prints `data-dock-mode="ride"` on
// its root and releases its lanes box under that hook — ride only, so no
// existing board changes. The sheet half is asserted at the bottom of this
// file; the observer half (a runtime-removed dock must zero the published
// height) is asserted in the ride suite.
//
// happy-dom has no layout engine, so the geometry half of the contract is
// pinned two ways: the render/DOM placement here, and the sticky/spacer
// CSS as a source contract (the same discipline as
// HkScrollContainer.dock.test.tsx and .fade.contract.test.ts). The
// measurement half is exercised by stubbing the dock wrapper's measured
// rect, so the published var — the spacer's only height source — is
// checked against the dock it describes.
//
// House style: raw createApp mounts on shared containers (no
// @vue/test-utils).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, shallowRef, type VNodeChild } from "vue";

import HkKanban from "./HkKanban";
import HkScrollContainer from "./HkScrollContainer";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
let restoreRect: (() => void) | null = null;

function mountDock(
  slots: Record<string, () => VNodeChild>,
  props: Record<string, unknown> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const app = createApp(defineComponent({
    setup() {
      return () => h(HkScrollContainer, props, slots);
    },
  }));
  mounts.push(app);
  return app.mount(container);
}

/** Mount with a REACTIVE dockMode so a runtime placement swap can be
 *  exercised (the dock moves between the pin sibling and the ride
 *  position, so the measured-height observer has to re-point). */
function mountSwappable(
  slots: Record<string, () => VNodeChild>,
  initial: "pin" | "ride",
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const mode = ref<"pin" | "ride">(initial);
  const app = createApp(defineComponent({
    setup() {
      return () => h(HkScrollContainer, { dockMode: mode.value }, slots);
    },
  }));
  mounts.push(app);
  const vm = app.mount(container) as unknown as { $el: HTMLElement };
  return { host: vm.$el, mode };
}

/** Make the element(s) matching `selector` report a real rendered height
 *  (happy-dom reports zeros, so the measurement half of the contract
 *  would otherwise be untestable). Everything else keeps the default
 *  zero rect, exactly as before. */
function stubMeasuredHeight(selector: string, height: number) {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this instanceof Element && this.matches(selector)) {
      const rect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: height,
        width: 0,
        height,
        toJSON: () => ({}),
      };
      return rect as DOMRect;
    }
    return original.call(this);
  };
  restoreRect = () => {
    Element.prototype.getBoundingClientRect = original;
    restoreRect = null;
  };
}

function rectangleOf(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

/** happy-dom performs no layout, so scroll geometry is stubbed on the
 *  viewport instance and a `refresh()` pass re-senses the overflow (house
 *  pattern, HkScrollContainer.test.ts). */
function stubGeometry(
  el: HTMLElement,
  geom: {
    scrollWidth?: number;
    clientWidth?: number;
    scrollLeft?: number;
    scrollHeight?: number;
    clientHeight?: number;
    scrollTop?: number;
  },
) {
  const desc: PropertyDescriptorMap = {};
  for (const [key, value] of Object.entries(geom)) {
    desc[key] = { configurable: true, get: () => value };
  }
  Object.defineProperties(el, desc);
}

/** The physical edges the shared <HkEdgeGlow> is painting right now. */
function bandsOf(host: HTMLElement): (string | null)[] {
  return Array.from(host.querySelectorAll<HTMLElement>(".hk-edge-glow-band"), (band) =>
    band.getAttribute("data-edge"),
  );
}

/** Mount keeping the container's exposed API (for `refresh()`), which the
 *  bare `mountDock` helper hides behind its wrapper component. */
function mountWithApi(
  slots: Record<string, () => VNodeChild>,
  props: Record<string, unknown> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const api = shallowRef<{ refresh: () => void } | null>(null);
  const app = createApp(defineComponent({
    setup() {
      return () => h(HkScrollContainer, {
        ...props,
        ref: (el: unknown) => {
          api.value = el as { refresh: () => void } | null;
        },
      }, slots);
    },
  }));
  mounts.push(app);
  const vm = app.mount(container) as unknown as { $el: HTMLElement };
  return { host: vm.$el, api };
}

/** Injectable ResizeObserver (house pattern: HkAuthCard / HkScrollProgressDock
 *  precedent), per-test opt-in. It exists for the WIRING half of the
 *  measurement contract — the §6 review found that deleting the
 *  `dockRO.observe(...)` calls kept the whole suite green, i.e. "the air
 *  follows a dock reflow" had no guard at all: the synchronous publish on
 *  mount is all a happy-dom run can observe. `live` is what is watched
 *  right now (observe adds, disconnect clears), `observed` keeps the
 *  history, `disconnects` counts re-points. */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  live: Element[] = [];
  observed: Element[] = [];
  disconnects = 0;

  constructor(_callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
    if (!this.live.includes(el)) this.live.push(el);
  }
  unobserve(el: Element): void {
    this.live = this.live.filter((entry) => entry !== el);
  }
  disconnect(): void {
    this.disconnects += 1;
    this.live = [];
  }
}

const MOUNT_SLOTS = {
  default: () => h("div", { class: "content" }, "rows"),
  dockBottom: () => h("div", { class: "the-dock" }, "dock"),
};

const scss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "HkScrollContainer.scss"),
  "utf8",
);

/** The board's own sheet — the ride board's content-height switch lives
 *  there (see the S0 block in the ride contract tests). */
const kanbanScss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "HkKanban.scss"),
  "utf8",
);

afterEach(() => {
  restoreRect?.();
  for (const app of mounts) app.unmount();
  mounts.length = 0;
  for (const el of containers) el.remove();
  containers.length = 0;
});

describe("HkScrollContainer ride-mode bottom dock", () => {
  it("mounts the spacer then the dock inside the viewport, after the content", () => {
    const vm = mountDock(MOUNT_SLOTS, { dockMode: "ride" });
    const host = vm.$el as HTMLElement;
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    const spacer = viewport.querySelector(".hk-scroll-dock-ride-spacer");
    const dock = viewport.querySelector(".hk-scroll-dock.hk-scroll-dock-ride[data-side='bottom']");
    expect(spacer, "ride spacer mounts").toBeTruthy();
    expect(dock, "ride dock mounts").toBeTruthy();

    // In the CONTENT FLOW (sticky needs the scrolling ancestor), not a
    // flex sibling — that is the whole difference from pin mode.
    expect(viewport.contains(dock as Node)).toBe(true);
    expect(viewport.contains(spacer as Node)).toBe(true);
    // Fixed order: content, spacer, dock — the air sits BEHIND the
    // content end, never in front of it.
    expect([...viewport.children].map((child) => child.className)).toEqual([
      "content",
      "hk-scroll-dock-ride-spacer",
      "hk-scroll-dock hk-scroll-dock-ride",
    ]);
    // The wrapper keeps the load-bearing class consumers detect a
    // container-owned dock by (chest's DockBar: closest(".hk-scroll-dock")
    // → no shell-level clearance publication), and only ONE dock node is
    // rendered (no pin sibling left behind).
    expect(dock!.classList.contains("hk-scroll-dock")).toBe(true);
    expect(host.querySelectorAll(".hk-scroll-dock")).toHaveLength(1);
    // Decorative spacer: it must not enter the a11y tree.
    expect(spacer!.getAttribute("aria-hidden")).toBe("true");
    // The dock content is the slot's own node.
    expect(dock!.querySelector(".the-dock")).toBeTruthy();
    // The root carries the ride hook (additive, like data-dock-tail): the
    // sheet spends it to zero the container's own bottom fade band, which
    // would otherwise dissolve the dock's lower limb while content
    // overflows over the pinned ride dock.
    expect(host.getAttribute("data-dock-mode")).toBe("ride");
  });

  it("publishes the measured ride dock height as the var the spacer spends", () => {
    // The spacer's only height source is --hk-scroll-dock-bottom, so the
    // published value must be the RIDE WRAPPER's measured height (the same
    // contract pin mode publishes for consumer end-padding) — otherwise
    // the air stops tracking dock reflows.
    stubMeasuredHeight(".hk-scroll-dock-ride", 139);
    const vm = mountDock(MOUNT_SLOTS, { dockMode: "ride" });
    const host = vm.$el as HTMLElement;
    const dock = host.querySelector<HTMLElement>(".hk-scroll-dock-ride")!;
    expect(Math.round(rectangleOf(dock).height)).toBe(139);
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("139px");
    // No top dock mounted → the top var is published as the inert 0px.
    expect(host.style.getPropertyValue("--hk-scroll-dock-top")).toBe("0px");
  });

  it("re-points the measurement at the wrapper a runtime swap mounts", async () => {
    const { host, mode } = mountSwappable(MOUNT_SLOTS, "pin");
    expect(host.querySelector(".hk-scroll-dock-ride")).toBeNull();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("0px");

    stubMeasuredHeight(".hk-scroll-dock-ride", 139);
    mode.value = "ride";
    await nextTick();
    expect(host.querySelector<HTMLElement>(".hk-scroll-dock-ride")).toBeTruthy();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("139px");
  });

  it("zeroes the published height when the dock slot disappears at runtime", async () => {
    // S3: the published height is the spacer's only source, so a dock that
    // is removed at runtime must not leave the observation (and the px
    // value) behind — in ride mode that would stand a spacer on the page
    // for a dock that no longer exists.
    stubMeasuredHeight(".hk-scroll-dock-ride", 139);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const show = ref(true);
    const app = createApp(defineComponent({
      setup() {
        return () => {
          const slots: Record<string, () => VNodeChild> = {
            default: () => h("div", { class: "content" }, "rows"),
          };
          if (show.value) slots.dockBottom = () => h("div", { class: "the-dock" }, "dock");
          return h(HkScrollContainer, { dockMode: "ride" }, slots);
        };
      },
    }));
    mounts.push(app);
    const host = (app.mount(container) as unknown as { $el: HTMLElement }).$el;
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("139px");

    show.value = false;
    await nextTick();
    expect(host.querySelector(".hk-scroll-dock-ride")).toBeNull();
    expect(host.querySelector(".hk-scroll-dock-ride-spacer")).toBeNull();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("0px");
    expect(host.style.getPropertyValue("--hk-scroll-dock-top")).toBe("0px");
    // … and the ride hook follows the dock out (S2-2): no dock, no hook.
    expect(host.getAttribute("data-dock-mode")).toBeNull();
  });

  it("drops the bottom glow band under a mounted ride dock (pin keeps it)", async () => {
    // S2-1: the shared <HkEdgeGlow> painter lives on the container root at
    // z-index 2, i.e. ABOVE the viewport — with a ride dock inside that
    // viewport its bottom band would paint over the dock's own lower limb,
    // the same edge the fade mask stops painting. Filtered in the
    // component (the painter is shared and must not learn Ride).
    const ride = mountWithApi(MOUNT_SLOTS, { dockMode: "ride", overflowGlow: true });
    const rideViewport = ride.host.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    stubGeometry(rideViewport, { scrollHeight: 300, clientHeight: 100, scrollTop: 100 });
    ride.api.value!.refresh();
    await nextTick();
    // Content hides on BOTH sides, so the verdict lights two edges — the
    // ride dock's bottom one is the only one dropped.
    expect(ride.host.getAttribute("data-v-overflow")).toBe("both");
    expect(bandsOf(ride.host)).toEqual(["top"]);

    const pin = mountWithApi(MOUNT_SLOTS, { overflowGlow: true });
    const pinViewport = pin.host.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    stubGeometry(pinViewport, { scrollHeight: 300, clientHeight: 100, scrollTop: 100 });
    pin.api.value!.refresh();
    await nextTick();
    expect(bandsOf(pin.host)).toEqual(["top", "bottom"]);
  });

  it("warns once in dev when autoFollow is combined with a ride dock", async () => {
    // S2-3: the combination reproduces the full-height-content trap that
    // S0 fixed (autoFollow bottom-anchors a min-height:100% box), so it is
    // documented as unsupported and called out once in dev builds.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const vm = mountDock(MOUNT_SLOTS, { dockMode: "ride", autoFollow: true });
      await nextTick();
      const rideWarnings = () =>
        warn.mock.calls.filter((call) => String(call[0]).includes('dockMode="ride"'));
      expect(rideWarnings().length, "the unsupported combination is called out").toBe(1);
      (vm as unknown as { $forceUpdate: () => void }).$forceUpdate();
      await nextTick();
      expect(rideWarnings().length, "once per mount, not per re-render").toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not publish the dock-edge fade in ride mode", () => {
    // The fade is a MASK on the viewport, and the ride dock now lives
    // inside that viewport — the same band would fade the dock's own
    // bottom edge. Ride needs no dissolve either: the air between content
    // and dock is the dock's measured height, not leftover clipping.
    const ride = mountDock(MOUNT_SLOTS, { dockMode: "ride" });
    expect((ride.$el as HTMLElement).getAttribute("data-dock-fade")).toBeNull();
    const pin = mountDock(MOUNT_SLOTS);
    expect((pin.$el as HTMLElement).getAttribute("data-dock-fade")).toBe("bottom");
  });

  it("rides when the axis is both", () => {
    const vm = mountDock(MOUNT_SLOTS, { dockMode: "ride", axis: "both" });
    const host = vm.$el as HTMLElement;
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.querySelector(".hk-scroll-dock-ride-spacer")).toBeTruthy();
    expect(viewport.querySelector(".hk-scroll-dock-ride")).toBeTruthy();
  });

  it("falls back to the pin placement on a horizontal axis", () => {
    // The tail of a horizontal container is its CROSS axis: an in-flow
    // block child there leaks onto the hidden vertical axis (the measured
    // defect that also gates the dockTailClearance spacer), so ride is
    // gated off and the pre-2026-11-10 render stands.
    const vm = mountDock(MOUNT_SLOTS, { dockMode: "ride", axis: "horizontal" });
    const host = vm.$el as HTMLElement;
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.querySelector(".hk-scroll-dock-ride-spacer")).toBeNull();
    expect(viewport.querySelector(".hk-scroll-dock-ride")).toBeNull();
    const dock = host.querySelector(".hk-scroll-dock[data-side='bottom']")!;
    expect(viewport.contains(dock)).toBe(false);
  });

  it("renders no ride chrome without a bottom dock slot", () => {
    const vm = mountDock(
      { default: () => h("div", { class: "content" }, "rows") },
      { dockMode: "ride" },
    );
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock-ride-spacer")).toBeNull();
    expect(host.querySelector(".hk-scroll-dock-ride")).toBeNull();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("");
    // S2-2: a requested-but-empty slot is legal, and nothing owns the
    // viewport's bottom edge then — so the ride hook must NOT be emitted
    // (it would zero the fade band, drop the glow band and pad the
    // scrollport for a dock that is not there).
    expect(host.getAttribute("data-dock-mode")).toBeNull();
  });

  it("leaves the pin placement byte-compatible", () => {
    // dockMode is additive: the default must keep today's DOM exactly —
    // sibling dock, no spacer, no ride class, dock fade published, both
    // measured-height vars on the host.
    const vm = mountDock(MOUNT_SLOTS);
    const host = vm.$el as HTMLElement;
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.querySelector(".hk-scroll-dock-ride-spacer")).toBeNull();
    expect(host.querySelector(".hk-scroll-dock-ride")).toBeNull();
    const dock = host.querySelector(".hk-scroll-dock[data-side='bottom']")!;
    expect(viewport.contains(dock)).toBe(false);
    expect(dock.className).toBe("hk-scroll-dock");
    expect(host.getAttribute("data-dock-fade")).toBe("bottom");
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("0px");
    // Additive-only: a pin container keeps its pre-2026-11-10 attribute set.
    expect(host.getAttribute("data-dock-mode")).toBeNull();
  });
});

describe("HkScrollContainer ride placement style contract", () => {
  it("makes the dock sticky to the visible bottom edge, above the content", () => {
    // Source contract, because happy-dom computes no layout: sticky is
    // what makes the dock follow the CONTENT (short) and pin to the
    // visible bottom (long). Dropping `position: sticky` (or `bottom: 0`)
    // turns the dock back into an ordinary flow box that scrolls away —
    // the exact defect this placement exists to fix.
    const ride = scss.match(/\.hk-scroll-dock-ride\s*\{[^}]*\}/);
    expect(ride, "ride dock rule exists").not.toBeNull();
    expect(ride![0]).toMatch(/position:\s*sticky/);
    expect(ride![0]).toMatch(/bottom:\s*0/);
    // A compressed dock would break the one-dock-height air.
    expect(ride![0]).toMatch(/flex:\s*none/);
    // While pinned it paints over the content scrolling under it.
    expect(ride![0]).toMatch(/z-index:\s*1/);
  });

  it("spends exactly the measured dock height on a block spacer", () => {
    const spacer = scss.match(/\.hk-scroll-dock-ride-spacer\s*\{[^}]*\}/);
    expect(spacer, "ride spacer rule exists").not.toBeNull();
    // `display: block` is what makes a height apply in the DEFAULT block
    // viewport at all (the measured dockTailClearance lesson: a bare
    // inline box ignores `height`), and `flex: none` survives a
    // flex-ified viewport.
    expect(spacer![0]).toMatch(/display:\s*block/);
    expect(spacer![0]).toMatch(/flex:\s*none/);
    const height = spacer![0].match(/(?:^|[;{\s])height:\s*([^;]+);/)?.[1]?.trim();
    // EXACTLY the published var, with no breathing room and no magic px:
    // `calc(var(...) + 16px)`, a fixed height or a hard-coded 139px all
    // mean the air is no longer one dock height.
    expect(height).toBe("var(--hk-scroll-dock-bottom, 0px)");
  });

  it("pads the scrollport by the dock band so jumps clear the pinned dock", () => {
    // A pinned ride dock covers the viewport's last band, so a
    // `scrollIntoView` / focus jump that parks content at the bottom edge
    // lands it UNDER the dock. `scroll-padding-bottom` belongs on the
    // scrollport (the viewport) and is exactly this band; keyed on the ride
    // hook, which is emitted only while the dock is mounted.
    const rule = scss.match(
      /\.hk-scroll-container\[data-dock-mode="ride"\] > \.hk-scroll-container-viewport \{[^}]*\}/,
    );
    expect(rule, "the ride viewport reserves the dock band for jumps").not.toBeNull();
    expect(rule![0]).toMatch(
      /scroll-padding-bottom:\s*var\(--hk-scroll-dock-bottom,\s*0px\)/,
    );
  });

  it("zeroes the container's own bottom fade band in ride mode", () => {
    // S2-c: the ride dock lives INSIDE the viewport at its trailing edge,
    // so the container's own fade mask dissolves the dock's lower limb
    // exactly when the content overflows over the pinned dock
    // (data-v-overflow="end" lights the band). The dock body IS the edge
    // treatment there — the same reason no dock-edge fade is published for
    // a ride placement — so the sheet spends the root's ride hook to zero
    // that band, and it must be declared AFTER the lit-band state rules:
    // same specificity (0,3,0), source order decides.
    const suppression = scss.match(
      /\.hk-scroll-container\[data-fade="true"\]\[data-dock-mode="ride"\] \{[^}]*\}/,
    );
    expect(suppression, "ride zeroes the viewport's bottom fade band").not.toBeNull();
    expect(suppression![0]).toMatch(/--hk-scroll-fade-bottom:\s*0px/);
    const lastBandRule = scss.search(
      /\.hk-scroll-container\[data-fade="true"\]\[data-v-overflow="both"\]/,
    );
    expect(lastBandRule, "the lit-band state rules exist").toBeGreaterThan(-1);
    expect(
      scss.indexOf(suppression![0]),
      "the suppression wins on source order, not on specificity",
    ).toBeGreaterThan(lastBandRule);
    // Pin keeps its band: the state rule that lights it is untouched, and
    // the suppression is keyed on the ride hook only.
    expect(scss).toMatch(
      /\.hk-scroll-container\[data-fade="true"\]\[data-v-overflow="end"\] \{\s*--hk-scroll-fade-bottom: calc\(/,
    );
  });

  it("passes pointer input through the ride band and keeps the pin wrapper hit-testable", () => {
    // While pinned, the ride wrapper covers a whole band of the visible
    // area (a column-flex viewport stretches it to full width × dock
    // height). An `auto` hit target there would swallow every click and
    // hover on the cards under that band — a defect the pin placement
    // structurally cannot have, because its dock is a sibling OUTSIDE the
    // viewport. Ride therefore follows the floating-dock contract
    // (HkDockBar / chest DockBar: transparent anchor box, catching
    // surface): the wrapper and the air spacer are both transparent to
    // input, and the dock SURFACE opts back in itself.
    const ride = scss.match(/\.hk-scroll-dock-ride\s*\{[^}]*\}/);
    expect(ride, "ride dock rule exists").not.toBeNull();
    expect(ride![0]).toMatch(/pointer-events:\s*none/);
    const spacer = scss.match(/\.hk-scroll-dock-ride-spacer\s*\{[^}]*\}/);
    expect(spacer![0]).toMatch(/pointer-events:\s*none/);

    // The other half of the contract: the PIN wrapper must stay a normal
    // hit target. It cannot cover content (it is a flex sibling of the
    // viewport), and existing consumers rely on it receiving events —
    // making it transparent would turn their dock into a dead surface.
    // So no plain `.hk-scroll-dock*` rule (i.e. every one that is not a
    // ride rule) may declare pointer-events at all.
    const plainDockRules = (scss.match(/\.hk-scroll-dock[^{}\n]*\{[^}]*\}/g) ?? []).filter(
      (block) => !/\.hk-scroll-dock-ride/.test(block.slice(0, block.indexOf("{"))),
    );
    expect(plainDockRules.length, "the plain dock rules still exist").toBeGreaterThan(0);
    for (const block of plainDockRules) {
      expect(
        block,
        `the pin dock wrapper must stay hit-testable: ${block}`,
      ).not.toMatch(/pointer-events/);
    }
  });
});

describe("HkScrollContainer dock-size observer wiring", () => {
  const originalRO = globalThis.ResizeObserver;

  function installFakeRO() {
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  }

  it("watches the dock wrapper it measures in both placements", () => {
    // §6 mutation blind spot: with only the synchronous publish asserted,
    // deleting `dockRO.observe(...)` left the whole suite green — so a dock
    // reflow (a model row changing, a breakpoint switch) could stop moving
    // the air without a single red test. These assertions are the guard.
    installFakeRO();
    try {
      const pin = mountDock(MOUNT_SLOTS);
      const pinDock = (pin.$el as HTMLElement).querySelector(".hk-scroll-dock[data-side='bottom']")!;
      expect(
        FakeResizeObserver.instances.some((ro) => ro.live.includes(pinDock)),
        "the pin wrapper is watched (else a dock reflow never re-publishes)",
      ).toBe(true);

      const ride = mountDock(MOUNT_SLOTS, { dockMode: "ride" });
      const rideDock = (ride.$el as HTMLElement).querySelector(".hk-scroll-dock-ride")!;
      expect(
        FakeResizeObserver.instances.some((ro) => ro.live.includes(rideDock)),
        "the ride wrapper is watched (in ride mode the measurement IS the air)",
      ).toBe(true);
    } finally {
      globalThis.ResizeObserver = originalRO;
    }
  });

  it("re-points the observation at the wrapper a placement swap mounts", async () => {
    installFakeRO();
    try {
      const { host, mode } = mountSwappable(MOUNT_SLOTS, "pin");
      const pinDock = host.querySelector<HTMLElement>(".hk-scroll-dock[data-side='bottom']")!;
      expect(FakeResizeObserver.instances.some((ro) => ro.live.includes(pinDock))).toBe(true);

      mode.value = "ride";
      await nextTick();
      const rideDock = host.querySelector<HTMLElement>(".hk-scroll-dock-ride")!;
      const watching = FakeResizeObserver.instances.filter((ro) => ro.live.includes(rideDock));
      expect(watching.length, "the new ride wrapper is watched").toBeGreaterThan(0);
      expect(
        FakeResizeObserver.instances.some((ro) => ro.live.includes(pinDock)),
        "the unmounted pin wrapper is no longer watched by anything",
      ).toBe(false);
      expect(
        watching.some((ro) => ro.disconnects > 0),
        "the swap re-pointed the observer instead of stacking a second one",
      ).toBe(true);
    } finally {
      globalThis.ResizeObserver = originalRO;
    }
  });
});

describe("HkKanban ride-dock forwarding", () => {
  function mountKanban(
    props: Record<string, unknown>,
    slots: Record<string, unknown> = {},
  ) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp(defineComponent({
      setup() {
        return () => h(HkKanban, {
          lanes: [{ id: "a" }, { id: "b" }],
          laneKeyOf: (lane: unknown) => (lane as { id: string }).id,
          cardsOf: () => [{ id: "c" }],
          ...props,
        }, {
          card: () => h("div", { class: "card" }, "card"),
          ...slots,
        });
      },
    }));
    mounts.push(app);
    return app.mount(container) as unknown as { $el: HTMLElement };
  }

  it("forwards dockMode and the dockBottom slot onto the vertical strip", () => {
    const vm = mountKanban(
      { axis: "vertical", dockMode: "ride" },
      { dockBottom: () => h("div", { class: "board-dock" }, "dock") },
    );
    const strip = vm.$el.querySelector<HTMLElement>(".hk-kanban-strip")!;
    const viewport = strip.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.querySelector(".hk-scroll-dock-ride-spacer")).toBeTruthy();
    const dock = viewport.querySelector(".hk-scroll-dock.hk-scroll-dock-ride[data-side='bottom']");
    expect(dock, "board dock rides the strip content").toBeTruthy();
    expect(dock!.querySelector(".board-dock")).toBeTruthy();
    expect(dock!.querySelector(".board-dock")!.textContent).toBe("dock");
    // The board also carries the ride hook that releases its full-height
    // lanes box (see HkKanban.scss): without it the in-flow spacer + dock
    // sit below the fold and the air reverts to the window's leftover.
    expect(vm.$el.getAttribute("data-dock-mode")).toBe("ride");
  });

  it("forwards the same slot to the pin placement when dockMode is the default", () => {
    const vm = mountKanban(
      { axis: "both" },
      { dockBottom: () => h("div", { class: "board-dock" }, "dock") },
    );
    const strip = vm.$el.querySelector<HTMLElement>(".hk-kanban-strip")!;
    const viewport = strip.querySelector(".hk-scroll-container-viewport")!;
    const dock = strip.querySelector(".hk-scroll-dock[data-side='bottom']")!;
    expect(dock).toBeTruthy();
    expect(strip.querySelector(".hk-scroll-dock-ride")).toBeNull();
    // Pin placement: the dock owns the strip's edge, outside the scroll flow.
    expect(viewport.contains(dock)).toBe(false);
    // No ride hook: a pin board keeps the full-height lanes box it always
    // had, so the release rule cannot reach an existing board.
    expect(vm.$el.getAttribute("data-dock-mode")).toBeNull();
  });

  it("emits no ride hook while the board's dock slot is empty", () => {
    // S2-2, board side: `dockMode="ride"` with a conditionally absent dock
    // is legal — releasing the lanes box then would only shrink a short
    // board's lane chrome with no dock to justify it.
    const vm = mountKanban({ axis: "vertical", dockMode: "ride" });
    expect(vm.$el.getAttribute("data-dock-mode")).toBeNull();
    expect(vm.$el.querySelector(".hk-scroll-dock-ride")).toBeNull();
  });

  it("ignores the slot on a horizontal board (the cross-axis tail)", () => {
    // The default axis: pre-2026-11-10 shape — no forwarded dock slot and
    // no ride chrome, because a horizontal strip's tail is its cross axis.
    const vm = mountKanban(
      { axis: "horizontal", dockMode: "ride" },
      { dockBottom: () => h("div", { class: "board-dock" }, "dock") },
    );
    const strip = vm.$el.querySelector<HTMLElement>(".hk-kanban-strip")!;
    expect(strip.querySelector(".hk-scroll-dock")).toBeNull();
    expect(strip.querySelector(".hk-scroll-dock-ride-spacer")).toBeNull();
    // Ride does not apply on the cross axis, so neither does the hook (the
    // lanes release would shrink a horizontal board's lane columns).
    expect(vm.$el.getAttribute("data-dock-mode")).toBeNull();
  });
});

describe("HkKanban ride board content-height contract", () => {
  it("releases the full-height lanes box under the ride hook only", () => {
    // S0, measured on a real board: in a column-flex strip viewport
    // `min-height: 100%` makes the lanes BOX as tall as the viewport, so
    // the in-flow spacer + sticky dock always sit below the fold — the dock
    // can only hug the bottom edge and the air goes back to being the
    // window's leftover (275.8px static / 563.8px scrolled against a 139px
    // dock). Releasing it is the half of the contract that makes the air
    // follow the CONTENT end.
    const release = kanbanScss.match(
      /\.hk-kanban\[data-dock-mode="ride"\] \.hk-kanban-lanes \{[^}]*\}/,
    );
    expect(release, "the ride boards release their lanes min-height").not.toBeNull();
    expect(release![0]).toMatch(/min-height:\s*0/);
    // The base rule keeps the fill for every other mode (pin, horizontal
    // boards): a short board still reaches the strip's floor there.
    const base = kanbanScss.match(/\.hk-kanban-lanes \{[^}]*\}/);
    expect(base, "the lanes base rule exists").not.toBeNull();
    expect(base![0]).toMatch(/min-height:\s*100%/);
    // And the release is the ONLY min-height override on the lanes box: an
    // ungated one would change every board.
    const overrides = (kanbanScss.match(/\.hk-kanban[^{}]*\.hk-kanban-lanes \{[^}]*\}/g) ?? [])
      .filter((block) => /min-height/.test(block));
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toContain('[data-dock-mode="ride"]');
  });
});
