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

import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type VNodeChild } from "vue";

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

const MOUNT_SLOTS = {
  default: () => h("div", { class: "content" }, "rows"),
  dockBottom: () => h("div", { class: "the-dock" }, "dock"),
};

const scss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "HkScrollContainer.scss"),
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
  });
});
