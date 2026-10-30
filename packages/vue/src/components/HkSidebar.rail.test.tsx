import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";

import HSidebar from "./HkSidebar";

/**
 * HkSidebar's own rail + peek surface (2026-10-30): the standalone panel
 * composes the SAME state machine (useSidebarRail) and the SAME geometry
 * classes (HkSidebarRail.scss) the shell uses — this file pins the
 * composition, the v-model channel (update:collapsed), and that the
 * legacy collapsed mode (no collapsible prop) renders byte-for-byte the
 * old widths. The machine's timing itself is pinned in
 * composables/useSidebarRail.test.ts.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface SidebarSlotParams {
  collapsed: boolean;
  peeking: boolean;
  closePeek: () => void;
}

function mountSidebar(props: Record<string, unknown> = {}) {
  const slotParams: SidebarSlotParams[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Harness = defineComponent({
    name: "SidebarHarness",
    setup() {
      const collapsed = ref((props.collapsed as boolean) ?? false);
      return () =>
        h(HSidebar, {
          ...props,
          collapsed: collapsed.value,
          "onUpdate:collapsed": (v: boolean) => {
            collapsed.value = v;
          },
        }, {
          default: (params: SidebarSlotParams) => {
            slotParams.push(params);
            return h("nav", {}, "NAV");
          },
        });
    },
  });
  const app = createApp(Harness);
  app.mount(container);
  mounts.push({ app, container });
  return {
    container,
    slotParams,
    aside: () => container.querySelector("aside.hk-sidebar") as HTMLElement,
    panel: () => container.querySelector("nav.hk-sidebar-panel") as HTMLElement,
    toggle: () => container.querySelector(".hk-sidebar-rail-toggle button") as HTMLButtonElement,
    // The ACTIVE (entering/settled) generation of the rail swap — the
    // last-mounted one; during a dissolve there are two.
    generation: () =>
      container.querySelectorAll<HTMLElement>(".hk-sidebar-rail-generation"),
    swap: () => container.querySelector(".hk-sidebar-rail-swap") as HTMLElement,
  };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.useRealTimers();
});

describe("HkSidebar rail capability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the LEGACY panel when not collapsible (widths unchanged)", () => {
    const full = mountSidebar({ width: "240px" });
    expect(full.aside().style.width).toBe("240px");
    expect(full.aside().className).not.toContain("hk-sidebar-rail-host");
    expect(full.toggle()).toBeFalsy();

    const legacyCollapsed = mountSidebar({ width: "240px", collapsed: true });
    // The historical 56px rail — byte-identical behavior.
    expect(legacyCollapsed.aside().style.width).toBe("56px");
    expect(legacyCollapsed.panel().style.width).toBe("56px");
    expect(legacyCollapsed.aside().className).not.toContain("hk-sidebar-rail-host");
  });

  it("collapses through the toggle into the rail host", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true, collapsedWidth: "64px" });
    expect(c.aside().className).toContain("hk-sidebar-rail-host");
    expect(c.aside().style.width).toBe("240px");

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().style.width).toBe("64px");
    expect(c.panel().style.width).toBe("64px");
    // The density moved OFF the root onto the swap's generation: a root
    // attribute flips with the state and would restyle the frozen
    // leaving generation mid-dissolve (the squeeze this wave fixes).
    expect(c.aside().hasAttribute("data-collapsed"), "the rail-mode root never carries the density").toBe(false);
    expect(c.generation().length).toBeGreaterThan(0);
    expect(c.generation()[c.generation().length - 1]!.hasAttribute("data-rail"), "the generation carries the rail density").toBe(true);
    expect(c.generation()[c.generation().length - 1]!.style.width).toBe("64px");
  });

  it("peeks as an overlay: the host width never moves", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);
    expect(c.aside().style.width, "the LAYOUT footprint stays at rail width").toBe("56px");
    expect(c.panel().style.width, "the panel overlays at full width").toBe("240px");

    c.aside().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.panel().style.width).toBe("56px");
  });

  it("scopes the slot params live and drops data-collapsed during a peek", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(false);
    expect(c.generation()[c.generation().length - 1]!.hasAttribute("data-rail"), "rail density while collapsed").toBe(true);

    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed, "full rows during the peek").toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(true);
    expect(c.generation()[c.generation().length - 1]!.hasAttribute("data-rail"), "no rail density on the peek generation").toBe(false);

    // closePeek (the nav-row hook) closes the drawer.
    c.slotParams[c.slotParams.length - 1]!.closePeek();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
  });

  it("keeps the mobile drawer shape untouched (no rail chrome when mobile)", () => {
    const c = mountSidebar({ collapsible: true, mobile: true });
    expect(c.aside().style.width).toBe("");
    expect(c.aside().className).not.toContain("hk-sidebar-rail-host");
    expect(c.toggle()).toBeFalsy();
  });
});

/** A pointermove with explicit viewport coordinates (happy-dom does not
 *  populate clientX/clientY from the init dict reliably, and the
 *  suppression wiring is purely geometric). */
function pointerMove(x: number, y: number): MouseEvent {
  const e = new MouseEvent("pointermove", { bubbles: true });
  Object.defineProperty(e, "clientX", { value: x });
  Object.defineProperty(e, "clientY", { value: y });
  return e;
}

/** A pointerenter carrying viewport coordinates — the host evaluates the
 *  toggle containment on ENTER, before it arms the dwell. */
function pointerEnterAt(x: number, y: number): MouseEvent {
  const e = new MouseEvent("pointerenter", { bubbles: true });
  Object.defineProperty(e, "clientX", { value: x });
  Object.defineProperty(e, "clientY", { value: y });
  return e;
}

/** A transitionend carrying the property name (happy-dom's Event has no
 *  TransitionEvent, and the host handlers filter on `width`). */
function widthTransitionEnd(): Event {
  const e = new Event("transitionend");
  Object.defineProperty(e, "propertyName", { value: "width" });
  return e;
}

/** Pin the toggle wrapper's box: happy-dom lays nothing out, and the
 *  suppression wiring reads getBoundingClientRect on purpose (geometry,
 *  not event.target). */
function stubToggleRect(container: HTMLElement, rect: { left: number; top: number; size?: number }) {
  const el = container.querySelector(".hk-sidebar-rail-toggle") as HTMLElement;
  const size = rect.size ?? 24;
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      right: rect.left + size,
      bottom: rect.top + size,
      width: size,
      height: size,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("HkSidebar rail chrome: toggle placement and the clip wrapper", () => {
  it("keeps the toggle a DIRECT child of the panel and the bands inside the clip", () => {
    const c = mountSidebar({ collapsible: true });
    const panel = c.panel();
    const clip = panel.querySelector(":scope > .hk-sidebar-rail-clip") as HTMLElement | null;
    const toggle = panel.querySelector(":scope > .hk-sidebar-rail-toggle") as HTMLElement | null;

    expect(clip, "the content clip lives inside the panel").toBeTruthy();
    expect(toggle, "the toggle is a direct child of the panel").toBeTruthy();
    expect(clip!.contains(toggle!), "the toggle is NOT clipped by the wrapper").toBe(false);
    // The bands (header/body/footer) are inside the clip — now inside the
    // swap's generation, one per density.
    expect(clip!.querySelector(".hk-sidebar-body")).toBeTruthy();
    expect(clip!.querySelector(".hk-sidebar-rail-swap")).toBeTruthy();
    expect(clip!.contains(c.aside())).toBe(false);
  });

  it("collapses through the SWAP: both densities coexist, each pinned at its own width", async () => {
    // Freeze rAF to hold the dissolve mid-flight (HkCrossfade.test's
    // timing model): the leaving FULL generation stays frozen at its
    // dress and width while the entering RAIL generation takes over —
    // no generation ever renders at the panel's transient width.
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0 as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const c = mountSidebar({ width: "240px", collapsible: true, collapsedWidth: "64px" });

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(100);

    const gens = c.generation();
    expect(gens.length, "both generations share the swap's cell mid-dissolve").toBe(2);
    const [leaving, entering] = gens;
    expect(leaving!.hasAttribute("data-rail"), "the leaving copy keeps the full dress").toBe(false);
    expect(leaving!.style.width).toBe("240px");
    expect(entering!.hasAttribute("data-rail"), "the entering copy takes the rail dress").toBe(true);
    expect(entering!.style.width).toBe("64px");
    // The band content lives inside the entering generation.
    expect(entering!.querySelector(".hk-sidebar-body")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("renders the legacy panel with NO clip wrapper (byte-identical non-rail path)", () => {
    const legacy = mountSidebar({ width: "240px" });
    expect(legacy.panel().querySelector(".hk-sidebar-rail-clip")).toBeFalsy();
    expect(legacy.panel().querySelector(".hk-sidebar-rail-toggle")).toBeFalsy();
    // Direct children are still the bands' own wrappers.
    expect(legacy.panel().children[0]!.className).toBe("hk-sidebar-body-wrap");
  });
});

describe("HkSidebar pin window: expand must not replay the slide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("pins on a rail -> expanded flip and clears on the host width transition", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning"), "collapsing never pins").toBe(false);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning"), "the expand window is pinned").toBe(true);
    // The panel is ALREADY at its final width: nothing slides.
    expect(c.panel().style.width).toBe("240px");
    expect(c.aside().style.width).toBe("240px");

    c.aside().dispatchEvent(widthTransitionEnd());
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(false);
  });

  it("clears the pin window by the fallback when no transition fires", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);

    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-pinning"), "the fallback backstops a silent host").toBe(false);
  });

  it("collapsing closes an open pin window immediately", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(false);
    expect(c.aside().style.width).toBe("56px");
  });

  it("a child transitionend never ends the window (filtered to the host's width)", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    // The panel's own width transition bubbles up here too; it must not
    // clear the host's pin window.
    c.panel().dispatchEvent(widthTransitionEnd());
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);
  });
});

describe("HkSidebar hover suppression: a pointer on the toggle never peeks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("suppresses the dwell while the pointer rests on the toggle, re-arms when it moves off", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, { left: 100, top: 200 });

    // Enter the rail, then land on the toggle: the pointerenter already
    // armed the dwell, the first pointermove must kill it.
    c.aside().dispatchEvent(new Event("pointerenter"));
    c.aside().dispatchEvent(pointerMove(110, 210));
    await vi.advanceTimersByTimeAsync(400 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "parked on the toggle: no peek").toBe(false);
    expect(c.generation()[c.generation().length - 1]!.hasAttribute("data-rail")).toBe(true);

    // Moving off the toggle (still on the rail) re-arms the normal dwell.
    c.aside().dispatchEvent(pointerMove(400, 500));
    await vi.advanceTimersByTimeAsync(399);
    expect(c.aside().hasAttribute("data-peeking"), "one tick before the fresh dwell").toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.aside().hasAttribute("data-peeking"), "off the toggle the peek arms normally").toBe(true);
  });

  it("evaluates suppression on ENTER: crossing the boundary onto the toggle arms nothing", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, { left: 100, top: 200 });

    // The pointer lands ON the circle with the enter event itself — there
    // may never be a pointermove to correct it.
    c.aside().dispatchEvent(pointerEnterAt(110, 210));
    await vi.advanceTimersByTimeAsync(400 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "enter on the toggle arms nothing").toBe(false);
    expect(c.generation()[c.generation().length - 1]!.hasAttribute("data-rail")).toBe(true);
  });

  it("evaluates suppression on ENTER: entering elsewhere on the rail still peeks", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, { left: 100, top: 200 });

    c.aside().dispatchEvent(pointerEnterAt(400, 500));
    await vi.advanceTimersByTimeAsync(399);
    expect(c.aside().hasAttribute("data-peeking"), "one tick before the dwell").toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.aside().hasAttribute("data-peeking"), "off the toggle the enter arms the dwell").toBe(true);
  });

  it("ignores a pointerleave whose relatedTarget is still inside the host", async () => {
    const c = mountSidebar({ collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    // The peek/width transitions rebuild the toggle subtree; the
    // synthesized leave must not start the grace close.
    const churn = new Event("pointerleave");
    Object.defineProperty(churn, "relatedTarget", { value: c.panel().querySelector(".hk-sidebar-body") });
    c.aside().dispatchEvent(churn);
    await vi.advanceTimersByTimeAsync(150 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "DOM churn is not a leave").toBe(true);

    // A REAL leave still closes on the grace.
    c.aside().dispatchEvent(new Event("pointerleave"));
    await vi.advanceTimersByTimeAsync(150);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
  });

  it("clicking the toggle during an open peek still pins the sidebar expanded", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.aside().style.width).toBe("240px");
    expect(c.aside().hasAttribute("data-pinning"), "the peek pin is a rail -> expanded flip").toBe(true);
  });
});
